// Updated automatically before every Hosting deployment.
importScripts('/release.js');
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') event.waitUntil(self.skipWaiting());
});
// Requests go straight to the network; personnel data is never cached here.
