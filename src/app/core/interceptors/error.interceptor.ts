import { HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import Swal from 'sweetalert2';

/**
 * Interceptor global de errores HTTP.
 * Muestra alertas SweetAlert2 para errores de conexión (status 0).
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
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
      }

      return throwError(() => error);
    }),
  );
};
