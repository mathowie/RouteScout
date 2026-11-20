const PREFIX = 'route-scout-';
const VERSION = PREFIX + 'shell-68880df7d771986f';
const shell = [
  './', './index.html', './styles.css', './app.mjs', './route.mjs', './gps.mjs', './map.mjs',
  './demo.mjs', './demo-map.png', './icon.svg', './icon-192.png', './icon-512.png', './manifest.webmanifest',
];
const scoped = file => new URL(file, self.registration.scope).href;
const cacheable = new Set(shell.map(scoped));

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(shell.map(file => new Request(scoped(file), { cache: 'reload' })));
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== VERSION) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (request.mode === 'navigate' && [new URL('./', self.registration.scope).pathname,
      new URL('./index.html', self.registration.scope).pathname].includes(new URL(request.url).pathname) &&
      request.url.startsWith(self.registration.scope)) {
    event.respondWith(caches.open(VERSION).then(async cache => (await cache.match(scoped('./index.html'))) || fetch(request)));
  } else if (cacheable.has(request.url)) {
    event.respondWith(caches.open(VERSION).then(async cache => (await cache.match(request)) || fetch(request)));
  }
});
