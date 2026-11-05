const CACHE='gym-app-mobile-v03-1';
const FILES=['./','./index.html','./form.css','./mobile.js','./catalog.js','./form-model.js','./archive-sync.js','./core.js','./workout.schema.json','./manifest.webmanifest','./icon.svg'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES))));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('gym-app-')&&k!==CACHE).map(k=>caches.delete(k))))));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const url=new URL(e.request.url);if(url.origin!==self.location.origin)return;const allowed=FILES.map(p=>new URL(p,self.registration.scope).href);if(!allowed.includes(url.href))return;e.respondWith(caches.open(CACHE).then(async c=>(await c.match(e.request))||fetch(e.request)));});
