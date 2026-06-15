import { Routes } from '@angular/router';
import { authGuard } from '@core/guards/auth.guard';

import { modulePermissionGuard } from '@core/guards/module-permission.guard';

export const routes: Routes = [
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
        { module: 'personal', allowedActions: ['*'] },
        { module: 'roles', allowedActions: ['*'] },
        { module: 'permisologia', allowedActions: ['*'] },
        { module: 'especialidades', allowedActions: ['*'] },
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
        { module: 'admision', allowedActions: ['*'] }
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
        { module: 'aps', allowedActions: ['*'] }
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
        { module: 'aseguradoras', allowedActions: ['*'] }
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
        { module: 'atencion_medica', allowedActions: ['*'] }
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
        { module: 'laboratorio', allowedActions: ['*'] }
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
        { module: 'imagenes', allowedActions: ['*'] }
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
        { module: 'laboratorio', allowedActions: ['*'] }
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
        { module: 'imagenes', allowedActions: ['*'] }
      ]
    }
  },

  // Pantalla Pública del Turnero (Acceso público para TVs)
  {
    path: 'turnero',
    loadComponent: () => import('./features/turnero/turnero').then(m => m.TurneroComponent)
  },

  // Redirección por defecto
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' }
];