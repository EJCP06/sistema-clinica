import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { Rol } from '@core/models/usuario.model';

export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }
  return true;
};

export const roleGuard = (roles: Rol[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      router.navigate(['/login']);
      return false;
    }

    if (!auth.tieneRol(roles)) {
      // Redirigir al módulo correcto según su rol
      const u = auth.usuarioActual!;
      const rutas: Record<Rol, string> = {
        admin: '/admin',
        recepcionista: '/recepcion',
        medico: '/atencion',
        aps: '/aps',
      };
      router.navigate([rutas[u.rol]]);
      return false;
    }
    return true;
  };
};
