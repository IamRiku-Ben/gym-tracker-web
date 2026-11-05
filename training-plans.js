export const symbols=['🏋️','💪','🦵','🦾','🔥','⚡','🎯','🧘','🚴','🏃','🧗','🥊','🌿','⭐','🔵','🟢'];
export const weekOrder=[1,2,3,4,5,6,0];
export const planPath='data/training-plans.json';
const bases=['total','per_side','dumbbell_each','machine_display','bodyweight','unknown'];
export function defaultPlanData(legacy,byId){
 return {format:'gym-training-plans',version:1,units:Object.entries(legacy).map(([day,p])=>({id:'unit_'+day,name:p.name,icon:({'1':'💪','2':'🦾','3':'🦵','4':'🏋️','5':'🔥','6':'⚡'})[day],description:p.subtitle,weekdays:[+day],exercises:p.ids.map(id=>({exerciseId:id,setCount:3,targetReps:'',restSeconds:byId.get(id)?.rest||90,basis:byId.get(id)?.basis||'unknown',optional:!!p.optional?.includes(id)}))}))};
}
export function validatePlans(data,byId){
 const fail=message=>{throw Error('Trainingsplan: '+message)};
 if(!data||data.format!=='gym-training-plans'||data.version!==1||!Array.isArray(data.units)||data.units.length>50)fail('Dateiformat ungültig.');
 const ids=new Set(),assigned=new Set();
 for(const u of data.units){
  if(!u||typeof u.id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(u.id)||ids.has(u.id))fail('Einheiten-ID ungültig oder doppelt.');ids.add(u.id);
  if(typeof u.name!=='string'||!u.name.trim()||u.name.length>80)fail('Bitte einen Namen mit höchstens 80 Zeichen eingeben.');
  if(!symbols.includes(u.icon))fail('Bitte ein Symbol auswählen.');
  if(typeof u.description!=='string'||u.description.length>500)fail('Beschreibung zu lang.');
  if(!Array.isArray(u.weekdays)||u.weekdays.length>7||u.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6))fail('Wochentage ungültig.');
  for(const day of u.weekdays){if(assigned.has(day))fail('Ein Wochentag ist mehreren Einheiten zugeordnet.');assigned.add(day);}
  if(!Array.isArray(u.exercises)||!u.exercises.length||u.exercises.length>40)fail('Bitte 1 bis 40 Übungen auswählen.');
  const seen=new Set();
  for(const e of u.exercises){
   if(!e||!byId.has(e.exerciseId)||seen.has(e.exerciseId))fail('Übung unbekannt oder doppelt.');seen.add(e.exerciseId);
   if(!Number.isInteger(e.setCount)||e.setCount<1||e.setCount>20)fail('Satzanzahl muss zwischen 1 und 20 liegen.');
   if(typeof e.targetReps!=='string'||e.targetReps.length>40)fail('Wiederholungsziel zu lang.');
   if(!Number.isInteger(e.restSeconds)||e.restSeconds<0||e.restSeconds>900)fail('Pause muss zwischen 0 und 900 Sekunden liegen.');
   if(!bases.includes(e.basis)||typeof e.optional!=='boolean')fail('Lastangabe oder Übungsoption ungültig.');
  }
 }
 return data;
}
export function scheduledUnit(data,date){const day=new Date(date+'T12:00:00').getDay();return data.units.find(u=>u.weekdays.includes(day))||null;}
export function saveUnit(data,unit,byId){
 const next=structuredClone(data),edited=structuredClone(unit);edited.name=edited.name.trim();
 next.units=next.units.map(u=>u.id===edited.id?edited:{...u,weekdays:u.weekdays.filter(day=>!edited.weekdays.includes(day))});
 if(!next.units.some(u=>u.id===edited.id))next.units.push(edited);
 return validatePlans(next,byId);
}
export function newUnit(id){return {id,name:'',icon:'🏋️',description:'',weekdays:[],exercises:[]};}
export function validateEditorDraft(draft,byId){
 if(draft===null)return null;
 const u=draft?.unit;
 if(!u||!Number.isInteger(draft.baseRevision)||draft.baseRevision<0||typeof u.id!=='string'||!/^[a-z0-9_-]{1,80}$/.test(u.id)||typeof u.name!=='string'||u.name.length>80||!symbols.includes(u.icon)||typeof u.description!=='string'||u.description.length>500||!Array.isArray(u.weekdays)||new Set(u.weekdays).size!==u.weekdays.length||u.weekdays.some(d=>!Number.isInteger(d)||d<0||d>6)||!Array.isArray(u.exercises)||u.exercises.length>40)throw Error('Ungültiger Plan-Editorentwurf.');
 const ids=new Set();for(const e of u.exercises){if(!e||!byId.has(e.exerciseId)||ids.has(e.exerciseId)||!Number.isFinite(e.setCount)||!Number.isFinite(e.restSeconds)||!bases.includes(e.basis)||typeof e.optional!=='boolean'||typeof e.targetReps!=='string'||e.targetReps.length>40)throw Error('Ungültige Übung im Plan-Editorentwurf.');ids.add(e.exerciseId);}
 return draft;
}
export function sessionForUnit(day,unit,byId,previous=()=>null){
 const now=new Date().toISOString();
 return {date:day,unitId:unit?.id||null,unitIcon:unit?.icon||'🌿',unitDescription:unit?.description||'Erholung und Regeneration',planSnapshot:structuredClone(unit),planSignature:JSON.stringify(unit),sessionName:unit?.name||'Ruhetag',status:'draft',touched:false,syncPending:false,notes:'',createdAt:now,updatedAt:now,exercises:(unit?.exercises||[]).map(entry=>{
  const prev=previous(entry.exerciseId,day,entry.basis)?.exercise;
  return {id:entry.exerciseId,basis:entry.basis,enabled:!entry.optional,restSeconds:entry.restSeconds,targetReps:entry.targetReps,notes:'',sets:Array.from({length:entry.setCount},(_,i)=>({id:i+1,kg:prev?.sets[i]?.weight_kg??'',reps:prev?.sets[i]?.reps??'',done:false}))};
 })};
}
export function canRefreshTemplate(session){return session?.status==='draft'&&session.touched===false&&!session.syncPending&&!session.baseSha&&!session.manualUnitOverride&&!session.notes&&!session.exercises.some(e=>e.notes||e.sets.some(s=>s.done));}
export function recordPlanChange(record,data){return {...record,data:structuredClone(data),dirty:true,conflict:!!record.conflict,revision:(record.revision||0)+1};}
