/* Service worker mínimo (pass-through).
 *
 * Propósito: que el sitio sea instalable como PWA. Chrome Android solo
 * permite audio/voz SIN gesto del usuario cuando la aplicación está
 * instalada (agregada a la pantalla de inicio) y se abre desde ahí; por eso
 * el turnero necesita ser instalable.
 *
 * No cachea NADA: todas las peticiones van directo a la red, para no
 * interferir con los datos en tiempo real del turnero.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => new Response('', { status: 503, statusText: 'Service Unavailable' }))
  );
});
