import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { catchError, switchMap, throwError, of } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getToken();

  let requestToForward = req;
  if (token) {
    requestToForward = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(requestToForward).pipe(
    catchError((error: HttpErrorResponse) => {
      // Si el error es 403, intentamos refrescar permisos y reintentar
      if (error.status === 403) {
        return authService.refrescarPermisos().pipe(
          switchMap(() => {
            // Reintentar la petición original con los permisos actualizados
            return next(requestToForward);
          }),
          catchError((refreshErr) => {
            // Si falla el refresco o el reintento, devolvemos el error original
            return throwError(() => error);
          })
        );
      }
      return throwError(() => error);
    })
  );
};
