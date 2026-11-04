/* PWA cache v17: network-first navigation, versioned same-origin assets, never cache remote lottery records. */
const CACHE='dual-lottery-v17.2-date-identity';
const ASSETS=['./issue-context.js?v=17.2','./','./index.html','./styles.css?v=17.2','./core.js?v=17.2','./engine.js?v=17.2','./app.js?v=17.2','./coverage.js?v=17.2','./multiwindow.js?v=17.2','./shape-engine.js?v=17.2','./shape-ui.js?v=17.2','./review-ui.js?v=17.2','./evidence.js?v=17.2','./multiwindow-ui.js?v=17.2','./official_latest.json','./icon.svg','./manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>e.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(x=>x!==CACHE).map(x=>caches.delete(x)))),self.clients.claim()])));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==self.location.origin)return;if((u.pathname.endsWith('/history.json')||u.pathname.endsWith('/research.json')||u.pathname.endsWith('/health.json'))){e.respondWith(fetch(e.request).catch(()=>caches.match(e.request)));return}
 if(e.request.mode==='navigate'){e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./index.html'))));return}
 e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(n=>{if(n.ok)caches.open(CACHE).then(c=>c.put(e.request,n.clone()));return n})));});
