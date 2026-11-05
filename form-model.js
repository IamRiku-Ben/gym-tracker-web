// Local form state is deliberately separate from the completed archive schema.
export function number(value){return typeof value==='number'?value:Number(String(value).replace(',','.'));}
export function workoutFromSession(session,environment='production'){
  if(session.testOnly)environment='test';
  const data=structuredClone(session.sourceWorkout||{});
  Object.assign(data,{schema_version:'1.0',environment,date:session.date,timezone:'Europe/Berlin',session_name:session.sessionName,notes:session.notes});
  if(environment!=='test')delete data.test_run_id;
  data.exercises=session.exercises.filter(e=>e.enabled&&e.sets.some(s=>s.done)).map(e=>{
    const original=structuredClone(e.sourceExercise||{});
    return {...original,exercise_id:e.id,load_basis:e.basis,notes:e.notes,sets:e.sets.filter(s=>s.done).map((s,i)=>({...structuredClone(s.sourceSet||{}),index:i+1,weight_kg:number(s.kg),reps:number(s.reps)}))};
  });
  return data;
}
export function sessionFromWorkout(workout,byId,baseSha=null){
  const now=new Date().toISOString();
  return {date:workout.date,sessionName:workout.session_name,status:'completed',notes:workout.notes||'',createdAt:now,updatedAt:now,baseSha,syncPending:false,touched:false,testOnly:workout.environment==='test',sourceWorkout:structuredClone(workout),exercises:workout.exercises.map(e=>({id:e.exercise_id,basis:e.load_basis,enabled:true,restSeconds:byId.get(e.exercise_id)?.rest||90,notes:e.notes||'',sourceExercise:structuredClone(e),sets:e.sets.map((s,i)=>({id:i+1,kg:s.weight_kg,reps:s.reps,done:true,sourceSet:structuredClone(s)}))}))};
}
export function isSameWorkout(a,b){return JSON.stringify(a)===JSON.stringify(b);}
