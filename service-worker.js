self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open('wt-v1').then(cache=>cache.addAll([
    './','./index.html','./styles.css','./app.js',
    './manifest.json','./icons/icon-192.png','./icons/icon-512.png',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js'
  ])));
});
self.addEventListener('activate', (e)=>{self.clients.claim()});
self.addEventListener('fetch', (e)=>{
  e.respondWith(caches.match(e.request).then(r=> r || fetch(e.request)));
});
// Push handler placeholder (requires OneSignal/FCM setup)
self.addEventListener('push', event=>{
  const data = event.data ? event.data.json() : {title:'Reminder', body:'Time to log your weight!'};
  event.waitUntil(self.registration.showNotification(data.title, {body:data.body, icon:'./icons/icon-192.png'}));
});
