/* PWA cache v12: network-first navigation, versioned same-origin assets, never cache remote lottery records. */
const CACHE='dual-lottery-v13.0.0';
const ASSETS=['./','./index.html','./styles.css?v=13.0','./core.js?v=13.0','./engine.js?v=13.0','./app.js?v=13.0','./official_latest.json','./health.json','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if((u.pathname.endsWith('/history.json')||u.pathname.endsWith('/research.json')||u.pathname.endsWith('/health.json'))){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return}
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n.ok)caches.open(CACHE).then(c=>c.put(e.request,n.clone()));return n})));});
