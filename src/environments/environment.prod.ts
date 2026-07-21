export const environment = {
  production: true,
  apiUrl: 'https://api-cola-cat.clinicanuevacaracas.net/api',
  socketUrl: 'https://api-cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling'] as const,
  apiUrl: '/api',
  socketUrl: 'https://api-cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling', 'websocket'] as const,
};
