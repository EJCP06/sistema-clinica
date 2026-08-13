import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

import { modulePermissionGuard } from '@core/guards/module-permission.guard';

/**
 * Configuración central de rutas de la aplicación.
 *
 * Rutas PÚBLICAS (sin guard): /login y /turnero* (pantalla pública de sala
 * de espera). Todo lo demás está protegido con authGuard + modulePermissionGuard,
 * y la metadata `modules` define qué permiso(s) permiten entrar
 * (ej. { module: 'admision', allowedActions: ['ver'] }).
 *
 * Nota: /aseguradoras reutiliza el componente de recepción en modo
 * 'aseguradorasMode' (ver recepcion.ts); /atencion-laboratorio y
 * /atencion-imagenes reutilizan el componente de atención con `tipo`.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/inicio/inicio').then(m => m.Inicio),
    canActivate: [authGuard]
  },

  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login').then(m => m.Login) 
  },

  {
    path: 'administrador',
    loadComponent: () => import('./features/admin/admin').then(m => m.Admin),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'personal', allowedActions: ['ver'] },
        { module: 'roles', allowedActions: ['ver'] },
        { module: 'permisologia', allowedActions: ['ver'] },
        { module: 'especialidades', allowedActions: ['ver'] },
        { module: 'reportes', allowedActions: ['ver'] }
      ]
    }
  },

  {
    path: 'recepcion',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'admision', allowedActions: ['ver'] }
      ]
    }
  },

  {
    path: 'aps',
    loadComponent: () => import('./features/aps/aps').then(m => m.ApsComponent),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'aps', allowedActions: ['ver'] }
      ]
    }
  },

  {
    path: 'aseguradoras',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'aseguradoras', allowedActions: ['ver'] }
      ],
      pageTitle: 'Aseguradoras',
      pageSubtitle: 'Gestión de aseguradoras',
      aseguradorasMode: true
    }
  },

  {
    path: 'atencion',
    loadComponent: () => import('./features/atencion/atencion').then(m => m.Atencion),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'atencion_medica', allowedActions: ['ver'] }
      ],
      tipo: 'medico'
    }
  },

  {
    path: 'atencion-laboratorio',
    loadComponent: () => import('./features/atencion/atencion').then(m => m.Atencion),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'laboratorio', allowedActions: ['ver'] }
      ],
      tipo: 'laboratorio'
    }
  },

  {
    path: 'atencion-imagenes',
    loadComponent: () => import('./features/atencion/atencion').then(m => m.Atencion),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'imagenes', allowedActions: ['ver'] }
      ],
      tipo: 'imagenes'
    }
  },

  {
    path: 'laboratorio',
    loadComponent: () => import('./features/laboratorio/laboratorio').then(m => m.LaboratorioComponent),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'laboratorio', allowedActions: ['ver'] }
      ]
    }
  },

  {
    path: 'imagenes',
    loadComponent: () => import('./features/imagenes/imagenes').then(m => m.ImagenesComponent),
    canActivate: [authGuard, modulePermissionGuard],
    data: {
      modules: [
        { module: 'imagenes', allowedActions: ['ver'] }
      ]
    }
  },

  {
    path: 'turnero',
    pathMatch: 'full',
    loadComponent: () => import('./features/turnero/turnero-sede-selector').then(m => m.TurneroSedeSelector)
  },
  {
    path: 'turnero/:sede',
    loadComponent: () => import('./features/turnero/turnero').then(m => m.TurneroComponent)
  },

  { path: '**', redirectTo: '' }
];