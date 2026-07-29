import { HttpInterceptorFn, HttpErrorResponse, HttpRequest, HttpHandlerFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError, BehaviorSubject, filter, take } from 'rxjs';

let isRefreshing = false;
const refreshQueue: { req: HttpRequest<unknown>; next: HttpHandlerFn }[] = [];
const pending$ = new BehaviorSubject<boolean>(false);

function isAuthUrl(url: string): boolean {
  return url.includes('/auth/login') || url.includes('/auth/refresh');
}

function isRecoveryUrl(url: string): boolean {
  return url.includes('/auth/recuperacion');
}

/**
 * Interceptor que añade el token JWT a cada petición.
 * En 401 intenta refrescar el token automáticamente;
 * si hay múltiples peticiones concurrentes, las encola
 * hasta que el refresh finalice.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let requestToForward = req.clone({ withCredentials: true });
  if (token) {
    requestToForward = requestToForward.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(requestToForward).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401 && token && !isAuthUrl(req.url) && !isRecoveryUrl(req.url)) {
        if (!isRefreshing) {
          isRefreshing = true;
          pending$.next(true);

          return authService.refreshSession().pipe(
            switchMap((result) => {
              isRefreshing = false;
              pending$.next(false);

              if (result) {
                const cloned = req.clone({
                  setHeaders: { Authorization: `Bearer ${result.token}` },
                  withCredentials: true,
                });
                return next(cloned);
              }

              return throwError(() => error);
            }),
            catchError((refreshError) => {
              isRefreshing = false;
              pending$.next(false);
              return throwError(() => refreshError);
            }),
          );
        }

        return pending$.pipe(
          filter(v => !v),
          take(1),
          switchMap(() => {
            const newToken = authService.getToken();
            if (newToken) {
              const cloned = req.clone({
                setHeaders: { Authorization: `Bearer ${newToken}` },
                withCredentials: true,
              });
              return next(cloned);
            }
            return throwError(() => error);
          }),
        );
      }

      return throwError(() => error);
    }),
  );
};
