/**
 * Entorno para Capacitor (Android/iOS).
 *
 * Usa URLs absolutas porque en la APK no hay proxy de desarrollo.
 * La URL del backend debe ser accesible desde el dispositivo móvil.
 *
 * IMPORTANTE: CapacitorHttp está DESHABILITADO en capacitor.config.ts
 * porque intercepta las peticiones HTTP nativas y ROMPE el long-polling
 * de Socket.IO. Con CORS configurado en el servidor (https://localhost
 * en CORS_ORIGIN), el navegador maneja las peticiones correctamente.
 */
export const environment = {
  production: true,
  apiUrl: 'https://cola-cat.clinicanuevacaracas.net/api',
  socketUrl: 'https://cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling', 'websocket'] as const,
};
