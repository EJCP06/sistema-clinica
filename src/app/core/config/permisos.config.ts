import { LucideIconData } from 'lucide-angular';
import {
  Users,
  ShieldCheck,
  Key,
  LayoutGrid,
  ClipboardList,
  FlaskConical,
  Image,
  Stethoscope,
  LayoutDashboard,
  BarChart3,
  Settings,
  Building2,
  Cog,
} from 'lucide-angular';

export interface VistaConfig {
  ruta: string;
  label: string;
  icon: LucideIconData;
  seccion: 'panel' | 'operaciones' | 'admin';
  orden: number;
}

export const VISTA_POR_PERMISO: Record<string, VistaConfig> = {
  // Panel Control
  admin_panel: {
    ruta: '/administrador',
    label: 'Panel Control',
    icon: LayoutDashboard,
    seccion: 'panel',
    orden: 1,
  },
  ver_reportes: {
    ruta: '/administrador?tab=reports',
    label: 'Dashboard General',
    icon: BarChart3,
    seccion: 'panel',
    orden: 2,
  },

  // Operaciones
  admision_crear: {
    ruta: '/recepcion',
    label: 'Admisión de Pacientes',
    icon: Users,
    seccion: 'operaciones',
    orden: 1,
  },
  aps_enviar_presupuesto: {
    ruta: '/aps',
    label: 'Atención APS',
    icon: ClipboardList,
    seccion: 'operaciones',
    orden: 2,
  },
  laboratorio_registrar_caja: {
    ruta: '/atencion-laboratorio',
    label: 'Atención Laboratorio',
    icon: FlaskConical,
    seccion: 'operaciones',
    orden: 3,
  },
  imagenes_registrar_caja: {
    ruta: '/atencion-imagenes',
    label: 'Atención Imágenes',
    icon: Image,
    seccion: 'operaciones',
    orden: 4,
  },
  llamado_laboratorio: {
    ruta: '/atencion?tipo=laboratorio',
    label: 'Llamado Laboratorio',
    icon: Image,
    seccion: 'operaciones',
    orden: 5,
  },
  llamado_imagenes: {
    ruta: '/atencion?tipo=imagenes',
    label: 'Llamado Imágenes',
    icon: Image,
    seccion: 'operaciones',
    orden: 6,
  },
  atencion_medica_llamar_siguiente: {
    ruta: '/atencion',
    label: 'Atención Médica',
    icon: Stethoscope,
    seccion: 'operaciones',
    orden: 7,
  },
  atencion_medica_iniciar: {
    ruta: '/atencion',
    label: 'Atención Médica',
    icon: Stethoscope,
    seccion: 'operaciones',
    orden: 8,
  },
  atencion_medica_marcar_ausente: {
    ruta: '/atencion',
    label: 'Atención Médica',
    icon: Stethoscope,
    seccion: 'operaciones',
    orden: 9,
  },
  atencion_medica_finalizar: {
    ruta: '/atencion',
    label: 'Atención Médica',
    icon: Stethoscope,
    seccion: 'operaciones',
    orden: 10,
  },
  aseguradoras_crear: {
    ruta: '/aseguradoras',
    label: 'Aseguradoras',
    icon: ShieldCheck,
    seccion: 'operaciones',
    orden: 8,
  },
  especialidades_crear: {
    ruta: '/administrador?tab=especialidades',
    label: 'Especialidades',
    icon: LayoutGrid,
    seccion: 'operaciones',
    orden: 9,
  },

  // Administración
  personal_crear: {
    ruta: '/administrador?tab=personal',
    label: 'Personal',
    icon: Users,
    seccion: 'admin',
    orden: 1,
  },
  roles_crear: {
    ruta: '/administrador?tab=roles',
    label: 'Roles',
    icon: ShieldCheck,
    seccion: 'admin',
    orden: 2,
  },
  gestionar_permisos: {
    ruta: '/administrador?tab=permisologia',
    label: 'Permisología',
    icon: Key,
    seccion: 'admin',
    orden: 3,
  },
  gestionar_sedes: {
    ruta: '/administrador?tab=sedes',
    label: 'Sedes',
    icon: Building2,
    seccion: 'admin',
    orden: 5,
  },
  gestionar_servicios: {
    ruta: '/administrador?tab=servicios',
    label: 'Servicios',
    icon: Cog,
    seccion: 'admin',
    orden: 6,
  },
};

export const PERMISOS_POR_MODULO = {
  panel: ['admin_panel', 'ver_reportes'],
  operaciones: ['admision_crear', 'aps_enviar_presupuesto', 'laboratorio_registrar_caja', 'imagenes_registrar_caja', 'llamado_laboratorio', 'llamado_imagenes', 'atencion_medica_llamar_siguiente', 'atencion_medica_iniciar', 'atencion_medica_marcar_ausente', 'atencion_medica_finalizar', 'aseguradoras_crear', 'especialidades_crear'],
  admin: ['personal_crear', 'roles_crear', 'gestionar_permisos', 'gestionar_sedes', 'gestionar_servicios'],
};

export const MODULO_LABELS: Record<string, string> = {
  panel: 'PANEL CONTROL',
  operaciones: 'OPERACIONES',
  admin: 'ADMINISTRACIÓN',
};

export const MODULO_ICONS: Record<string, LucideIconData> = {
  panel: LayoutDashboard,
  operaciones: ClipboardList,
  admin: Settings,
};

export const ACCION_LABELS: Record<string, string> = {
  // Admisión
  admision_crear: 'Crear',
  admision_editar: 'Editar',
  admision_eliminar: 'Eliminar',
  admision_asignar_turno: 'Asignar Turno',
  
  // APS
  aps_enviar_presupuesto: 'Enviar Presupuesto',
  aps_solicitar_clave: 'Solicitar Clave',
  aps_enviar_sala_espera: 'Enviar Sala Espera',
  aps_aprobar_clave: 'Aprobar Clave',
  aps_reincorporar: 'Reincorporar',
  
  // Laboratorio
  laboratorio_registrar_caja: 'Registrar Caja',
  laboratorio_pasar_sala_espera: 'Pasar Sala Espera',
  laboratorio_marcar_ausente: 'Marcar Ausente',
  laboratorio_reincorporar: 'Reincorporar',
  
  // Imágenes
  imagenes_registrar_caja: 'Registrar Caja',
  imagenes_pasar_sala_espera: 'Pasar Sala Espera',
  imagenes_marcar_ausente: 'Marcar Ausente',
  imagenes_reincorporar: 'Reincorporar',
  
  // Llamado
  llamado_laboratorio: 'Llamar Laboratorio',
  llamado_imagenes: 'Llamar Imágenes',
  
  // Aseguradoras
  aseguradoras_crear: 'Crear',
  aseguradoras_editar: 'Editar',
  aseguradoras_eliminar: 'Eliminar',
  aseguradoras_importar_excel: 'Importar Excel',
  
  // Atención Médica
  atencion_medica_llamar_siguiente: 'Llamar Siguiente',
  atencion_medica_liberar_consultorio: 'Liberar Consultorio',
  atencion_medica_iniciar: 'Iniciar Atención',
  atencion_medica_marcar_ausente: 'Marcar Ausente',
  atencion_medica_finalizar: 'Finalizar Atención',
  
  // Especialidades
  especialidades_crear: 'Crear',
  especialidades_editar: 'Editar',
  especialidades_eliminar: 'Eliminar',
  
  // Personal
  personal_crear: 'Crear',
  personal_editar: 'Editar',
  personal_eliminar: 'Eliminar',
  
  // Roles
  roles_crear: 'Crear',
  roles_editar: 'Editar',
  roles_eliminar: 'Eliminar',
  
  // Permisología
  gestionar_permisos: 'Gestionar Permisos',
  
  // Otros
  admin_panel: 'Panel Admin',
  ver_reportes: 'Ver Reportes',
  gestionar_sedes: 'Gestionar Sedes',
  gestionar_servicios: 'Gestionar Servicios',
};

export function getAccionLabel(permisoKey: string): string {
  return ACCION_LABELS[permisoKey] || permisoKey.replace(/_/g, ' ');
}

export const PERMISOS_GRUPALES: Record<string, string[]> = {
  'Admisión': ['admision_crear', 'admision_editar', 'admision_eliminar', 'admision_asignar_turno'],
  'APS': ['aps_enviar_presupuesto', 'aps_solicitar_clave', 'aps_enviar_sala_espera', 'aps_aprobar_clave', 'aps_reincorporar'],
  'Laboratorio': ['laboratorio_registrar_caja', 'laboratorio_pasar_sala_espera', 'laboratorio_marcar_ausente', 'laboratorio_reincorporar'],
  'Imágenes': ['imagenes_registrar_caja', 'imagenes_pasar_sala_espera', 'imagenes_marcar_ausente', 'imagenes_reincorporar'],
  'Llamado': ['llamado_laboratorio', 'llamado_imagenes'],
  'Aseguradoras': ['aseguradoras_crear', 'aseguradoras_editar', 'aseguradoras_eliminar', 'aseguradoras_importar_excel'],
  'Atención Médica': ['atencion_medica_llamar_siguiente', 'atencion_medica_liberar_consultorio', 'atencion_medica_iniciar', 'atencion_medica_marcar_ausente', 'atencion_medica_finalizar'],
  'Especialidades': ['especialidades_crear', 'especialidades_editar', 'especialidades_eliminar'],
  'Personal': ['personal_crear', 'personal_editar', 'personal_eliminar'],
  'Roles': ['roles_crear', 'roles_editar', 'roles_eliminar'],
  'Permisología': ['gestionar_permisos'],
};