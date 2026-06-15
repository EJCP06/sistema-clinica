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
} from 'lucide-angular';

export interface VistaConfig {
  ruta: string;
  label: string;
  icon: LucideIconData;
  seccion: 'panel' | 'operaciones' | 'admin';
  orden: number;
}

export const VISTA_POR_PERMISO: Record<string, VistaConfig> = {
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
  'admision:*': {
    ruta: '/recepcion',
    label: 'Admisión de Pacientes',
    icon: Users,
    seccion: 'operaciones',
    orden: 1,
  },
  'aps:*': {
    ruta: '/aps',
    label: 'Atención APS',
    icon: ClipboardList,
    seccion: 'operaciones',
    orden: 2,
  },
  'laboratorio:*': {
    ruta: '/laboratorio',
    label: 'Atención Laboratorio',
    icon: FlaskConical,
    seccion: 'operaciones',
    orden: 3,
  },
  'imagenes:*': {
    ruta: '/imagenes',
    label: 'Atención Imágenes',
    icon: Image,
    seccion: 'operaciones',
    orden: 4,
  },
  'atencion_medica:*': {
    ruta: '/atencion',
    label: 'Atención Médica',
    icon: Stethoscope,
    seccion: 'operaciones',
    orden: 5,
  },
  'aseguradoras:*': {
    ruta: '/aseguradoras',
    label: 'Aseguradoras',
    icon: ShieldCheck,
    seccion: 'operaciones',
    orden: 6,
  },
  'especialidades:*': {
    ruta: '/administrador?tab=especialidades',
    label: 'Especialidades',
    icon: LayoutGrid,
    seccion: 'operaciones',
    orden: 7,
  },
  'personal:*': {
    ruta: '/administrador?tab=personal',
    label: 'Personal',
    icon: Users,
    seccion: 'admin',
    orden: 1,
  },
  'roles:*': {
    ruta: '/administrador?tab=roles',
    label: 'Roles',
    icon: ShieldCheck,
    seccion: 'admin',
    orden: 2,
  },
  'permisologia:*': {
    ruta: '/administrador?tab=permisologia',
    label: 'Permisología',
    icon: Key,
    seccion: 'admin',
    orden: 3,
  },
};

export const PERMISOS_POR_MODULO = {
  panel: ['admin_panel', 'ver_reportes'],
  operaciones: ['admision:*', 'aps:*', 'laboratorio:*', 'imagenes:*', 'atencion_medica:*', 'aseguradoras:*', 'especialidades:*'],
  admin: ['personal:*', 'roles:*', 'permisologia:*'],
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

export const ACCION_NOMBRES: Record<string, string> = {
  ver: 'Ver', crear: 'Crear', editar: 'Editar', eliminar: 'Eliminar',
  asignar_turno: 'Asignar Turno', enviar_presupuesto: 'Enviar Presupuesto',
  solicitar_clave: 'Solicitar Clave', enviar_sala_espera: 'Enviar Sala Espera',
  aprobar_clave: 'Aprobar Clave', reincorporar: 'Reincorporar',
  registrar_caja: 'Registrar Caja', pasar_sala_espera: 'Pasar Sala Espera',
  marcar_ausente: 'Marcar Ausente', importar_excel: 'Importar Excel',
  llamar_siguiente: 'Llamar Siguiente', liberar_consultorio: 'Liberar Consultorio',
  iniciar: 'Iniciar', finalizar: 'Finalizar', '*': 'Acceso Total',
};

export function getAccionLabel(permisoKey: string): string {
  if (permisoKey.includes(':')) {
    const [rec, acc] = permisoKey.split(':');
    const accLabel = ACCION_NOMBRES[acc] || acc.replace(/_/g, ' ');
    return acc === '*' ? 'Acceso Total' : accLabel;
  }
  return permisoKey.replace(/_/g, ' ');
}

export const VISTAS_CON_CRUD = [
  'admision', 'aps', 'laboratorio', 'imagenes',
  'atencion_medica', 'aseguradoras', 'personal',
  'roles', 'especialidades', 'permisologia'
];