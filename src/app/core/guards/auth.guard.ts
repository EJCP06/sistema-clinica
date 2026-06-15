import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';
import { Rol } from '@core/models/usuario.model';
import { VISTA_POR_PERMISO } from '@core/config/permisos.config';

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
        laboratorio: '/laboratorio',
        imagenes: '/imagenes',
      };
      const destino = u?.rol ? rutas[u.rol] : undefined;
      router.navigate([destino ?? '/login']);
      return false;
    }
    return true;
  };
};

export const permissionGuard = (permisosRequeridos: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);

    if (!auth.estaAutenticado()) {
      router.navigate(['/login']);
      return false;
    }

    if (!auth.tienePermisos(permisosRequeridos)) {
      const u = auth.usuarioActual;
      const rutaPermisos: Record<string, string> = {};
      for (const [perm, config] of Object.entries(VISTA_POR_PERMISO)) {
        rutaPermisos[perm] = config.ruta;
      }
      if (u?.permisos) {
        for (const p of u.permisos) {
          if (rutaPermisos[p]) {
            router.navigate([rutaPermisos[p]]);
            return false;
          }
        }
      }
      router.navigate(['/login']);
      return false;
    }
    return true;
  };
};
