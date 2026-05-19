import { Routes } from '@angular/router';
import { authGuard, roleGuard } from '@core/guards/auth.guard';

export const routes: Routes = [
  // Pantalla de Login (Acceso público)
  { 
    path: 'login', 
    loadComponent: () => import('./features/login/login').then(m => m.Login) 
  },

  // Panel de Administración (Solo Admin)
  {
    path: 'admin',
    loadComponent: () => import('./features/admin/admin').then(m => m.Admin),
    canActivate: [authGuard, roleGuard(['admin'])]
  },

  // Módulo de Recepción y Admisión (Admin y Recepcionista)
  {
    path: 'recepcion',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, roleGuard(['recepcionista', 'admin'])]
  },

  // Módulo de APS (Atención Primaria en Salud)
  {
    path: 'aps',
    loadComponent: () => import('./features/aps/aps').then(m => m.ApsComponent),
    canActivate: [authGuard, roleGuard(['aps', 'admin'])]
  },

  // Pantalla de Aseguradoras (APS y Admin)
  {
    path: 'aseguradoras',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, roleGuard(['aps', 'admin'])],
    data: {
      pageTitle: 'ASEGURADORAS',
      pageSubtitle: 'Gestión de aseguradoras',
      aseguradorasMode: true
    }
  },

  // Panel Médico de Atención (Solo Médico)
  {
    path: 'atencion',
    loadComponent: () => import('./features/atencion/atencion').then(m => m.Atencion),
    canActivate: [authGuard, roleGuard(['medico'])]
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
