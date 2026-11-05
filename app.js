import {bases,today,pathFor,validate,validateDraft,GitHub} from './core.js';
const $=id=>document.getElementById(id), key='gym-tracker-v02';
const [schema,catalog]=await Promise.all(['workout.schema.json','exercises.json'].map(p=>fetch(p).then(r=>{if(!r.ok)throw Error('App-Dateien fehlen');return r.json()})));
let state,client=null,busy=false,writable=true;
try{state=JSON.parse(localStorage.getItem(key))||{records:{},current:null};if(!state.records||typeof state.records!=='object')throw Error();for(const [p,r]of Object.entries(state.records)){validateDraft(r.data,schema);if(pathFor(r.data.date)!==p)throw Error();}}catch{writable=false;state={records:{},current:null};alert('Lokale Daten sind nicht lesbar. Nichts wird überschrieben. Bitte Browserdaten sichern.');}
const clone=x=>structuredClone(x);
function persist(){if(!writable)throw Error('Lokaler Speicher gesperrt: bestehende Daten zuerst sichern.');localStorage.setItem(key,JSON.stringify(state));$('saveStatus').textContent='✓ Auf diesem Gerät gespeichert';}
function safeSave(){try{persist();}catch(e){$('saveStatus').textContent='NICHT gespeichert: '+e.message;}}
function record(){return state.records[state.current];}
function newWorkout(){const date=today();if(state.records[pathFor(date)]){state.current=pathFor(date);}else{state.current=pathFor(date);state.records[state.current]={data:{schema_version:'1.0',date,timezone:'Europe/Berlin',session_name:'',exercises:[]},baseSha:null,dirty:true,queued:false};}safeSave();render();}
const name=id=>catalog.exercises.find(e=>e.id===id)?.name_de||id;
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
function button(text,fn){const b=node('button',text);b.type='button';b.onclick=()=>guard(fn);return b;}
async function guard(fn){try{await fn();}catch(e){$('syncStatus').textContent=e.message;}}
function mark(){const r=record();r.dirty=true;r.queued=false;r.conflict=false;safeSave();status();}
function status(){const entries=Object.values(state.records);$('syncStatus').textContent=`${navigator.onLine?'Online':'Offline'} · ${entries.filter(r=>r.queued).length} zum Sync vorgemerkt · ${entries.filter(r=>r.dirty&&!r.queued).length} Entwürfe`;$('settingsButton').textContent=client?'GitHub verbunden':'GitHub verbinden';}
function field(label,type,value,change){const l=node('label',label),i=node('input');i.type=type;i.value=value??'';if(type==='number'){i.min='0';i.step=label==='kg'?'0.5':label==='RIR'?'0.5':'1';i.inputMode='decimal';}i.oninput=()=>{change(i.value);mark();};l.append(i);return l;}
function render(){
  const r=record();if(!r)return newWorkout();
  $('date').value=r.data.date;$('session').value=r.data.session_name;$('notes').value=r.data.notes||'';
  $('history').replaceChildren();
  Object.entries(state.records).sort(([a],[b])=>b.localeCompare(a)).forEach(([p,v])=>{const b=button(v.data.session_name||'Neues Training',()=>{state.current=p;safeSave();render();});b.className='historyItem'+(p===state.current?' active':'');b.append(node('small',`${v.data.date} · ${v.conflict?'Konflikt':v.queued?'Wartet auf Sync':v.dirty?'Entwurf':'Synchronisiert'}`));$('history').append(b);});
  $('exercises').replaceChildren();
  r.data.exercises.forEach((e,ei)=>{
    const card=node('div',undefined,'exercise'),head=node('div',undefined,'sectionTitle');head.append(node('h3',name(e.exercise_id)),button('Entfernen',()=>{e.sets.length&&download(e,'uebung-backup.json');r.data.exercises.splice(ei,1);mark();render();}));card.append(head);
    const l=node('label','Lastangabe'),sel=node('select');bases.forEach((v,i)=>{const o=node('option',['Gesamtgewicht','Pro Seite','Je Kurzhantel','Maschinenanzeige','Körpergewicht','Unbekannt'][i]);o.value=v;sel.append(o);});sel.value=e.load_basis;sel.onchange=()=>{e.load_basis=sel.value;mark();};l.append(sel);card.append(l);
    e.sets.forEach((s,si)=>{const row=node('div',undefined,'set');row.append(node('span',String(si+1)));for(const [label,k] of [['kg','weight_kg'],['Wdh.','reps'],['RIR','rir']])row.append(field(label,'number',s[k],v=>{if(k==='rir'&&v==='')delete s[k];else s[k]=v===''?null:Number(v);}));row.append(button('×',()=>{e.sets.splice(si,1);e.sets.forEach((s,i)=>s.index=i+1);mark();render();}));card.append(row);});
    card.append(button('＋ Satz',()=>{e.sets.push({index:e.sets.length+1,weight_kg:null,reps:null});mark();render();}));
    for(const [label,k]of [['Übungsnotiz','notes'],['Nächstes Mal (Empfehlung)','next_time']])card.append(field(label,'text',e[k],v=>{if(v)e[k]=v;else delete e[k];}));
    if(e.sets.some(s=>s.is_warmup||s.notes))card.append(node('p','Importierte Aufwärm-Markierungen und Satznotizen bleiben erhalten.','muted'));
    $('exercises').append(card);
  });
  $('setCount').textContent=r.data.exercises.reduce((n,e)=>n+e.sets.length,0)+' Sätze';status();renderConflicts();
}
$('session').oninput=()=>{record().data.session_name=$('session').value;mark();};
$('notes').oninput=()=>{const v=$('notes').value;if(v)record().data.notes=v;else delete record().data.notes;mark();};
$('date').onchange=()=>guard(()=>{const d=$('date').value,r=record(),p=pathFor(d);if(!/^\d{4}-\d{2}-\d{2}$/.test(d))throw Error('Datum fehlt');if(r.baseSha||r.queued){$('date').value=r.data.date;throw Error('Datum synchronisierter/vorgemerkter Einheiten bleibt fest.');}if(p!==state.current&&state.records[p]){$('date').value=r.data.date;throw Error('Für dieses Datum existiert bereits ein Training.');}delete state.records[state.current];state.records[p]=r;state.current=p;r.data.date=d;mark();render();});
catalog.exercises.forEach(e=>{const o=node('option',e.name_de);o.value=e.id;$('exerciseChoice').append(o);});
$('addExercise').onclick=()=>{record().data.exercises.push({exercise_id:$('exerciseChoice').value,load_basis:'unknown',sets:[]});mark();render();};
$('new').onclick=newWorkout;
$('finish').onclick=()=>guard(async()=>{validate(record().data,schema);record().queued=true;record().dirty=true;persist();render();if(client&&navigator.onLine)await sync();});
function download(data,filename){const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'})),a=node('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('export').onclick=()=>download({format:'gym-tracker-backup-v02',records:Object.values(state.records).map(r=>({data:r.data,baseSha:r.baseSha,queued:r.queued}))},'gym-tracker-backup.json');
$('import').onchange=()=>guard(async()=>{
  const file=$('import').files[0];if(!file)return;
  const data=JSON.parse(await file.text()),backup=data.format==='gym-tracker-backup-v02',list=backup?data.records:[{data,baseSha:null,queued:false}];
  if(!Array.isArray(list))throw Error('Backup enthält keine Trainingsliste');
  const dates=new Set();
  for(const item of list){const w=item.data;(backup?validateDraft:validate)(w,schema);if(w.environment==='test')throw Error('Testdaten werden nicht in die Trainingshistorie importiert');if(dates.has(w.date))throw Error('Doppeltes Datum im Import');dates.add(w.date);if(item.queued)validate(w,schema);const old=state.records[pathFor(w.date)];if(old&&(old.data.session_name||old.data.exercises.length||old.data.notes||old.baseSha))throw Error('Import gestoppt: Datum bereits vorhanden. Bestehende Einheiten zuerst prüfen.');}
  for(const item of list){const w=item.data;state.current=pathFor(w.date);state.records[state.current]={data:w,baseSha:/^[a-f0-9]{40}$/.test(item.baseSha||'')?item.baseSha:null,dirty:true,queued:!!item.queued};}
  persist();render();$('import').value='';
});
$('settingsButton').onclick=()=>$('settings').showModal();
$('disconnect').onclick=()=>{client=null;$('token').value='';$('connectionStatus').textContent='Token vergessen.';status();};
async function pull(){
  const tree=await client.api('/git/trees/main?recursive=1');if(tree.truncated)throw Error('Historie zu groß: unvollständiger Dateibaum, Abruf gestoppt.');
  const paths=tree.tree.filter(e=>e.type==='blob'&&/^workouts\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}\.json$/.test(e.path));
  for(const {path,sha}of paths){const local=state.records[path];if(local?.baseSha===sha)continue;const remote=await client.read(path);if(!remote)continue;validate(remote.data,schema);if(pathFor(remote.data.date)!==path)throw Error('Datum und Archivpfad passen nicht zusammen');if(remote.data.environment==='test')continue;if(local?.dirty){if(local.baseSha!==remote.sha)local.conflict=true;}else state.records[path]={data:remote.data,baseSha:remote.sha,dirty:false,queued:false};persist();}
}
$('connect').onclick=()=>guard(async()=>{if(busy)return;busy=true;$('connect').disabled=true;try{const token=$('token').value.trim();$('token').value='';if(!token)throw Error('Bitte Token eingeben');client=new GitHub(token);await client.verify();await pull();$('connectionStatus').textContent='Verbunden. Historie lokal verfügbar.';render();}catch(e){client=null;$('connectionStatus').textContent=e.message;throw e;}finally{busy=false;$('connect').disabled=false;}await sync();});
async function sync(){if(busy)return;if(!client){$('settings').showModal();return;}if(!navigator.onLine){status();return;}busy=true;$('sync').disabled=true;try{
  await client.verify();
  for(const [path,entry] of Object.entries(state.records)){
    if(!entry.queued||entry.conflict)continue;
    const snapshot=clone(entry);validate(snapshot.data,schema);if(snapshot.data.environment==='test')throw Error('Testdaten dürfen nicht unter workouts gespeichert werden.');
    try{const sha=await client.push(path,snapshot);entry.baseSha=sha;if(JSON.stringify(entry.data)===JSON.stringify(snapshot.data)){entry.dirty=false;entry.queued=false;}entry.conflict=false;persist();}
    catch(e){if(e.conflict){entry.conflict=true;persist();}else throw e;}
  }
  await pull();render();$('syncStatus').textContent=Object.values(state.records).some(r=>r.conflict)?'Konflikt: Bitte Versionen prüfen.':'✓ Synchronisierung abgeschlossen';
}finally{busy=false;$('sync').disabled=false;}}
function renderConflicts(){const entries=Object.entries(state.records).filter(([,r])=>r.conflict);$('conflicts').hidden=!entries.length;$('conflictItems').replaceChildren();for(const [path,r]of entries){const box=node('div');box.append(node('p',`${r.data.date} · ${r.data.session_name}`),button('Beide Versionen exportieren',async()=>{const remote=await client?.read(path);if(!client)throw Error('Bitte zuerst GitHub verbinden');download({local:r.data,github:remote?.data??null},'konflikt-'+r.data.date+'.json');}),button('GitHub-Version übernehmen',async()=>{if(!client)throw Error('Bitte zuerst GitHub verbinden');const remote=await client.read(path);if(!remote)throw Error('Datei auf GitHub fehlt. Lokales Backup exportieren.');validate(remote.data,schema);download(r.data,'lokale-version-'+r.data.date+'.json');state.records[path]={data:remote.data,baseSha:remote.sha,dirty:false,queued:false};persist();render();}),button('Lokale Version nach Prüfung vormerken',async()=>{if(!client)throw Error('Bitte zuerst GitHub verbinden');const remote=await client.read(path);download({local:r.data,github:remote?.data??null},'vor-konfliktaufloesung-'+r.data.date+'.json');if(!confirm('Die aktuelle GitHub-Version durch deine lokale Version ersetzen? Ein Backup beider Versionen wurde heruntergeladen.'))return;r.baseSha=remote?.sha??null;r.conflict=false;r.queued=true;persist();render();}));$('conflictItems').append(box);}}
$('sync').onclick=()=>guard(sync);window.addEventListener('online',()=>{status();if(client)guard(sync);});window.addEventListener('offline',status);
window.addEventListener('storage',e=>{if(e.key===key){client=null;writable=false;$('saveStatus').textContent='Anderer Tab hat gespeichert. Bitte diese Seite neu laden.';document.querySelectorAll('input,textarea,select,button').forEach(n=>n.disabled=true);}});
setInterval(()=>{if(client&&navigator.onLine)guard(sync);},60000);
render();
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>$('saveStatus').textContent='Offline-App-Cache nicht verfügbar; lokales Speichern bleibt aktiv.');
if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
