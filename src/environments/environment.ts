/**
 * ============================================================
 * ENTORNO DE DESARROLLO (por defecto)
 * ============================================================
 * Se usa con: ng serve (sin --configuration)
 * Rutas relativas: el proxy.conf.js redirige /api al backend.
 *
 * ARCHIVOS DE ENTORNO - CUÁL USAR EN CADA CASO:
 * ─────────────────────────────────────────────
 * environment.ts          → Desarrollo local (ng serve)
 * environment.prod.ts     → Producción web (ng build --configuration production)
 * environment.capacitor.ts → App móvil (ng build --configuration capacitor)
 *   ↳ Se genera automáticamente desde .env.capacitor
 *   ↳ Ejecutar: npm run build:capacitor
 * environment.capacitor.dev.ts → App móvil en desarrollo (emulador/dispositivo local)
 *   ↳ Se usa con: ng build --configuration capacitor-dev
 * ============================================================
 */
export const environment = {
  production: false,
  apiUrl: '/api',
  socketUrl: '/',
  socketTransports: ['polling', 'websocket'] as const,
};
