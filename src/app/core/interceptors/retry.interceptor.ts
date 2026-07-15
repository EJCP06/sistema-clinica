import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { retry } from 'rxjs/operators';
import { throwError, timer } from 'rxjs';

/**
 * Interceptor que reintenta peticiones GET hasta 3 veces
 * con 2s de espera. No reintenta errores 401, 403 ni 500+.
 */
export const retryInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.method !== 'GET') {
    return next(req);
  }

  return next(req).pipe(
    retry({
      count: 3,
      delay: (error) => {
        if (error instanceof HttpErrorResponse) {
          if (error.status === 401 || error.status === 403 || error.status >= 500) {
            return throwError(() => error);
          }
        }
        return timer(2000);
      },
    }),
  );
};
