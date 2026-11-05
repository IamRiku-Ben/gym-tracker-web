// In-page dialogs keep destructive-action feedback usable in embedded browsers.
export function createConfirmation(onOpen=()=>{},onClose=()=>{}){
 return message=>new Promise(resolve=>{
  onOpen();const previous=document.activeElement,overlay=document.createElement('div'),panel=document.createElement('section');
  overlay.className='confirm-overlay';panel.className='confirm-panel';panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','action-confirm-title');
  const title=document.createElement('h2');title.id='action-confirm-title';title.textContent='Änderung bestätigen';const copy=document.createElement('p');copy.textContent=message;const actions=document.createElement('div');actions.className='sync-buttons';
  const cancel=document.createElement('button');cancel.className='button outline';cancel.textContent='Abbrechen';const yes=document.createElement('button');yes.className='button primary';yes.textContent='Bestätigen';let finished=false;
  const done=value=>{if(finished)return;finished=true;document.removeEventListener('keydown',key);overlay.remove();onClose();previous?.focus?.();resolve(value);};
  const key=event=>{if(event.key==='Escape'){event.preventDefault();done(false);}if(event.key==='Tab'){event.preventDefault();(document.activeElement===cancel?yes:cancel).focus();}};
  cancel.onclick=()=>done(false);yes.onclick=()=>done(true);actions.append(cancel,yes);panel.append(title,copy,actions);overlay.append(panel);document.body.append(overlay);document.addEventListener('keydown',key);cancel.focus();
 });
}
