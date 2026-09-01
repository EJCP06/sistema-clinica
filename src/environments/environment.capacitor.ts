/**
 * Entorno para Capacitor (Android/iOS).
 *
 * Intenta primero el dominio público. Si no responde en 3 segundos,
 * cambia a la IP interna del servidor (funciona en la red de la clínica).
 */
export const environment = {
  production: true,
  apiUrl: 'https://cola-cat.clinicanuevacaracas.net/api',
  socketUrl: 'https://cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling', 'websocket'] as const,
  // Fallback: IP interna del servidor en la clínica
  apiUrlFallback: 'http://192.168.16.37:3001/api',
  socketUrlFallback: 'http://192.168.16.37:3001',
};
