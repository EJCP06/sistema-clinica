import { IStepOption } from 'ngx-ui-tour-md-menu';

/**
 * Configuración de pasos del tour guiado — enfoque en el sidebar.
 *
 * El tour explica la navegación del sistema paso a paso:
 *   1. Bienvenida
 *   2. Estructura del sidebar
 *   3. Panel Control (solo admin)
 *   4. Operaciones (cada módulo según permisos)
 *   5. Usuarios (solo admin)
 *
 * Cada step puede tener una propiedad `route` para navegar antes de mostrar
 * el tooltip, y `expandSection` para abrir la sección del sidebar.
 */

export interface TourStep extends IStepOption {
  anchorId: string;
  /** Ruta a navegar antes de mostrar este paso */
  route?: string;
  /** Sección del sidebar a expandir (sessionStorage key) */
  expandSection?: 'panel' | 'operaciones' | 'admin';
}

export interface TourModuleConfig {
  /** Permiso requerido para mostrar este módulo en el tour */
  permiso: string;
  /** Nombre legible del módulo */
  label: string;
  /** Pasos del tour para este módulo */
  steps: TourStep[];
}

export const TOUR_STEPS: TourStep[] = [
  // ─── 1. BIENVENIDA ──────────────────────────────────────
  {
    anchorId: 'tour-sidebar-logo',
    title: '¡Bienvenido al Sistema!',
    content: 'Este tour le mostrará cómo navegar por el sistema. El menú lateral izquierdo es su principal herramienta de navegación.',
    route: '/recepcion',
  },

  // ─── 2. EL SIDEBAR ──────────────────────────────────────
  {
    anchorId: 'tour-sidebar-panel',
    title: 'Menú de Navegación',
    content: 'El sidebar tiene secciones colapsables. Haga click en cada una para ver los módulos disponibles según su rol.',
  },
];

/**
 * Pasos del sidebar filtrados por permisos del usuario.
 * Se construyen dinámicamente en TourGuideService.
 */
export const buildSidebarSteps = (permisos: { tienePermiso: (p: string) => boolean; rol: string }): TourStep[] => {
  const steps: TourStep[] = [...TOUR_STEPS];
  const esAdmin = permisos.rol === 'administrador';

  // ─── 3. PANEL CONTROL (solo admin) ─────────────────────
  if (esAdmin || permisos.tienePermiso('ver_reportes')) {
    steps.push({
      anchorId: 'tour-sidebar-panel',
      title: 'Panel Control',
      content: 'Acceda al Dashboard General con estadísticas del día, reportes y gráficas de actividad.',
      route: '/administrador?tab=reports',
      expandSection: 'panel',
    });
  }

  // ─── 4. OPERACIONES ────────────────────────────────────
  const modulosOperaciones: TourStep[] = [];

  if (permisos.tienePermiso('admision:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-sidebar-admision',
      title: 'Admisión de Pacientes',
      content: 'Registre nuevos pacientes, cree atenciones y gestione el flujo de llegada. Es el punto de inicio de todo el proceso.',
      route: '/recepcion',
      expandSection: 'operaciones',
    });
  }

  if (permisos.tienePermiso('aps:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-sidebar-aps',
      title: 'Atención APS',
      content: 'Atención Primaria en Salud. Asigne servicios, especialidades y médicos. Envíe pacientes a presupuesto, caja o sala de espera.',
      route: '/aps',
      expandSection: 'operaciones',
    });
  }

  if (permisos.tienePermiso('laboratorio:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-sidebar-laboratorio',
      title: 'Atención Laboratorio',
      content: 'Gestione la cola de análisis de laboratorio. Registre pagos y gestione el flujo de atención.',
      route: '/laboratorio',
      expandSection: 'operaciones',
    });
  }

  if (permisos.tienePermiso('imagenes:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-sidebar-imagenes',
      title: 'Atención Imágenes',
      content: 'Gestione la cola de estudios de imágenes (rayos X, ecografías, etc.).',
      route: '/imagenes',
      expandSection: 'operaciones',
    });
  }

  if (permisos.tienePermiso('atencion_medica:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-sidebar-atencion',
      title: 'Atención Médica',
      content: 'Panel del médico. Llame pacientes, registre diagnósticos y gestione la atención en su consultorio.',
      route: '/atencion',
      expandSection: 'operaciones',
    });
  }

  if (modulosOperaciones.length > 0) {
    // Primer paso de operaciones: explicar la sección
    steps.push({
      anchorId: 'tour-sidebar-panel',
      title: 'Sección de Operaciones',
      content: 'Aquí encontrará los módulos de atención según su rol. Cada módulo gestiona una etapa del flujo del paciente.',
      route: modulosOperaciones[0].route,
      expandSection: 'operaciones',
    });
    steps.push(...modulosOperaciones);
  }

  // ─── 5. USUARIOS (solo admin) ──────────────────────────
  if (esAdmin || permisos.tienePermiso('personal:ver')) {
    steps.push({
      anchorId: 'tour-admin-sidebar-nav',
      title: 'Gestión de Usuarios',
      content: 'Administre el personal, configure roles y asigne permisos de acceso a cada módulo del sistema.',
      route: '/administrador?tab=personal',
      expandSection: 'admin',
    });
  }

  return steps;
};
