import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor global de errores HTTP.
 * Muestra alertas SweetAlert2 para errores de conexión (status 0)
 * y sesión expirada (401) evitando duplicados con sessionStorage.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);
  const alertKey = `swal_active_${Date.now()}`;

  return next(req).pipe(
    catchError((error) => {
      const esAuth =
        req.url.toLowerCase().includes('/auth/login') ||
        req.url.toLowerCase().includes('/auth/recuperacion/');

      if (esAuth) {
        return throwError(() => error);
      }

      if (error.status === 0) {
        const alertaActiva = sessionStorage.getItem('swal_conexion');
        if (!alertaActiva) {
          sessionStorage.setItem('swal_conexion', 'true');
          Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'No se puede conectar con el servidor. Verifique su conexión.',
            confirmButtonColor: '#2563eb',
          }).then(() => {
            sessionStorage.removeItem('swal_conexion');
          });
        }
      } else if (error.status === 401) {
        const esVerify = req.url.includes('/auth/verify');
        const enLogin = router.url.includes('/login');

        if (!enLogin && !esVerify) {
          const alertaActiva = sessionStorage.getItem('swal_401');
          if (!alertaActiva) {
            sessionStorage.setItem('swal_401', 'true');
            Swal.fire({
              icon: 'error',
              title: 'Error',
              text: 'Su sesión ha expirado',
              confirmButtonColor: '#2563eb',
            }).then(() => {
              sessionStorage.removeItem('swal_401');
              if (router.url !== '/login') {
                router.navigate(['/login']);
              }
            });
          }
        }
      }

      return throwError(() => error);
    }),
  );
};
