import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      let mensaje = 'Error inesperado. Intente nuevamente.';

      if (error.status === 0) {
        mensaje = 'No se puede conectar con el servidor. Verifique su conexión.';
      } else if (error.status === 401) {
        mensaje = 'Sesión expirada. Debe iniciar sesión nuevamente.';
        sessionStorage.clear();
        router.navigate(['/login']);
      } else if (error.status === 403) {
        mensaje = 'No tiene permisos para realizar esta acción.';
      } else if (error.status === 404) {
        mensaje = 'El recurso solicitado no existe.';
      } else if (error.status === 409) {
        mensaje = error.error?.mensaje || 'El recurso ya existe o hay un conflicto.';
      } else if (error.status === 429) {
        mensaje = 'Demasiadas solicitudes. Espere un momento e intente nuevamente.';
      } else if (error.status >= 500) {
        mensaje = 'Error del servidor. Intente nuevamente más tarde.';
      }

      if (error.error?.mensaje) {
        mensaje = error.error.mensaje;
      }

      console.error(`[HTTP ${error.status}]`, mensaje, error);
      alert(mensaje);

      return throwError(() => error);
    }),
  );
};
