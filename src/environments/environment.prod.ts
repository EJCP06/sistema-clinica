// src/environments/environment.prod.ts
/**
 * Entorno de PRODUCCIÓN (se activa con ng build --configuration production).
 *
 * Rutas relativas: en producción el frontend es servido por Nginx, que
 * redirige /api al backend (ver nginx.conf y docker-compose.yml).
 * `socketTransports` solo usa polling (HTTP long-polling) porque en algunos
 * entornos detrás de proxy el WebSocket falla con la infraestructura actual.
 */
export const environment = {
  production: true,
  apiUrl: '/api',
  socketUrl: '/',
  socketTransports: ['polling'] as const,
};