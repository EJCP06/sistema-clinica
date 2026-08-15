/**
 * Punto de entrada del frontend (Angular 21 standalone).
 *
 * Arranca la aplicación con bootstrapApplication (sin NgModules, todo con
 * componentes/pipes standalone). La configuración global (rutas, interceptors,
 * locale) está en app.config.ts. Si el arranque falla, el error se muestra
 * en consola para diagnóstico.
 */
import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';

bootstrapApplication(App, appConfig).catch((err) => console.error(err));

// Registra el service worker mínimo (PWA). Se necesita para que el sitio sea
// instalable y Chrome Android permita la voz del turnero SIN gesto del usuario
// (el autoplay con sonido solo se habilita en apps instaladas).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Si el SW no se puede registrar (p. ej. http local), el sistema
         funciona igual: solo se pierde la instalabilidad PWA. */
    });
  });
}
