import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth.service';

let alertaMostrandose = false;
let redirigiendo = false;

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error) => {
      const esAuth =
        req.url.toLowerCase().includes('/auth/login') ||
        req.url.toLowerCase().includes('/auth/recuperacion/');

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
          }).then(() => {
            alertaMostrandose = false;
          });
        }
      } else if (error.status === 401) {
        if (!redirigiendo) {
          redirigiendo = true;
          authService.logout(true); // Limpia sesión sin llamar al backend

          const mensaje = 'Su sesión ha expirado';

          // No mostramos alerta si ya estamos en login o si es el verifySession fallando al inicio
          const esVerify = req.url.includes('/auth/verify');
          const enLogin = router.url.includes('/login');

          if (!alertaMostrandose && !enLogin && !esVerify) {
            alertaMostrandose = true;
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: mensaje,
              confirmButtonColor: '#2563eb',
            }).then(() => {
              alertaMostrandose = false;
              redirigiendo = false;
            });
          } else {
            redirigiendo = false;
          }
        }
      }

      return throwError(() => error);
    }),
  );
};
