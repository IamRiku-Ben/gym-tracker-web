import {planPath,validatePlans} from './training-plans.js?v=0.4.0';
export async function ensureExerciseRegistry(client,exerciseIds,byId){
 const remote=await client.read('data/exercises.json');
 if(!remote||remote.data.schema_version!=='1.0'||!Array.isArray(remote.data.exercises))throw Error('Privater Übungskatalog fehlt oder hat ein unbekanntes Format.');
 const existing=new Set(remote.data.exercises.map(e=>e.id));
 if(existing.size!==remote.data.exercises.length)throw Error('Doppelte IDs im privaten Übungskatalog.');
 const missing=[...new Set(exerciseIds)].filter(id=>!existing.has(id));if(!missing.length)return;
 const data=structuredClone(remote.data),groupNames={Arme:'arms',Bauch:'core',Beine:'legs',Brust:'chest','Rücken':'back',Schulter:'shoulders'};
 for(const id of missing){const meta=byId.get(id);if(!meta)throw Error('Unbekannte Übung im lokalen Plan: '+id);const group=meta.groups?.map(g=>groupNames[g]).find(Boolean);data.exercises.push({id,name_de:meta.de,name_en:meta.en,...(group?{muscle_group:group}:{})});}
 await client.push('data/exercises.json',{data,baseSha:remote.sha},'Add exercise identifiers for training plans');
}
export async function syncPlanRecord(client,record,byId){
 validatePlans(record.data,byId);
 try{
  if(record.conflict)return record;
  if(record.dirty){const sha=await client.push(planPath,{data:record.data,baseSha:record.baseSha??null},'Update training plans');return {...record,baseSha:sha,dirty:false,conflict:false};}
  const remote=await client.read(planPath);
  if(remote){validatePlans(remote.data,byId);return {...record,data:remote.data,baseSha:remote.sha,dirty:false,conflict:false,revision:(record.revision||0)+(JSON.stringify(record.data)!==JSON.stringify(remote.data)?1:0)};}
  if(record.baseSha)return {...record,conflict:true};
  const sha=await client.push(planPath,{data:record.data,baseSha:null},'Save training plans');return {...record,baseSha:sha,dirty:false};
 }catch(e){if(e.conflict)return {...record,conflict:true};throw e;}
}
