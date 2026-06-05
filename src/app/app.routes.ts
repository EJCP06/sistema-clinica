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
    canActivate: [authGuard, roleGuard(['aps', 'admin', 'laboratorio', 'imagenes'])]
  },

  // Pantalla de Aseguradoras (APS y Admin)
  {
    path: 'aseguradoras',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, roleGuard(['aps', 'admin'])],
    data: {
      pageTitle: 'Aseguradoras',
      pageSubtitle: 'Gestión de aseguradoras',
      aseguradorasMode: true
    }
  },

   // Panel de Atención (Médico, Laboratorio, Imágenes)
   {
     path: 'atencion',
     loadComponent: () => import('./features/atencion/atencion').then(m => m.Atencion),
     canActivate: [authGuard, roleGuard(['medico', 'laboratorio', 'imagenes'])],
     data: { tipo: 'medico' }
   },

  // Panel de Atención Laboratorio (Solo Laboratorio)
  {
    path: 'atencion-laboratorio',
    loadComponent: () => import('./features/laboratorio/laboratorio').then(m => m.LaboratorioComponent),
    canActivate: [authGuard, roleGuard(['laboratorio', 'admin'])]
  },

  // Panel de Atención Imágenes (Solo Imágenes)
  {
    path: 'atencion-imagenes',
    loadComponent: () => import('./features/imagenes/imagenes').then(m => m.ImagenesComponent),
    canActivate: [authGuard, roleGuard(['imagenes', 'admin'])]
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
