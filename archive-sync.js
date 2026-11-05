import {GitHub,pathFor,validate} from './core.js?v=0.6.0';
import {workoutFromSession,isSameWorkout,sessionFromWorkout} from './form-model.js?v=0.6.0';
export class ArchiveSync {
  constructor({get,all,put,flush,onSaved,schema,byId}){Object.assign(this,{get,all,put,flush,onSaved,schema,byId});this.client=null;this.busy=false;}
  async connect(token){const client=new GitHub(token);await client.verify();this.client=client;}
  disconnect(){this.client=null;}
  async pull(){
    const tree=await this.client.api('/git/trees/main?recursive=1');
    if(tree.truncated)throw Error('GitHub-Dateiliste unvollständig. Abruf gestoppt.');
    for(const file of tree.tree.filter(f=>f.type==='blob'&&/^workouts\/\d{4}\/\d{2}\/\d{4}-\d{2}-\d{2}\.json$/.test(f.path))){
      const day=file.path.split('/').at(-1).slice(0,-5),meta=await this.get('settings','sha:'+day);
      if(meta?.sha===file.sha)continue;
      const remote=await this.client.read(file.path);if(!remote)continue;
      validate(remote.data,this.schema);if(remote.data.environment==='test')continue;
      if(pathFor(remote.data.date)!==file.path)throw Error('Datum passt nicht zum Archivpfad.');
      await this.flush();const local=await this.get('sessions',day);
      if(local&&local.baseSha!==remote.sha&&local.touched===false&&!local.syncPending){
        const adopted=sessionFromWorkout(remote.data,this.byId,remote.sha);await this.put('sessions',adopted);this.onSaved(adopted);
      }else if(local&&local.baseSha!==remote.sha){
        // Never silently replace a local form, including uncompleted planned sets.
        local.conflict=true;await this.put('sessions',local);this.onSaved(local);
      }
      await this.put('history',remote.data);await this.put('settings',{key:'sha:'+day,sha:remote.sha});
    }
  }
  async sync(){
    if(this.busy)return; if(!this.client)throw Error('Bitte unter Einstellungen GitHub verbinden.');
    this.busy=true;
    try{
      await this.flush();await this.client.verify();
      for(const snapshot of await this.all('sessions')){
        if(!snapshot.syncPending||snapshot.conflict)continue;
        const data=workoutFromSession(snapshot);validate(data,this.schema);if(data.environment==='test')throw Error('Testdaten werden nicht ins echte Trainingsarchiv hochgeladen.');
        try{
          const sha=await this.client.push(pathFor(snapshot.date),{data,baseSha:snapshot.baseSha??null});
          await this.flush();const latest=await this.get('sessions',snapshot.date);if(!latest)continue;
          latest.baseSha=sha;latest.conflict=false;
          if(isSameWorkout(workoutFromSession(latest),data)&&latest.updatedAt===snapshot.updatedAt){latest.syncPending=false;latest.touched=false;}
          await this.put('sessions',latest);this.onSaved(latest);
          await this.put('settings',{key:'sha:'+snapshot.date,sha});await this.put('history',data);
        }catch(e){if(!e.conflict)throw e;await this.flush();const latest=await this.get('sessions',snapshot.date);latest.conflict=true;await this.put('sessions',latest);this.onSaved(latest);}
      }
      await this.pull();
    }finally{this.busy=false;}
  }
}
