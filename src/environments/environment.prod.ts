// src/environments/environment.prod.ts
export const environment = {
  production: true,
  apiUrl: '/api',
  socketUrl: '/',
  socketTransports: ['polling'] as const,
};