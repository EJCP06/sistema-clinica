import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '@core/services/auth.service';

export const modulePermissionGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaAutenticado()) {
    router.navigate(['/login']);
    return false;
  }

  // Support both single module config and multiple modules config
  let modulesConfig: { module: string; allowedActions?: string[] }[] = [];
  if (route.data?.['modules']) {
    modulesConfig = route.data['modules'] as { module: string; allowedActions?: string[] }[];
  } else if (route.data?.['module']) {
    const module = route.data['module'] as string;
    const allowedActions = route.data['allowedActions'] as string[] | undefined;
    modulesConfig = [{ module, allowedActions }];
  } else {
    // No module config defined, deny access
    router.navigate(['/login']);
    return false;
  }

  const usuario = auth.usuarioActual;
  if (!usuario || !usuario.permisos) {
    router.navigate(['/login']);
    return false;
  }

  // Administrador tiene acceso a todo
  if (usuario.rol === 'administrador') return true;

  const permisosUsuario: string[] = usuario.permisos;

  // Helper to normalize a permission string to {module, action}
  const normalizePerm = (perm: string): { module: string; action: string } | null => {
    let normalized = perm;
    // Convert legacy format (contains '_' and no ':') to 'module:action'
    if (perm.includes('_') && !perm.includes(':')) {
      const parts = perm.split('_');
      if (parts.length >= 2) {
        normalized = `${parts[0]}:${parts.slice(1).join('_')}`;
      }
    }
    if (!normalized.includes(':')) {
      return null; // not a valid permission format
    }
    const [module, action] = normalized.split(':');
    return { module, action };
  };

  const tieneAcceso = permisosUsuario.some(perm => {
    const norm = normalizePerm(perm);
    if (!norm) return false;
    const { module: permModule, action: permAction } = norm;

    return modulesConfig.some(cfg => {
      // Module matches: either cfg.module is wildcard '*' or permModule equals cfg.module
      const moduleMatch = cfg.module === '*' || permModule === cfg.module;
      // Action matches: 
      // - if cfg.allowedActions is undefined => any action allowed
      // - if cfg.allowedActions includes '*' => any action allowed
      // - if cfg.allowedActions includes the specific permAction => allowed
      // - if permAction is '*' (permission grants any action) => allowed
      const actionMatch = !cfg.allowedActions ||
        cfg.allowedActions.includes('*') ||
        cfg.allowedActions.includes(permAction) ||
        permAction === '*';

      return moduleMatch && actionMatch;
    });
  });

  if (!tieneAcceso) {
    // Optionally redirect to a forbidden page or login
    router.navigate(['/login']);
    return false;
  }

  return true;
};