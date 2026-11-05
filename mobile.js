import {buildExerciseLibrary,metadataLine} from './exercise-metadata.js?v=0.5.1';
import { catalog,byId, dayNames, plans } from './catalog.js?v=0.5.1';
import {workoutFromSession,sessionFromWorkout} from './form-model.js?v=0.5.1';
import {ArchiveSync} from './archive-sync.js?v=0.5.1';
import {validate as validateWorkout,pathFor,today} from './core.js?v=0.5.1';
import {defaultPlanData,validatePlans,validateEditorDraft,scheduledUnit,sessionForUnit,canRefreshTemplate,recordPlanChange,planPath} from './training-plans.js?v=0.5.1';
import {PlanEditor} from './plan-editor.js?v=0.5.1';
import {syncPlanRecord,ensureExerciseRegistry} from './plan-sync.js?v=0.5.1';
import {createConfirmation} from './confirm-action.js?v=0.5.1';
const directory=await fetch('./exercise-directory.json').then(r=>{if(!r.ok)throw Error('Übungskatalog fehlt');return r.json()});
const exerciseLibrary=buildExerciseLibrary(catalog,directory,byId);
const seedHistory=[];
const schema=await fetch('./workout.schema.json').then(r=>{if(!r.ok)throw Error('Schema fehlt');return r.json()});
let archive, syncMessage='Noch nicht verbunden';
let planRecord,planEditor,syncRunning=false,localActionBusy=0;
const confirmAction=createConfirmation(()=>localActionBusy++,()=>localActionBusy--);

const DB_NAME = 'gym-tracker-offline-v1';
const DB_VERSION = 1;
const app = document.getElementById('app');
let database;
let currentPage = 'training';
let date = today();
let session;
let settings = { key: 'preferences', restSeconds: {} };
let importedHistory = [];
let otherSessions = [];
let saveTail = Promise.resolve();
let saveError = '';
let pendingSaves = 0;
let toastMessage = '';
let showFazit = false;
let installPrompt = null;
function localDate(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function dayOf(s) { return new Date(s + 'T12:00:00').getDay(); }
function formatDate(s) { return new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(s + 'T12:00:00')); }
function num(x) { return typeof x === 'number' ? x : Number(String(x).replace(',', '.')); }
function kgLabel(x) { return String(x).replace('.', ','); }
function esc(x) { return String(x ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function lookupName(id) { return byId.get(id)?.de || id.replaceAll('_', ' '); }
const basisLabel = { total: 'Gesamtgewicht', per_side: 'Gewicht je Seite', dumbbell_each: 'Je Kurzhantel', machine_display: 'Maschinenanzeige', bodyweight: 'Zusatzgewicht', unknown: 'Gewicht' };
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains('sessions'))
                db.createObjectStore('sessions', { keyPath: 'date' });
            if (!db.objectStoreNames.contains('history'))
                db.createObjectStore('history', { keyPath: 'date' });
            if (!db.objectStoreNames.contains('settings'))
                db.createObjectStore('settings', { keyPath: 'key' });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
function getRecord(store, key) {
    return new Promise((resolve, reject) => { const tx = database.transaction(store, 'readonly'); const req = tx.objectStore(store).get(key); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function getAllRecords(store) {
    return new Promise((resolve, reject) => { const tx = database.transaction(store, 'readonly'); const req = tx.objectStore(store).getAll(); req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
function putRecord(store, item) {
    return new Promise((resolve, reject) => { const tx = database.transaction(store, 'readwrite'); tx.objectStore(store).put(item); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error); });
}
async function refreshCollections() { otherSessions = await getAllRecords('sessions'); importedHistory = await getAllRecords('history'); }
function historyCollection() {
    const map = new Map();
    for (const w of seedHistory)
        map.set(w.date, w);
    for (const w of importedHistory.filter(w=>w.environment!=='test'))
        map.set(w.date, w);
    for (const s of otherSessions.filter(x => x.status === 'completed'&&!x.testOnly))
        map.set(s.date, toWorkout(s, 'production'));
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
}
function previousExercise(id, beforeDate, basis) {
    for (const w of historyCollection()) {
        if (w.date >= beforeDate)
            continue;
        const exercise = w.exercises.find(x => x.exercise_id === id&&(!basis||x.load_basis===basis));
        if (exercise)
            return { date: w.date, exercise };
    }
    return null;
}
function makeSession(day,unit=scheduledUnit(planRecord.data,day)){return sessionForUnit(day,unit,byId,previousExercise);}
function unitSelector(){const normal=scheduledUnit(planRecord.data,date);return `<section class="card training-unit-selector"><label for="training-unit">Einheit für diesen Tag</label><select id="training-unit"><option value="__current">${esc(session.unitIcon||'🏋️')} ${esc(session.sessionName)} · aktuell</option>${planRecord.data.units.map(u=>`<option value="${u.id}">${u.icon} ${esc(u.name)}</option>`).join('')}<option value="__rest">🌿 Ruhetag</option></select><div><p class="muted">${session.manualUnitOverride?'Nur für diesen Tag geändert. ':''}Normalerweise ${esc(dayNames[dayOf(date)])}: <b>${esc(normal?.name||'Ruhetag')}</b></p><button class="quiet-btn" data-action="unit-standard">Wochenplan übernehmen</button></div></section>`;}
async function selectDate(next) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(next) || Number.isNaN(Date.parse(next + 'T12:00:00')))
        return;
    await saveTail;
    date = next;
    await refreshCollections();
    let existing=await getRecord('sessions',date);
    if(existing&&!existing.sessionName&&!existing.notes&&!existing.exercises.length&&!existing.baseSha)existing=null;
    let refreshed=false;
    if(existing&&canRefreshTemplate(existing)&&existing.planSignature!==JSON.stringify(scheduledUnit(planRecord.data,date))){existing=makeSession(date);refreshed=true;}
    const historical=await getRecord('history',date),sha=await getRecord('settings','sha:'+date);
    session=existing||(historical?sessionFromWorkout(historical,byId,sha?.sha||null):makeSession(date));
    showFazit = session.status === 'completed';
    if (!existing||refreshed)
        await putRecord('sessions', session);
    currentPage = 'training';
    render();
}
function saveLocally(keepQueue=false) {
    session.touched=true;
    if(!keepQueue){session.syncPending=false;session.status='draft';}
    session.updatedAt = new Date().toISOString();
    const snapshot = structuredClone(session);
    pendingSaves++;
    updateSaveIndicator();
    saveTail = saveTail.catch(() => { }).then(async () => {
        await putRecord('sessions', snapshot);
        saveError = '';
    }).catch(err => { saveError = String(err); }).finally(() => {
        pendingSaves = Math.max(0, pendingSaves - 1);
        updateSaveIndicator();
    });
}
function savePreferences() {
    const snapshot = structuredClone(settings);
    saveTail = saveTail.catch(() => { }).then(() => putRecord('settings', snapshot)).catch(err => { saveError = String(err); updateSaveIndicator(); });
}
function updateSaveIndicator() {
    const el = document.getElementById('save-status');
    if (el) {
        el.className = 'save-status ' + (saveError ? 'bad' : pendingSaves > 0 ? 'pending' : 'good');
        el.textContent = saveError ? 'Speichern fehlgeschlagen' : pendingSaves > 0 ? 'Speichert …' : 'Lokal gespeichert';
    }
}
function countSets() { const enabled = session.exercises.filter(e => e.enabled); const total = enabled.reduce((n, e) => n + e.sets.length, 0); const done = enabled.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0); return { total, done, remaining: total - done, percentage: total ? Math.round(done / total * 100) : 0, exercises: enabled.length }; }
function getExercise(id) { return session.exercises.find(e => e.id === id); }
function previousLabel(id) {
    const previous = previousExercise(id, date,getExercise(id)?.basis);
    if (!previous)
        return 'Noch keine Referenz';
    const sets = previous.exercise.sets;
    const weights = [...new Set(sets.map(s => s.weight_kg))].map(kgLabel).join('/');
    return `${new Date(previous.date + 'T12:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} · ${weights} kg · ${sets.map(s => s.reps).join('/')}`;
}
function createHeader() {
    return `<header class="topbar"><div class="topbar-inner"><div class="brand"><span class="brand-mark">G<span>.</span></span><span class="brand-copy"><strong>GYM TRACKER</strong><small>MOBILE · V0.5</small></span></div><div class="topbar-right"><span class="connection ${navigator.onLine ? 'online' : 'offline'}" id="network-indicator"><span class="dot"></span>${navigator.onLine ? 'Online' : 'Offline'}</span><span id="save-status" class="save-status good">Lokal gespeichert</span></div></div></header>`;
}
function createNav() {
    const tabs = [['training', 'Training', '▦'], ['plans','Pläne','▤'], ['history', 'Verlauf', '▥'], ['settings', 'Einstellungen', '⚙']];
    return `<nav class="tabs" aria-label="Hauptnavigation">${tabs.map(([key, title, icon]) => `<button type="button" data-action="tab" data-tab="${key}" class="tab ${currentPage === key ? 'active' : ''}"><span>${icon}</span>${title}</button>`).join('')}</nav>`;
}
function createTraining() {
    const c = countSets();
    return `<section class="page training">
 <div class="headline-row"><div><div class="eyebrow">DEIN TRAINING <span>·</span> ${esc(dayNames[dayOf(date)].toUpperCase())}</div><h1>${esc(session.unitIcon||'🏋️')} ${esc(session.sessionName)}</h1><p class="muted">${esc(session.unitDescription||'Deine Trainingseinheit')}</p></div><span class="version-tag">LOKALER ${session.status === 'completed' ? 'ABSCHLUSS' : 'ENTWURF'}</span></div>
 <div class="date-strip"><button type="button" data-action="week" data-offset="-7" class="iconbutton" aria-label="Vorige Woche">←</button><label class="date-input-wrap"><span>TRAININGSDATUM</span><input id="date-picker" type="date" value="${esc(date)}" aria-label="Trainingsdatum"></label><button type="button" data-action="week" data-offset="7" class="iconbutton" aria-label="Nächste Woche">→</button></div>
 <div class="day-selector">${[1, 2, 3, 4, 5, 6,0].map(i => `<button type="button" data-action="day" data-day="${i}" class="day-chip ${dayOf(date) === i ? 'selected' : ''}">${['SO', 'MO', 'DI', 'MI', 'DO', 'FR', 'SA'][i]}</button>`).join('')}</div>
 ${unitSelector()}
 <div class="overview"><div class="metric"><span>FORTSCHRITT</span><strong>${c.percentage}<small>%</small></strong></div><div class="metric"><span>ERLEDIGTE SÄTZE</span><strong>${c.done}<small> / ${c.total}</small></strong></div><div class="metric"><span>ÜBUNGEN AKTIV</span><strong>${c.exercises}</strong></div><progress class="progress" aria-label="Trainingsfortschritt" value="${c.percentage}" max="100"></progress></div>
 ${session.status === 'completed' ? `<div class="completed-banner"><span class="badge-check">✓</span><div><strong>Training abgeschlossen</strong><p>Dein Training liegt im lokalen Speicher. ${session.syncPending?'Es wartet auf die Synchronisierung.':session.baseSha?'Es ist mit deinem privaten Archiv synchronisiert.':'Es ist lokal gespeichert.'}</p></div><button class="button outline" data-action="resume">Bearbeiten</button></div>` : ''}
 ${!session.exercises.length ? `<div class="empty-state"><div class="empty-icon">☾</div><h2>Heute ist Platz für Erholung.</h2><p>Du möchtest trainieren? Wähle oben eine andere Einheit oder lege unter Pläne eine an.</p></div>` : session.exercises.map((e, i) => createExercise(e, i)).join('')}
 <section class="session-notes card"><div class="section-heading"><div class="eyebrow">TRAININGSNOTIZ</div><h2>Wie lief die Einheit?</h2></div><textarea data-field="notes" data-scope="session" rows="3" placeholder="Energie, Schlaf, Technik, Beschwerden oder Besonderheiten …">${esc(session.notes)}</textarea></section>
 ${session.status === 'completed' && showFazit ? createFazit() : ''}
 <div class="action-dock"><div class="dock-info"><strong>${c.done} von ${c.total} Sätzen</strong><span id="dock-hint">Jede Änderung wird automatisch lokal gesichert</span></div><div class="dock-buttons"><button type="button" class="button outline" data-action="export">JSON exportieren</button>${session.status === 'completed' ? '<button type="button" class="button primary" data-action="show-fazit">Fazit ansehen</button>' : `<button type="button" class="button primary" data-action="complete" ${c.done === 0 ? 'disabled' : ''}>Training abschließen ↗</button>`}</div></div>
 </section>`;
}
function createExercise(e, i) {
    const meta = byId.get(e.id);
    const completed = e.sets.filter(x => x.done).length;
    return `<article class="exercise-card card ${!e.enabled ? 'inactive' : ''}" data-exercise="${esc(e.id)}"><div class="exercise-header"><div class="exercise-index">${String(i + 1).padStart(2, '0')}</div><div class="exercise-title"><h2>${esc(meta?.de || lookupName(e.id))}</h2><p class="translation">${esc(metadataLine(meta))}</p></div><label class="toggle" title="Übung aktivieren oder überspringen"><input type="checkbox" data-scope="exercise" data-id="${esc(e.id)}" data-field="enabled" ${e.enabled ? 'checked' : ''}><span></span></label></div>
 ${e.enabled ? `<div class="exercise-meta"><div><span class="label-small">LETZTES MAL</span><span class="previous-result">${esc(previousLabel(e.id))}</span></div><div class="mini-done"><strong>${completed}/${e.sets.length}</strong><small>SÄTZE</small></div></div>
 ${e.targetReps?`<p class="target-reps">Geplant: ${e.sets.length} × ${esc(e.targetReps)} Wdh. · nur abgehakte Sätze zählen</p>`:''}
 <div class="rest-row"><span>◷ &nbsp; Satzpause</span><select data-scope="exercise" data-id="${esc(e.id)}" data-field="restSeconds" aria-label="Satzpause ${esc(meta?.de || e.id)}">${[...new Set([0,60,90,120,150,180,240,e.restSeconds])].sort((a,b)=>a-b).map(s => `<option value="${s}" ${e.restSeconds === s ? 'selected' : ''}>${s} Sek.</option>`).join('')}</select></div>
 <div class="set-table"><div class="set-head"><span>SATZ</span><span>GEWICHT <small>KG</small></span><span>WDH.</span><span>FERTIG</span></div>
 ${e.sets.map((s, j) => `<div class="set-row ${s.done ? 'is-done' : ''}"><div class="set-number">${String(j + 1).padStart(2, '0')}</div><div class="stepper"><button type="button" class="step-btn" data-action="adjust" data-id="${esc(e.id)}" data-index="${j}" data-field="kg" data-delta="-${meta?.increment || 2.5}" aria-label="Gewicht reduzieren">−</button><input type="text" inputmode="decimal" data-scope="set" data-id="${esc(e.id)}" data-index="${j}" data-field="kg" value="${esc(kgLabel(s.kg))}" aria-label="Gewicht Satz ${j + 1}"><button type="button" class="step-btn" data-action="adjust" data-id="${esc(e.id)}" data-index="${j}" data-field="kg" data-delta="${meta?.increment || 2.5}" aria-label="Gewicht erhöhen">+</button></div><div class="stepper"><button type="button" class="step-btn" data-action="adjust" data-id="${esc(e.id)}" data-index="${j}" data-field="reps" data-delta="-1" aria-label="Wiederholungen reduzieren">−</button><input type="text" inputmode="numeric" data-scope="set" data-id="${esc(e.id)}" data-index="${j}" data-field="reps" value="${esc(s.reps)}" aria-label="Wiederholungen Satz ${j + 1}"><button type="button" class="step-btn" data-action="adjust" data-id="${esc(e.id)}" data-index="${j}" data-field="reps" data-delta="1" aria-label="Wiederholungen erhöhen">+</button></div><label class="done-label"><input aria-label="Satz erledigt" type="checkbox" data-scope="set" data-id="${esc(e.id)}" data-index="${j}" data-field="done" ${s.done ? 'checked' : ''}><span class="check-square">✓</span></label></div>`).join('')}
 </div>
 <div class="exercise-bottom"><div class="load-basis">${esc(basisLabel[e.basis] || 'Gewicht')}</div><div class="set-actions"><button class="quiet-btn" type="button" data-action="remove-set" data-id="${esc(e.id)}" ${e.sets.length < 2 ? 'disabled' : ''}>− Satz</button><button class="quiet-btn" type="button" data-action="add-set" data-id="${esc(e.id)}">+ Satz</button></div></div>
 <label class="note-label">NOTIZ ZUR ÜBUNG<textarea data-scope="exercise" data-id="${esc(e.id)}" data-field="notes" rows="2" placeholder="Technik, Muskelgefühl, Anstrengung, Schmerzen …">${esc(e.notes)}</textarea></label>` : `<div class="skipped"><span>Übung übersprungen</span><p>Alle bisherigen Eingaben bleiben erhalten.</p></div>`}
 </article>`;
}
function exerciseComparison(e) {
    const meta = byId.get(e.id);
    const old = previousExercise(e.id, date,e.basis)?.exercise;
    const done = e.sets.filter(s => s.done);
    if (!done.length)
        return { title: meta?.de || e.id, detail: 'Nicht absolviert', tone: 'muted' };
    const reps = done.reduce((n, s) => n + num(s.reps), 0);
    if (!old)
        return { title: meta?.de || e.id, detail: `${done.length} Sätze · ${reps} Wiederholungen. Noch kein Vergleichswert.`, tone: 'neutral' };
    const same = done.length === old.sets.length && done.every((s, i) => num(s.kg) === old.sets[i].weight_kg);
    if (!same)
        return { title: meta?.de || e.id, detail: `${done.length} Sätze protokolliert. Gewicht oder Satzanzahl verändert – direkter Wiederholungsvergleich nicht sinnvoll.`, tone: 'neutral' };
    const oldRep = old.sets.reduce((n, s) => n + s.reps, 0);
    const delta = reps - oldRep;
    return { title: meta?.de || e.id, detail: delta > 0 ? `+${delta} Wiederholungen bei gleichem Gewicht und gleicher Satzzahl.` : delta < 0 ? `${delta} Wiederholungen bei gleichem Gewicht – Technik und Erholung prüfen.` : 'Wiederholungsleistung gegenüber dem letzten Mal gehalten.', tone: delta > 0 ? 'positive' : delta < 0 ? 'caution' : 'neutral' };
}
function createFazit() {
    const done = session.exercises.filter(e => e.enabled && e.sets.some(s => s.done));
    const count = done.reduce((n, e) => n + e.sets.filter(s => s.done).length, 0);
    const notes = done.filter(e => e.notes.trim());
    return `<section class="fazit card" id="fazit"><div class="eyebrow">LOKALE AUSWERTUNG</div><h2>Dein Trainingsfazit</h2><p class="muted">${done.length} Übungen und ${count} absolvierte Sätze. Regelbasierte Sofortauswertung ohne Internet oder KI.</p><div class="fazit-items">${done.map(e => { const v = exerciseComparison(e); return `<div class="fazit-item ${v.tone}"><strong>${esc(v.title)}</strong><p>${esc(v.detail)}</p></div>`; }).join('')}</div>${notes.length ? `<div class="fazit-notes"><strong>Deine Technik- und Belastungsnotizen</strong>${notes.map(e => `<p><b>${esc(lookupName(e.id))}:</b> ${esc(e.notes)}</p>`).join('')}</div>` : ''}<div class="fazit-tip">Nächstes Training: Nur bei sauberer Ausführung und guter Erholung steigern. Ein ausführliches KI-Fazit folgt erst nach einer späteren ChatGPT-Anbindung.</div></section>`;
}
function createHistory() {
    const history = historyCollection();
    const total = history.length, allSets = history.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.length, 0), 0);
    return `<section class="page"><div class="eyebrow">DEINE HISTORIE</div><h1>Training im Blick.</h1><p class="muted">Deine privaten Trainings werden nach dem Verbinden mit GitHub geladen. Ohne Anmeldung sind keine persönlichen Referenzlogs im App-Code enthalten.</p><div class="history-metrics"><div class="metric"><span>GESPEICHERTE EINHEITEN</span><strong>${total}</strong></div><div class="metric"><span>PROTOKOLLIERTE SÄTZE</span><strong>${allSets}</strong></div></div>
 <div class="history-list">${history.slice(0, 30).map(w => `<article class="history-card card"><div><small>${esc(new Date(w.date + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: 'short', year: 'numeric' }))}</small><h3>${esc(w.session_name.replaceAll('_', ' + '))}</h3><p>${w.exercises.length} Übungen · ${w.exercises.reduce((n, e) => n + e.sets.length, 0)} Sätze</p></div><span class="history-source">${otherSessions.some(x => x.date === w.date && x.status === 'completed') ? 'LOKAL' : importedHistory.some(x => x.date === w.date) ? 'IMPORT' : 'REFERENZ'}</span></article>`).join('')}</div>
 <div class="info-box">Tipp: Im Tab <b>Einstellungen</b> kannst du weitere Trainingslogs als JSON importieren und deine lokalen Einträge sichern.</div></section>`;
}
function createSettings() {
    const drafts = otherSessions.filter(s => s.status === 'draft').length, complete = otherSessions.filter(s => s.status === 'completed').length;
    return `<section class="page"><div class="eyebrow">DEINE DATEN</div><h1>Alles unter Kontrolle.</h1><p class="muted">Hier bleibt jeder Satz lokal gespeichert – auch ohne Verbindung.</p>
 <section class="card settings-card"><div class="settings-icon">▣</div><h2>Datensicherung</h2><p>Deine Einträge liegen in der IndexedDB dieses Browsers. Erstelle regelmäßig ein Backup als Datei, vor allem bevor du Browserdaten löschst oder das Gerät wechselst.</p><div class="data-stats"><span>${drafts} lokale Entwürfe</span><span>${complete} lokale Abschlüsse</span></div><button class="button primary" data-action="backup">Komplettes Backup herunterladen</button></section>
 <section class="card settings-card"><div class="settings-icon">⇅</div><h2>Daten importieren</h2><p>Du kannst einen exportierten Workout-JSON-Datensatz oder ein zuvor erstelltes App-Backup einlesen. Es wird <strong>nichts an GitHub</strong> verändert.</p><label class="file-pick">JSON-Datei auswählen<input id="import-file" type="file" accept=".json,application/json"></label><small>Ein Import überschreibt vorhandene Einträge mit gleichem Datum nur nach Rückfrage.</small></section>
 <section class="card settings-card"><div class="settings-icon">⇅</div><h2>Privates GitHub-Archiv</h2><p>IamRiku-Ben / gym-training-log</p><p role="status">${esc(syncMessage)}</p><p>${otherSessions.filter(s=>s.syncPending).length} Einheiten warten auf Sync. ${otherSessions.filter(s=>s.conflict).length} Konflikte.</p>${archive?.client?'<div class="sync-buttons"><button class="button primary" data-action="sync">Jetzt synchronisieren</button><button class="button outline" data-action="disconnect">Token vergessen</button></div>':'<label class="token-label">Fine-grained Token<input type="password" id="github-token" autocomplete="off" spellcheck="false" placeholder="Nur für dein privates Trainingsrepository"></label><button class="button primary" data-action="connect">Verbinden & Historie laden</button>'}<small>Nur im Arbeitsspeicher. Nach Neuladen erneut eingeben. Contents: Lesen und Schreiben, nur für gym-training-log.</small></section>
 ${otherSessions.filter(s=>s.conflict).map(s=>`<section class="card settings-card"><h2>Konflikt · ${esc(s.date)}</h2><p>Beide Versionen bleiben erhalten. Prüfe sie vor dem Ersetzen.</p><div class="sync-buttons"><button class="button outline" data-action="conflict-export" data-date="${esc(s.date)}">Beide exportieren</button><button class="button outline" data-action="conflict-remote" data-date="${esc(s.date)}">GitHub übernehmen</button><button class="button outline" data-action="conflict-local" data-date="${esc(s.date)}">Lokal vormerken</button></div></section>`).join('')}
 <section class="card settings-card"><div class="settings-icon">⌁</div><h2>Offline-Installation</h2><p>Auf Android diese HTTPS-Seite über das Browsermenü zum Startbildschirm hinzufügen. Nach dem ersten vollständigen Laden werden die App-Dateien für Offline-Zugriff gespeichert.</p><button class="button outline" data-action="install" id="install-button">App installieren (falls verfügbar)</button></section>
 <div class="info-box"><strong>Mobile Formularbasis</strong><p>Funktioniert: Training, Notizen, Referenzwerte, Offline-Speicherung, lokales Fazit und JSON-Export. GitHub-Sync ist verfügbar. Ein automatisches KI-Fazit und Hintergrund-Push sind nicht enthalten.</p></div></section>`;
}
function render() {
    app.innerHTML = `${createHeader()}<div class="layout"><main>${currentPage === 'training' ? createTraining() :currentPage==='plans'?planEditor.view(planRecord): currentPage === 'history' ? createHistory() : createSettings()}</main><div class="footer-note">GYM TRACKER V0.5 · LOKAL + PRIVATES ARCHIV · <span>BUILT FOR PROGRESS</span></div></div>${createNav()}${toastMessage ? `<div class="toast" role="status">${esc(toastMessage)}</div>` : ''}`;
    updateSaveIndicator();
    if(syncRunning)app.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
}
function tell(message) { toastMessage = message; const old = document.querySelector('.toast'); if (old)
    old.remove(); const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.textContent = message; document.body.append(el); setTimeout(() => { el.remove(); if (toastMessage === message)
    toastMessage = ''; }, 3500); }
function validate() {
    for (const e of session.exercises.filter(e => e.enabled))
        for (const [i, s] of e.sets.entries()) {
            if (!s.done)
                continue;
            if (String(s.kg).trim() === '' || !Number.isFinite(num(s.kg)) || num(s.kg) < 0)
                return `Gewicht von ${lookupName(e.id)}, Satz ${i + 1}, prüfen.`;
            if (String(s.reps).trim() === '' || !Number.isInteger(num(s.reps)) || num(s.reps) < 1)
                return `Wiederholungen von ${lookupName(e.id)}, Satz ${i + 1}, prüfen.`;
        }
    return null;
}
function toWorkout(s,environment='production'){return workoutFromSession(s,environment);}
function downloadJson(filename, obj) {
    const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
}
async function handleClick(event) {
    const target = event.target.closest('[data-action]');
    if (!target)
        return;
    const action = target.dataset.action;
    if(action?.startsWith('plans-conflict-')){await handlePlanConflict(action);return;}
    if(await planEditor.action(action,target,planRecord))return;
    if(action==='unit-standard'){await replaceUnitForDate(scheduledUnit(planRecord.data,date),false);return;}
    if(['connect','disconnect','sync','conflict-export','conflict-remote','conflict-local'].includes(action)){await handleArchive(action,target.dataset.date);return;}
    const id = target.dataset.id || '', e = getExercise(id), index = Number(target.dataset.index || 0);
    if (action === 'tab') {
        currentPage = target.dataset.tab;
        await refreshCollections();
        render();
        window.scrollTo({top:0,behavior:'instant'});
        return;
    }
    if (action === 'week') {
        const d = new Date(date + 'T12:00:00');
        d.setDate(d.getDate() + Number(target.dataset.offset));
        await selectDate(localDate(d));
        return;
    }
    if (action === 'day') {
        const d = new Date(date + 'T12:00:00');
        const current = dayOf(date) || 7,next=Number(target.dataset.day)||7;
        d.setDate(d.getDate() + next - current);
        await selectDate(localDate(d));
        return;
    }
    if (action === 'adjust' && e) {
        const s = e.sets[index];
        if (!s)
            return;
        const field = target.dataset.field;
        const delta = Number(target.dataset.delta);
        s[field] = Math.max(0, Math.round((num(s[field]) || 0) * 100 + delta * 100) / 100);
        saveLocally();
        render();
        return;
    }
    if (action === 'add-set' && e) {
        const last = e.sets[e.sets.length - 1] || { kg: 0, reps: 10 };
        e.sets.push({ id: Math.max(0, ...e.sets.map(s => s.id)) + 1, kg: last.kg, reps: last.reps, done: false });
        saveLocally();
        render();
        return;
    }
    if (action === 'remove-set' && e && e.sets.length > 1) {
        if (e.sets.at(-1)?.done && !await confirmAction('Der letzte Satz ist bereits abgehakt. Trotzdem entfernen?'))
            return;
        e.sets.pop();
        saveLocally();
        render();
        return;
    }
    if (action === 'resume') {
        session.status = 'draft';
        showFazit = false;
        saveLocally();
        render();
        return;
    }
    if (action === 'show-fazit') {
        showFazit = true;
        render();
        document.getElementById('fazit')?.scrollIntoView({ behavior: 'smooth' });
        return;
    }
    if (action === 'complete') {
        const err = validate();
        if (err) {
            tell(err);
            return;
        }
        const { done } = countSets();
        if (!done) {
            tell('Bitte mindestens einen Satz abhaken.');
            return;
        }
        if (!await confirmAction(`${done} erledigte Sätze lokal abschließen? Nicht abgehakte Sätze zählen nicht als absolviert.`))
            return;
        session.status = 'completed';
        session.syncPending=!session.testOnly;
        showFazit = true;
        saveLocally(true);
        await saveTail;
        if(saveError){tell('Abschluss konnte nicht gespeichert werden. Bitte Backup exportieren.');return;}
        await refreshCollections();
        render();
        document.getElementById('fazit')?.scrollIntoView({ behavior: 'smooth' });
        tell(session.testOnly?'Testabschluss ausschließlich lokal gespeichert.':'Abschluss lokal gespeichert. GitHub-Sync vorgemerkt.');
        if(archive.client&&navigator.onLine)await runSync();
        return;
    }
    if (action === 'export') {
        if (session.status === 'completed') {
            const err = validate();
            if (err) {
                tell(err);
                return;
            }
            downloadJson(`${date}-gym-tracker.json`, toWorkout(session, 'production'));
        }
        else
            downloadJson(`${date}-gym-tracker-entwurf.json`, { draft_version: '1.0', environment: 'local', date: session.date, timezone: 'Europe/Berlin', session_name: session.sessionName, note: session.notes, exercises: session.exercises.map(e => ({ exercise_id: e.id, load_basis: e.basis, enabled: e.enabled, rest_seconds: e.restSeconds, notes: e.notes, sets: e.sets.map(s => ({ weight_kg: s.kg, reps: s.reps, done: s.done })) })) });
        tell('JSON-Datei exportiert – kein GitHub-Upload.');
        return;
    }
    if (action === 'backup') {
        await saveTail;
        await refreshCollections();
        downloadJson('gym-tracker-backup-' + localDate(new Date()) + '.json', { format: 'gym-tracker-local-backup', version: 1, createdAt: new Date().toISOString(), sessions: otherSessions, history: importedHistory, settings,trainingPlans:planRecord,planEditorDraft:planEditor.draft });
        tell('Backup heruntergeladen.');
        return;
    }
    if (action === 'install') {
        if (installPrompt && 'prompt' in installPrompt) {
            await installPrompt.prompt();
        }
        else
            tell('Installation wird über das Browsermenü angeboten, sobald die PWA verfügbar ist.');
        return;
    }
}
function handleInput(event) {
    const el = event.target;
    if(planEditor.input(el))return;
    if (!el.dataset.scope || !session)
        return;
    if (el.dataset.scope === 'session' && el.dataset.field === 'notes') {
        session.notes = el.value;
        saveLocally();
        return;
    }
    const e = getExercise(el.dataset.id || '');
    if (!e)
        return;
    if (el.dataset.scope === 'exercise' && el.dataset.field === 'notes') {
        e.notes = el.value;
        saveLocally();
        return;
    }
    if (el.dataset.scope === 'set') {
        const s = e.sets[Number(el.dataset.index)];
        if (!s)
            return;
        const field = el.dataset.field;
        if (field === 'kg') {
            s.kg = el.value;
            saveLocally();
        }
        if (field === 'reps') {
            s.reps = el.value;
            saveLocally();
        }
    }
}
function handleChange(event) {
    const el = event.target;
    if(planEditor.change(el,planRecord))return;
    if(el.id==='training-unit'){if(el.value!=='__current')void replaceUnitForDate(planRecord.data.units.find(u=>u.id===el.value)||null,true).catch(e=>tell(e.message));return;}
    if (el.id === 'date-picker') {
        void selectDate(el.value);
        return;
    }
    if (el.id === 'import-file') {
        void importFile(el);
        return;
    }
    if (el.dataset.scope === 'set' && el.dataset.field === 'done') {
        const e = getExercise(el.dataset.id || '');
        const s = e?.sets[Number(el.dataset.index)];
        if (s) {
            s.done = el.checked;
            saveLocally();
            render();
        }
        return;
    }
    if (el.dataset.scope === 'exercise') {
        const e = getExercise(el.dataset.id || '');
        if (!e)
            return;
        if (el.dataset.field === 'enabled')
            e.enabled = el.checked;
        if (el.dataset.field === 'restSeconds') {
            e.restSeconds = Number(el.value);
            settings.restSeconds[e.id] = e.restSeconds;
            savePreferences();
        }
        saveLocally();
        render();
        return;
    }
}
function isWorkout(x) {
    try{validateWorkout(x,schema);if(x.environment==='test')return false;}catch{return false;}
    if (!x || x.schema_version !== '1.0' || typeof x.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x.date) || !Array.isArray(x.exercises) || !x.exercises.length)
        return false;
    return x.exercises.every((e) => typeof e.exercise_id === 'string' && Array.isArray(e.sets) && e.sets.length > 0 && e.sets.every((s) => Number.isFinite(s.weight_kg) && s.weight_kg >= 0 && Number.isInteger(s.reps) && s.reps >= 0));
}
function isSession(x) {
    return !!x && typeof x.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.date) && typeof x.sessionName === 'string' && typeof x.notes === 'string' && ['draft', 'completed'].includes(x.status) && Array.isArray(x.exercises) && x.exercises.every((e) => typeof e.id === 'string' && byId.has(e.id) && typeof e.enabled === 'boolean' && typeof e.restSeconds === 'number' && Number.isFinite(e.restSeconds) && typeof e.notes === 'string' && Array.isArray(e.sets) && e.sets.length > 0 && e.sets.every((s) => Number.isInteger(s.id) && typeof s.done === 'boolean' && ['number', 'string'].includes(typeof s.kg) && ['number', 'string'].includes(typeof s.reps)));
}
async function importFile(el) {
    const file = el.files?.[0];
    if (!file)
        return;
    try {
        if (file.size > 5_000_000)
            throw new Error('Datei größer als 5 MB.');
        const obj = JSON.parse(await file.text());
        if (obj?.format === 'gym-tracker-local-backup' && obj.version === 1 && Array.isArray(obj.sessions) && Array.isArray(obj.history)) {
            if(obj.trainingPlans)validatePlans(obj.trainingPlans.data,byId);
            if(obj.planEditorDraft)validateEditorDraft(obj.planEditorDraft,byId);
            if (!obj.sessions.every(isSession) || !obj.history.every(isWorkout))
                throw new Error('Ungültige Backup-Datensätze.');
            if (!await confirmAction(`Backup mit ${obj.sessions.length} Einträgen wiederherstellen? Gleiche Datumswerte werden überschrieben.`))
                return;
            for (const s of obj.sessions)
                await putRecord('sessions', s);
            for (const w of obj.history)
                await putRecord('history', w);
            if (obj.settings?.key === 'preferences')
                await putRecord('settings', obj.settings);
            settings = await getRecord('settings', 'preferences') || settings;
            if(obj.trainingPlans){await commitPlanData(obj.trainingPlans.data);planEditor.draft=null;await planEditor.stash();}
            if(obj.planEditorDraft&&obj.planEditorDraft.unit&&Array.isArray(obj.planEditorDraft.unit.exercises)&&Array.isArray(obj.planEditorDraft.unit.weekdays)){planEditor.draft={...obj.planEditorDraft,baseRevision:planRecord.revision};await planEditor.stash();}
            await selectDate(date);
            tell('Backup importiert.');
        }
        else if(obj?.draft_version==='1.0'&&Array.isArray(obj.exercises)){
            const now=new Date().toISOString();
            const draft={date:obj.date,sessionName:obj.session_name,status:'draft',notes:obj.note||'',createdAt:now,updatedAt:now,touched:true,syncPending:false,testOnly:obj.environment==='test',exercises:obj.exercises.map(e=>({id:e.exercise_id,basis:e.load_basis,enabled:e.enabled!==false,restSeconds:e.rest_seconds||byId.get(e.exercise_id)?.rest||90,notes:e.notes||'',sets:e.sets.map((s,i)=>({id:i+1,kg:s.weight_kg,reps:s.reps,done:!!s.done}))}))};
            if(!isSession(draft))throw Error('Ungültiges Entwurfsformat.');
            if(await getRecord('sessions',draft.date))throw Error('Für diesen Tag liegt bereits ein Formular vor. Bitte zuerst sichern.');
            await putRecord('sessions',draft);await selectDate(draft.date);tell('Formularentwurf importiert.');
        }
        else if (isWorkout(obj)) {
            const exists = seedHistory.some(x => x.date === obj.date) || importedHistory.some(x => x.date === obj.date);
            if (exists && !await confirmAction(`Für ${obj.date} gibt es bereits einen Referenzeintrag. Mit dem Import ersetzen?`))
                return;
            await putRecord('history', obj);
            await refreshCollections();
            render();
            tell(`Trainingslog vom ${obj.date} importiert.`);
        }
        else
            throw new Error('Nicht unterstütztes JSON-Format.');
    }
    catch (err) {
        tell('Import fehlgeschlagen: ' + String(err instanceof Error ? err.message : err));
    }
    finally {
        el.value = '';
    }
}
async function start() {
    try {
        if(navigator.locks){
            const acquired=await new Promise(resolve=>{void navigator.locks.request('gym-mobile-editor',{ifAvailable:true},async lock=>{resolve(!!lock);if(lock)await new Promise(()=>{});});});
            if(!acquired)throw Error('Dieses Trainingsformular ist bereits in einem anderen Tab geöffnet. Bitte dort weiterarbeiten oder den anderen Tab schließen und hier neu laden.');
        }
        if (!('indexedDB' in window))
            throw new Error('IndexedDB ist in diesem Browser nicht verfügbar.');
        database = await openDatabase();
        settings = await getRecord('settings', 'preferences') || settings;
        await initializePlans();
        archive=new ArchiveSync({get:getRecord,all:getAllRecords,put:putRecord,flush:async()=>{await saveTail;if(saveError)throw Error(saveError)},schema,byId,onSaved:s=>{if(session?.date===s.date)session=s;}});
        await migratePrevious();
        await selectDate(date);
        window.addEventListener('online',()=>{if(archive.client)void runSync()});
        setInterval(()=>{if(archive.client&&navigator.onLine)void runSync()},60000);
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('./sw.js').catch(e => console.warn('PWA Offline-Speicherung nicht verfügbar:', e));
        }
        window.addEventListener('online', () => { const el = document.getElementById('network-indicator'); if (el) {
            el.className = 'connection online';
            el.innerHTML = '<span class="dot"></span>Online';
        } });
        window.addEventListener('offline', () => { const el = document.getElementById('network-indicator'); if (el) {
            el.className = 'connection offline';
            el.innerHTML = '<span class="dot"></span>Offline';
        } });
        window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; });
        app.addEventListener('click', ev => { void handleClick(ev).catch(e=>tell(e.message)); });
        app.addEventListener('input', handleInput);
        app.addEventListener('change', handleChange);
    }
    catch (error) {
        app.innerHTML = `<main class="fatal"><h1>Lokaler Speicher nicht verfügbar</h1><p>Der Gym Tracker konnte IndexedDB nicht starten. Prüfe Browser-Einstellungen oder öffne die App in Chrome/Edge.</p><code>${esc(String(error))}</code></main>`;
    }
}
async function runSync(){
 if(archive.busy||syncRunning||localActionBusy)return;
 syncRunning=true;
 syncMessage='Synchronisierung läuft …';
 render();app.querySelectorAll('input,select,textarea,button').forEach(el=>el.disabled=true);
 try{await saveTail;await archive.client.verify();await refreshCollections();const used=[...planRecord.data.units.flatMap(u=>u.exercises.map(e=>e.exerciseId)),...otherSessions.flatMap(s=>s.exercises.map(e=>e.id))];await ensureExerciseRegistry(archive.client,used,byId);await archive.sync();await saveTail;const synced=await syncPlanRecord(archive.client,planRecord,byId);await putRecord('settings',synced);planRecord=synced;await refreshCurrentTemplate();await refreshCollections();syncMessage=otherSessions.some(s=>s.conflict)||planRecord.conflict?'Konflikt erkannt. Bitte Versionen unter Pläne bzw. Einstellungen prüfen.':'Trainingsdaten und Pläne synchronisiert.';}
 catch(e){syncMessage=e.message;}
 finally{syncRunning=false;}
 render();tell(syncMessage);
}
async function handleArchive(action,day){
 try{
  if(action==='connect'){
   const input=document.getElementById('github-token'),token=input.value.trim();input.value='';
   if(!token)throw Error('Bitte Token eingeben.');
   await archive.connect(token);await runSync();return;
  }
  if(action==='disconnect'){archive.disconnect();syncMessage='Token vergessen.';render();return;}
  if(action==='sync'){await runSync();return;}
  if(!archive.client)throw Error('Bitte zuerst GitHub verbinden.');
  if(archive.busy)throw Error('Bitte laufenden Sync abwarten.');
  await saveTail;
  const local=await getRecord('sessions',day),remote=await archive.client.read(pathFor(day));
  downloadJson('konflikt-'+day+'.json',{local,github:remote?.data??null});
  if(action==='conflict-export')return;
  if(action==='conflict-remote'){
   if(!remote)throw Error('Datei auf GitHub fehlt. Lokales Backup wurde exportiert.');
   validateWorkout(remote.data,schema);
   if(!await confirmAction('Die lokale Einheit durch die GitHub-Version ersetzen? Dein lokaler Entwurf wurde als Backup exportiert.'))return;
   const adopted=sessionFromWorkout(remote.data,byId,remote.sha);await putRecord('sessions',adopted);
   if(day===date)session=adopted;
   await putRecord('history',remote.data);await putRecord('settings',{key:'sha:'+day,sha:remote.sha});
  }
  if(action==='conflict-local'){
   if(!await confirmAction('Nach Prüfung deine lokale Version zum Ersetzen der GitHub-Version vormerken? Beide Versionen wurden exportiert.'))return;
   if(local.testOnly)throw Error('Testentwürfe werden nicht ins echte Archiv hochgeladen.');
   validateWorkout(toWorkout(local),schema);
   local.baseSha=remote?.sha??null;local.conflict=false;local.syncPending=true;
   await putRecord('sessions',local);if(day===date)session=local;
  }
  await refreshCollections();render();
 }catch(e){syncMessage=e.message;render();tell(e.message);}
}
async function migratePrevious(){
 const marker=await getRecord('settings','migration-v02');if(marker)return;
 const raw=localStorage.getItem('gym-tracker-v02');if(!raw)return;
 const old=JSON.parse(raw);if(!old?.records)throw Error('Vorherige lokale Daten sind nicht lesbar; Original bleibt erhalten.');
 for(const record of Object.values(old.records)){
  const w=record.data;if(await getRecord('sessions',w.date))continue;
  if(!w.session_name&&!w.notes&&!w.exercises?.length&&!record.queued)continue;
  const s=sessionFromWorkout({...w,exercises:w.exercises||[]},byId,record.baseSha??null);
  s.status=record.queued||!record.dirty?'completed':'draft';s.touched=!!record.dirty;s.syncPending=!!record.queued;s.conflict=!!record.conflict;
  if(s.status==='draft')for(const e of s.exercises)for(const set of e.sets){set.done=false;if(set.kg===null)set.kg='';if(set.reps===null)set.reps='';}
  await putRecord('sessions',s);
  if(record.baseSha)await putRecord('settings',{key:'sha:'+w.date,sha:record.baseSha});
  if(!record.dirty&&w.exercises.length)await putRecord('history',w);
 }
 await putRecord('settings',{key:'migration-v02',done:true});
}

async function queueRecord(store,item){
 const copy=structuredClone(item);pendingSaves++;updateSaveIndicator();
 const operation=saveTail.catch(()=>{}).then(()=>putRecord(store,copy)).then(()=>{saveError='';}).catch(e=>{saveError=e.message||String(e);throw e;}).finally(()=>{pendingSaves--;updateSaveIndicator();});
 saveTail=operation.catch(()=>{});await operation;
}
async function initializePlans(){
 planRecord=await getRecord('settings','training-plans');
 if(!planRecord){planRecord={key:'training-plans',data:defaultPlanData(plans,byId),baseSha:null,dirty:false,conflict:false,revision:0};await putRecord('settings',planRecord);}
 validatePlans(planRecord.data,byId);planRecord.revision??=0;
 planEditor=new PlanEditor({toTop:()=>window.scrollTo({top:0,behavior:'instant'}),confirm:confirmAction,byId,catalog:exerciseLibrary,render,notify:tell,persistDraft:draft=>queueRecord('settings',{key:'training-plan-editor',draft}),onCommit:commitPlanData,onDelete:async id=>{const next=structuredClone(planRecord.data);next.units=next.units.filter(u=>u.id!==id);await commitPlanData(next);render();tell('Einheit entfernt. Trainingslogs bleiben erhalten.');},onUndo:async()=>{const previous=await getRecord('settings','training-plans-undo');if(!previous){tell('Noch keine Planänderung zum Rückgängigmachen.');return;}await commitPlanData(previous.data);render();tell('Letzte Planänderung rückgängig gemacht.');}});
 const draft=await getRecord('settings','training-plan-editor');
 if(draft?.draft){validateEditorDraft(draft.draft,byId);planEditor.draft=draft.draft;}
}
async function commitPlanData(data){
 localActionBusy++;try{
 validatePlans(data,byId);await saveTail;if(saveError)throw Error('Speichern fehlgeschlagen. Bitte zuerst ein Backup erstellen.');
 await queueRecord('settings',{key:'training-plans-undo',data:planRecord.data});
 const next=recordPlanChange(planRecord,data);await queueRecord('settings',next);planRecord=next;
 await refreshCurrentTemplate();
 }finally{localActionBusy--;}
}
async function refreshCurrentTemplate(){
 if(!session||!canRefreshTemplate(session))return;
 const unit=scheduledUnit(planRecord.data,date);if(session.planSignature===JSON.stringify(unit))return;
 const next=makeSession(date,unit);await queueRecord('sessions',next);session=next;
}
async function replaceUnitForDate(unit,manual){
 localActionBusy++;try{
 await saveTail;if(saveError)throw Error('Bitte zuerst den Speicherfehler beheben.');
 const protectedEntry=session.touched||session.baseSha||session.status==='completed'||session.exercises.some(e=>e.notes||e.sets.some(s=>s.done))||session.notes;
 if(protectedEntry){if(!await confirmAction('Die Einheit für diesen Tag durch ein neues Formular ersetzen? Vorhandene Eingaben werden vorher als Backup heruntergeladen. Dein normaler Wochenplan bleibt unverändert.')){render();return;}downloadJson(date+'-vor-einheitenwechsel.json',session);}
 const next=makeSession(date,unit);next.manualUnitOverride=manual;next.baseSha=session.baseSha??null;next.testOnly=!!session.testOnly;next.conflict=!!session.conflict;next.touched=manual||!!protectedEntry;
 await queueRecord('sessions',next);session=next;showFazit=false;render();tell(manual?'Einheit nur für diesen Tag geändert.':'Normalen Wochenplan für diesen Tag übernommen.');
 }finally{localActionBusy--;}
}
async function handlePlanConflict(action){
 if(!archive.client)throw Error('Bitte zuerst unter Einstellungen GitHub verbinden.');
 if(syncRunning||archive.busy)throw Error('Bitte laufenden Sync abwarten.');
 localActionBusy++;try{
 const remote=await archive.client.read(planPath);if(remote)validatePlans(remote.data,byId);
 downloadJson('trainingsplaene-konflikt.json',{local:planRecord.data,github:remote?.data??null});
 if(action==='plans-conflict-export')return;
 if(action==='plans-conflict-remote'){
  if(!remote)throw Error('Die Plandatei fehlt auf GitHub. Dein lokaler Plan bleibt erhalten.');
  if(!await confirmAction('Die gespeicherten lokalen Pläne durch die GitHub-Version ersetzen? Beide Versionen wurden exportiert.'))return;
  await queueRecord('settings',{key:'training-plans-undo',data:planRecord.data});
  planRecord={...planRecord,data:remote.data,baseSha:remote.sha,dirty:false,conflict:false,revision:planRecord.revision+1};
 }
 if(action==='plans-conflict-local'){
  if(!await confirmAction('Nach Prüfung die lokale Plandatei zum Ersetzen der aktuellen GitHub-Version vormerken? Beide Versionen wurden exportiert.'))return;
  planRecord={...planRecord,baseSha:remote?.sha??null,dirty:true,conflict:false};
 }
 await queueRecord('settings',planRecord);await refreshCurrentTemplate();render();
 }finally{localActionBusy--;}
}
void start();

