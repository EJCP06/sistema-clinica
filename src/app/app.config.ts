import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideOverlay } from '@angular/cdk/overlay';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import es from '@angular/common/locales/es';
import { authInterceptor } from '@core/interceptors/auth.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { retryInterceptor } from '@core/interceptors/retry.interceptor';
import { zoneInterceptor } from '@core/interceptors/zone.interceptor';

import { routes } from './app.routes';

registerLocaleData(es);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideOverlay(),
    provideHttpClient(withInterceptors([authInterceptor, retryInterceptor, zoneInterceptor, errorInterceptor])),
    { provide: LOCALE_ID, useValue: 'es' },
  ],
};
