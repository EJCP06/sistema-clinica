// src/environments/environment.ts
export const environment = {
  production: false,
  apiUrl: 'https://api-cola-cat.clinicanuevacaracas.net/api',
  socketUrl: 'https://api-cola-cat.clinicanuevacaracas.net',
  socketTransports: ['polling'] as const,
};