// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
  socketUrl: 'https://api-cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling', 'websocket'] as const,
};