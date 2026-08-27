/**
 * Entorno para Capacitor (Android/iOS).
 *
 * Usa URLs absolutas porque en la APK no hay proxy de desarrollo.
 * La URL del backend debe ser accesible desde el dispositivo móvil.
 */
export const environment = {
  production: true,
  apiUrl: 'https://cola-cat.clinicanuevacaracas.net/api',
  socketUrl: 'https://cola-cat.clinicanuevacaracas.net',
  socketTransports: ['websocket', 'polling'] as const,
};
