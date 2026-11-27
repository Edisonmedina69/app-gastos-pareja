/* Transición única desde el SW `autoUpdate` anterior (lo inyectaba registerSW.js).
 * Esa versión no muestra el aviso ni envía SKIP_WAITING, así que el SW nuevo
 * quedaría en espera indefinidamente y la PWA seguiría sirviendo el bundle viejo.
 * Solo si el precache activo todavía contiene registerSW.js se activa sin esperar. */
self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    if (!self.registration.active) return;
    const nombres = await caches.keys();
    for (const nombre of nombres.filter((n) => n.startsWith('workbox-precache'))) {
      const claves = await (await caches.open(nombre)).keys();
      if (claves.some((r) => new URL(r.url).pathname.endsWith('/registerSW.js'))) {
        await self.skipWaiting();
        return;
      }
    }
  })());
});
