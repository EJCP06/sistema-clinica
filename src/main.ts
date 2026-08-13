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
