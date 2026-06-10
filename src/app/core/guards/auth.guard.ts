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
      const u = auth.usuarioActual;
      const rutas: Record<string, string> = {
        administrador: '/administrador',
        recepcionista: '/recepcion',
        medico: '/atencion',
  
        coordinador: '/aps',
        analista: '/aps',
        laboratorio: '/atencion-laboratorio',
        imagenes: '/atencion-imagenes',
      };
      const destino = u?.rol ? rutas[u.rol] : undefined;
      router.navigate([destino ?? '/login']);
      return false;
    }
    return true;
  };
};
