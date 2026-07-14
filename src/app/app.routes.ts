import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

import { modulePermissionGuard } from '@core/guards/module-permission.guard';

export const routes: Routes = [
  // Entrada del sistema: decide el panel inicial según la sesión activa
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/inicio/inicio').then(m => m.Inicio),
    canActivate: [authGuard]
  },

  // Pantalla de Login (Acceso público)
  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login').then(m => m.Login) 
  },

  // Panel de Administración (Solo Admin)
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

  // Módulo de Recepción y Admisión
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

  // Módulo de APS (Atención Primaria en Salud)
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

  // Pantalla de Aseguradoras
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

  // Panel de Atención Médica
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

  // Panel de Atención Laboratorio
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

  // Panel de Atención Imágenes
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

  // Panel de Gestión Laboratorio
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

  // Panel de Gestión Imágenes
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

  // Turnero (público para TVs en sala de espera)
  {
    path: 'turnero',
    pathMatch: 'full',
    loadComponent: () => import('./features/turnero/turnero-sede-selector').then(m => m.TurneroSedeSelector)
  },
  {
    path: 'turnero/:sede',
    loadComponent: () => import('./features/turnero/turnero').then(m => m.TurneroComponent)
  },

  // Redirección por defecto
  { path: '**', redirectTo: '' }
];