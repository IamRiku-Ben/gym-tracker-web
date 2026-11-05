// Names and source categories come from the MODUSX directory. Variants keep
// their own historical IDs so dissimilar executions never share performance.
export function metadataLine(meta){
 return [...new Set([meta?.groups?.join(' · '),meta?.equipment?.join(' · '),meta?.variant,meta?.match==='general'?'Allgemeiner MODUSX-Eintrag':null].filter(Boolean))].join(' · ');
}
export function buildExerciseLibrary(catalog,directory,byId){
 const library=[...catalog],represented=new Set(catalog.map(e=>e.modusxId));
 for(const e of directory.exercises){
  if(!/^[a-z0-9_]+$/.test(e.id)||new URL(e.url).hostname!=='modusx.de')throw Error('Ungültige MODUSX-Übung');
  const meta={id:e.id,de:e.name,basis:'unknown',increment:2.5,rest:90,groups:e.groups,equipment:e.equipment,url:e.url,modusxId:e.id,match:'source',variant:''};
  // Keep mx IDs resolvable even when an existing historical ID represents it.
  if(!byId.has(meta.id))byId.set(meta.id,meta);
  if(!represented.has(e.id))library.push(meta);
 }
 return library.sort((a,b)=>a.de.localeCompare(b.de,'de')||a.variant.localeCompare(b.variant,'de'));
}
export function normalizeExerciseRegistry(original,exerciseIds,byId){
 if(original?.schema_version!=='1.0'||!Array.isArray(original.exercises))throw Error('Privater Übungskatalog fehlt oder hat ein unbekanntes Format.');
 const existing=new Set(original.exercises.map(e=>e.id));
 if(existing.size!==original.exercises.length)throw Error('Doppelte IDs im privaten Übungskatalog.');
 const data=structuredClone(original);
 for(const id of new Set(exerciseIds)){
  if(!byId.has(id))throw Error('Unbekannte Übung im lokalen Plan: '+id);
  if(!existing.has(id)){data.exercises.push({id});existing.add(id);}
 }
 for(const entry of data.exercises){
  const meta=byId.get(entry.id);if(!meta)continue;
  delete entry.name_en;
  delete entry.muscle_group;
  Object.assign(entry,{name_de:meta.de,muscle_groups:[...meta.groups||[]],equipment:[...meta.equipment||[]],source_url:meta.url,modusx_id:meta.modusxId,source_match:meta.match||'source',variant:meta.variant||''});
 }
 return data;
}
