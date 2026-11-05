export function previousExerciseFrom(history,id,beforeDate,basis,byId){
 const wanted=byId.get(id);
 const equivalent=other=>{if(other===id)return true;const meta=byId.get(other);return wanted?.match==='source'&&!wanted.variant&&meta?.match==='source'&&!meta.variant&&wanted.modusxId===meta.modusxId;};
 for(const workout of [...history].sort((a,b)=>b.date.localeCompare(a.date))){
  if(workout.environment==='test'||workout.date>=beforeDate)continue;
  const candidates=workout.exercises.filter(e=>(!basis||e.load_basis===basis)&&equivalent(e.exercise_id));
  const exercise=candidates.find(e=>e.exercise_id===id)||candidates[0];
  const sets=exercise?.sets.filter(s=>!s.is_warmup);
  if(sets?.length)return {date:workout.date,exercise:{...exercise,sets}};
 }
 return null;
}
// Refresh untouched suggestions after loading history; never overwrite inputs,
// completed sets, or archived sessions. Suggestions are always unchecked.
export function prefillPreviousSets(session,previous){
 if(session.status!=='draft'||session.touched!==false||session.baseSha||session.syncPending||session.notes||session.exercises.some(e=>e.notes||e.sets.some(s=>s.done)))return session;
 const next=structuredClone(session);
 for(const e of next.exercises){const old=previous(e.id,next.date,e.basis)?.exercise;for(const [i,s]of e.sets.entries()){s.kg=old?.sets[i]?.weight_kg??'';s.reps=old?.sets[i]?.reps??'';}}
 return next;
}
