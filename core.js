export const bases=['total','per_side','dumbbell_each','machine_display','bodyweight','unknown'];
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const pathFor=date=>`workouts/${date.slice(0,4)}/${date.slice(5,7)}/${date}.json`;
export function validateDraft(value,schema){
  const draft=structuredClone(value),rules=structuredClone(schema);
  rules.properties.session_name.minLength=0;rules.properties.exercises.minItems=0;rules.$defs.exercise.properties.sets.minItems=0;
  for(const e of draft.exercises||[])for(const s of e.sets||[])for(const k of ['reps','weight_kg'])if(s[k]===null)s[k]=0;
  validate(draft,rules);return value;
}
export function validate(value,schema,root=schema,path='$') {
  if(schema.$ref) schema=schema.$ref.slice(2).split('/').reduce((o,k)=>o[k],root);
  const fail=()=>{throw new Error(`Ungültige Trainingsdaten: ${path}`)};
  if(schema.const!==undefined&&value!==schema.const) fail();
  if(schema.enum&&!schema.enum.includes(value)) fail();
  if(schema.type==='object') {
    if(!value||typeof value!=='object'||Array.isArray(value)) fail();
    for(const k of schema.required||[]) if(!(k in value)) fail();
    for(const [k,v] of Object.entries(value)) {if(!schema.properties[k]&&schema.additionalProperties===false) fail();if(schema.properties[k])validate(v,schema.properties[k],root,`${path}.${k}`);}
  }
  if(schema.type==='array') {if(!Array.isArray(value)||value.length<(schema.minItems||0))fail();value.forEach((v,i)=>validate(v,schema.items,root,`${path}[${i}]`));}
  if(schema.type==='string') {
    if(typeof value!=='string'||value.length<(schema.minLength||0)||schema.pattern&&!new RegExp(schema.pattern).test(value))fail();
    if(schema.format==='date'&&(!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value))fail();
  }
  if(['number','integer'].includes(schema.type)&&(!Number.isFinite(value)||schema.type==='integer'&&!Number.isInteger(value)||value<(schema.minimum??-Infinity)||value>(schema.maximum??Infinity)))fail();
  if(schema.type==='boolean'&&typeof value!=='boolean')fail();
  return value;
}
export const encode=value=>btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(value,null,2)+'\n')));
export const decode=value=>JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value.replace(/\s/g,'')),c=>c.charCodeAt(0))));
export class GitHub {
  constructor(token,request=fetch){this.token=token;this.request=request;}
  async api(route,method='GET',body){
    const r=await this.request('https://api.github.com/repos/IamRiku-Ben/gym-training-log'+route,{method,cache:'no-store',headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${this.token}`,'X-GitHub-Api-Version':'2022-11-28',...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
    if(r.status===404&&method==='GET'&&route.startsWith('/contents/'))return null;
    if(!r.ok){const e=new Error(({401:'Token ungültig oder abgelaufen',403:'Keine Berechtigung oder API-Limit',404:'Repository nicht erreichbar',409:'GitHub-Konflikt',422:'Datei zwischenzeitlich geändert'})[r.status]||`GitHub-Fehler ${r.status}`);e.status=r.status;throw e;}
    return r.json();
  }
  async verify(){const r=await this.api('');if(r.visibility!=='private')throw new Error('Sync nur mit privatem Trainingsrepository erlaubt');}
  async read(path){const r=await this.api('/contents/'+path+'?ref=main');return r?{sha:r.sha,data:decode(r.content)}:null;}
  async push(path,entry,message=`Training ${entry.data.date}`){
    const remote=await this.read(path);
    if(JSON.stringify(remote?.data)===JSON.stringify(entry.data))return remote.sha;
    if((remote?.sha??null)!==entry.baseSha){const e=new Error('Konflikt: Auf GitHub liegt eine andere Version.');e.conflict=true;throw e;}
    try {
      const r=await this.api('/contents/'+path,'PUT',{branch:'main',message,content:encode(entry.data),...(entry.baseSha?{sha:entry.baseSha}:{})});
      const check=await this.read(path);
      if(check?.sha!==r.content.sha)throw new Error('Upload nicht bestätigt; bleibt in Warteschlange.');
      return check.sha;
    }catch(e){if([409,422].includes(e.status))e.conflict=true;throw e;}
  }
}
