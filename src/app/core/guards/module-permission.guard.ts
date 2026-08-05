import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

/**
 * Guard de ruta que verifica permisos del módulo.
 * Evalúa si el usuario tiene al menos uno de los permisos
 * definidos en `route.data.modules` (formato `{ module, allowedActions }`).
 * Los administradores siempre tienen acceso.
 */
export const modulePermissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }

  let modulesConfig: { module: string; allowedActions?: string[] }[] = [];
  if (route.data?.['modules']) {
    modulesConfig = route.data['modules'] as { module: string; allowedActions?: string[] }[];
  } else if (route.data?.['module']) {
    const module = route.data['module'] as string;
    const allowedActions = route.data['allowedActions'] as string[] | undefined;
    modulesConfig = [{ module, allowedActions }];
  } else {
    router.navigate(['/login']);
    return false;
  }

  const usuario = auth.usuarioActual;
  if (!usuario || !usuario.permisos) {
    router.navigate(['/login']);
    return false;
  }

  const permisosUsuario: string[] = usuario.permisos;

  const normalizePerm = (perm: string): { module: string; action: string } | null => {
    let normalized = perm;
    if (perm.includes('_') && !perm.includes(':')) {
      const parts = perm.split('_');
      if (parts.length >= 2) {
        normalized = `${parts[0]}:${parts.slice(1).join('_')}`;
      }
    }
    if (!normalized.includes(':')) {
      return null;
    }
    const [module, action] = normalized.split(':');
    return { module, action };
  };

  const tieneAcceso = permisosUsuario.some(perm => {
    const norm = normalizePerm(perm);
    if (!norm) return false;
    const { module: permModule, action: permAction } = norm;

    return modulesConfig.some(cfg => {
      const moduleMatch = cfg.module === '*' || permModule === cfg.module;
      const actionMatch = !cfg.allowedActions ||
        cfg.allowedActions.includes('*') ||
        cfg.allowedActions.includes(permAction) ||
        permAction === '*';

      return moduleMatch && actionMatch;
    });
  });

  if (!tieneAcceso) {
    router.navigate(['/login']);
    return false;
  }

  return true;
};