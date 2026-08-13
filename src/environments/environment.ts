/**
 * Entorno de DESARROLLO.
 *
 * Las llamadas HTTP y WebSocket van por rutas relativas ('/api' y '/')
 * porque en desarrollo el servidor de Angular (ng serve) redirige esas
 * rutas al backend mediante proxy.conf.js. Así el frontend funciona igual
 * en local y en producción (detrás de Nginx) sin cambiar URLs.
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  socketUrl: '/',
  socketTransports: ['polling', 'websocket'] as const,
};
