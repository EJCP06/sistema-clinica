import { Routes } from '@angular/router';
import { authGuard, permissionGuard } from '@core/guards/auth.guard';

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
    canActivate: [authGuard, permissionGuard(['admin_panel', 'personal_crear', 'roles_crear', 'gestionar_permisos', 'gestionar_sedes', 'gestionar_servicios', 'especialidades_crear'])]
  },

  // Módulo de Recepción y Admisión (Admin y Recepcionista)
  {
    path: 'recepcion',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, permissionGuard(['admision_crear', 'admision_editar', 'admision_eliminar', 'admision_asignar_turno', 'admision'])]
  },

  // Módulo de APS (Atención Primaria en Salud)
  {
    path: 'aps',
    loadComponent: () => import('./features/aps/aps').then(m => m.ApsComponent),
    canActivate: [authGuard, permissionGuard(['aps_enviar_presupuesto', 'aps_solicitar_clave', 'aps_enviar_sala_espera', 'aps_aprobar_clave', 'aps_reincorporar', 'ver_aps'])]
  },

  // Pantalla de Aseguradoras (APS y Admin)
  {
    path: 'aseguradoras',
    loadComponent: () => import('./features/recepcion/recepcion').then(m => m.RecepcionComponent),
    canActivate: [authGuard, permissionGuard(['aseguradoras_crear', 'aseguradoras_editar', 'aseguradoras_eliminar', 'aseguradoras_importar_excel', 'ver_aseguradoras'])],
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
     canActivate: [authGuard, permissionGuard(['atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'atencion_medica_iniciar', 'atencion_medica_marcar_ausente', 'atencion_medica_finalizar', 'llamado_laboratorio', 'llamado_imagenes', 'atencion_medica', 'llamar_siguiente', 'liberar_consultorio', 'marcar_ausente', 'reincorporar'])],
     data: { tipo: 'medico' }
   },

  // Panel de Atención Laboratorio (Solo Laboratorio)
  {
    path: 'atencion-laboratorio',
    loadComponent: () => import('./features/laboratorio/laboratorio').then(m => m.LaboratorioComponent),
    canActivate: [authGuard, permissionGuard(['laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar', 'laboratorio', 'marcar_ausente', 'reincorporar'])]
  },

  // Panel de Atención Imágenes (Solo Imágenes)
  {
    path: 'atencion-imagenes',
    loadComponent: () => import('./features/imagenes/imagenes').then(m => m.ImagenesComponent),
    canActivate: [authGuard, permissionGuard(['imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar', 'imagenes', 'marcar_ausente', 'reincorporar'])]
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
