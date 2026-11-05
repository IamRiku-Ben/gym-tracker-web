import {planPath,validatePlans} from './training-plans.js?v=0.6.0';
import {normalizeExerciseRegistry} from './exercise-metadata.js?v=0.6.0';
export async function ensureExerciseRegistry(client,exerciseIds,byId){
 const remote=await client.read('data/exercises.json');
 const data=normalizeExerciseRegistry(remote?.data,exerciseIds,byId);
 if(JSON.stringify(data)===JSON.stringify(remote.data))return;
 await client.push('data/exercises.json',{data,baseSha:remote.sha},'Normalize exercise names and metadata from MODUSX');
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
