import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';

let alertaMostrandose = false;
let redirigiendo = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((error) => {
      const esAuth = req.url.toLowerCase().includes('/auth/login') || req.url.toLowerCase().includes('/auth/recuperacion/');

      if (esAuth) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        if (!alertaMostrandose) {
          alertaMostrandose = true;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se puede conectar con el servidor. Verifique su conexión.',
            confirmButtonColor: '#2563eb',
          }).then(() => { alertaMostrandose = false; });
        }
      } else if (error.status === 401) {
        if (!redirigiendo) {
          redirigiendo = true;
          sessionStorage.clear();
          router.navigate(['/login']);
          const mensaje = error.error?.mensaje || 'Sesión expirada. Debe iniciar sesión nuevamente.';
          if (!alertaMostrandose) {
            alertaMostrandose = true;
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: mensaje,
              confirmButtonColor: '#2563eb',
            }).then(() => { alertaMostrandose = false; redirigiendo = false; });
          }
        }
      } else {
        let mensaje = 'Error inesperado. Intente nuevamente.';
        if (error.status === 404) {
          mensaje = 'El recurso solicitado no existe.';
        } else if (error.status === 409) {
          mensaje = error.error?.mensaje || 'El recurso ya existe o hay un conflicto.';
        } else if (error.status === 429) {
          mensaje = 'Demasiadas solicitudes. Espere un momento e intente nuevamente.';
        } else if (error.status >= 500) {
          mensaje = 'Error del servidor. Intente nuevamente más tarde.';
        }

        if (error.status !== 403 && error.error?.mensaje) {
          mensaje = error.error.mensaje;
        }

        if (error.status !== 403 && !alertaMostrandose) {
          alertaMostrandose = true;
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: mensaje,
            confirmButtonColor: '#2563eb',
          }).then(() => { alertaMostrandose = false; });
        }
      }

      console.error(`[HTTP ${error.status}]`, error);

      return throwError(() => error);
    }),
  );
};
