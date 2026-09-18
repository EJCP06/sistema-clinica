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
  route?: string;
  expandSection?: 'panel' | 'operaciones' | 'admin';
  title?: string;
  /** Secciones informativas con accordion */
  infoSections?: { title: string; content: string }[];
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
    content: 'Este tour le mostrará cómo navegar por el sistema de colas.',
    route: '/administrador?tab=reports',
    placement: { horizontal: true },
  },
];

/**
 * Pasos del sidebar filtrados por permisos del usuario.
 * Se construyen dinámicamente en TourGuideService.
 */
export const buildSidebarSteps = (permisos: { tienePermiso: (p: string) => boolean; rol: string }): TourStep[] => {
  const steps: TourStep[] = [...TOUR_STEPS];
  const esAdmin = permisos.rol === 'administrador';

  // ─── 2. MENÚ DE NAVEGACIÓN ──────────────────────────────
  const tienePanel = esAdmin || permisos.tienePermiso('ver_reportes');
  const tieneOperaciones = permisos.tienePermiso('admision:ver') || permisos.tienePermiso('aps:ver')
    || permisos.tienePermiso('laboratorio:ver') || permisos.tienePermiso('imagenes:ver')
    || permisos.tienePermiso('atencion_medica:ver');
  const tieneUsuarios = esAdmin || permisos.tienePermiso('personal:ver');

  if (tienePanel || tieneOperaciones || tieneUsuarios) {
    steps.push({
      anchorId: 'tour-sidebar-sections',
      title: 'Menú de Navegación',
      content: 'Este menu tiene secciones colapsables. Haga click en cada una para ver los módulos disponibles según su rol.',
      placement: { horizontal: true },
    });
  }

  // ─── 3. PANEL CONTROL (solo admin) ─────────────────────
  if (esAdmin || permisos.tienePermiso('ver_reportes')) {
    steps.push({
      anchorId: 'tour-sidebar-panel',
      title: 'Panel de Control',
      content: 'Este módulo permite acceder al Dashboard General con estadísticas del día, reportes y gráficas de actividad.',
      expandSection: 'panel',
      placement: { horizontal: true },
    });
    steps.push({
      anchorId: 'tour-dashboard-global',
      title: 'Dashboard Global',
      content: 'En esta vista del sistema se muestra información específica del flujo que tienen los pacientes en la clínica.',
      route: '/administrador?tab=reports',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Cabecera', content: 'Muestra el nombre del módulo actual, junto con un subtitulo y al mismo tiempo muestra la sede del usuario, su nombre, su rol y un selector para cambiar el tema del sistema.' },
        { title: 'Tarjetas', content: 'Muestra cuatro tarjetas con estadísticas clave: Total Admisiones, Pacientes Atendidos, Pacientes en Espera y Pacientes Ausentes. Estos permiten un vistazo rápido del estado operativo del día.' },
        { title: 'Tabla de Actividad', content: 'Muestra un listado detallado de la actividad reciente de los pacientes, incluyendo filtros por fecha y exportación a PDF.' },
      ],
    });
  }

  // ─── 4. OPERACIONES ────────────────────────────────────
  const modulosOperaciones: TourStep[] = [];

  if (permisos.tienePermiso('admision:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-admision-content',
      title: 'Admisión de Pacientes',
      content: 'En esta vista del sistema se registran los nuevos pacientes, se les asigna un turno y se gestiona el flujo de atención del paciente.',
      route: '/recepcion',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro, el cual permite encontrar pacientes existentes rápidamente antes de crear una nueva admisión.' },
        { title: 'Botón Nuevo Paciente', content: 'Muestra el formulario de registro para ingresar un nuevo paciente al sistema. Se capturan datos personales, contacto y servicio solicitado.' },
        { title: 'Tabla de Admisiones', content: 'Muestra el listado de pacientes admitidos, permitiendo editar o eliminar cada admisión.' },
      ],
    });
  }

  if (permisos.tienePermiso('aps:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-aps-content',
      title: 'Atención APS',
      content: 'En esta vista se observan los pacientes en sus diferentes estados de servicio, y se gestionan los llamados, además de cambiar el estado de un paciente, para continuar con el flujo del sistema.',
      route: '/aps',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar pacientes en la cola de APS rápidamente' },
        { title: 'Tabla de Pacientes', content: 'Muestra un listado de pacientes en espera del llamado para atender su servicio o autorizar los cambios de estado.' },
      ],
    });
  }

  if (permisos.tienePermiso('laboratorio:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-laboratorio-content',
      title: 'Atención Laboratorio',
      content: 'En esta vista se observan los pacientes que van al laboratorio, se gestionan los llamados, se cambian los estado de un paciente, y se continua con el flujo del sistema.',
      route: '/laboratorio',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar pacientes en la cola de laboratorio rápidamente.' },
        { title: 'Tabla de Pacientes', content: 'Muestra un listado de pacientes en espera del llamado para atender su servicio o autorizar los cambios de estado.' },
      ],
    });
  }

  if (permisos.tienePermiso('imagenes:ver')) {
    modulosOperaciones.push({
      anchorId: 'tour-imagenes-content',
      title: 'Atención Imágenes',
      content: 'En esta vista se observan los pacientes que tienen estudios de imágenes (rayos X, ecografías, etc.), se gestionan los llamados y se cambian los estados de los pacientes, continuando con el flujo del sistema.',
      route: '/imagenes',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar pacientes en la cola de imágenes rápidamente.' },
        { title: 'Tabla de Pacientes', content: 'Muestra un listado de pacientes en espera del llamado para atender su servicio o autorizar los cambios de estado.' },
      ],
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

  if (permisos.tienePermiso('aseguradoras:ver') || esAdmin) {
    modulosOperaciones.push({
      anchorId: 'tour-admision-content',
      title: 'Gestión de Aseguradoras',
      content: 'En esta vista se administra el catálogo de las aseguradoras que tienen convenio con la clínica.',
      route: '/aseguradoras',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar aseguradoras rápidamente.' },
        { title: 'Botón Nueva Aseguradora', content: 'Muestra el formulario para registrar una nueva aseguradora en el sistema.' },
        { title: 'Tabla de Aseguradoras', content: 'Muestra un listado de aseguradoras, permitiendo editar o eliminar cada aseguradora.' },
        { title: 'Importar Excel', content: 'Muestra un botón para importar aseguradoras masivamente desde un archivo Excel.' },
      ],
    });
  }

if (permisos.tienePermiso('especialidades:ver') || esAdmin) {
    modulosOperaciones.push({
      anchorId: 'tour-especialidades-content',
      title: 'Gestión de Especialidades',
      content: 'En esta vista se observan las especialidades del sistema, se gestionan los consultorios y cada una se ubica por sede.',
      route: '/administrador?tab=especialidades',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtros para encontrar especialidades rápidamente.' },
        { title: 'Botón Nueva Especialidad', content: 'Muestra el formulario para crear una especialidad, asignarle consultorios y sede.' },
        { title: 'Tabla de Especialidades', content: 'Muestra un listado con las especialidades, permitiendo editar o eliminar cada una.' },
        { title: 'Importar Excel', content: 'Muestra un botón para importar especialidades masivamente desde un archivo Excel.' },
      ],
    });
  }

  if (modulosOperaciones.length > 0) {
    steps.push({
      anchorId: 'tour-sidebar-operaciones',
      title: 'Operaciones',
      content: 'Este modulo permite acceder a la admisión de pacientes, atención de APS, laboratorio e imágenes, aseguradoras y especialidades de la clínica.',
      expandSection: 'operaciones',
      placement: { horizontal: true },
    });
    steps.push(...modulosOperaciones);
  }

  // ─── 5. USUARIOS (solo admin) ──────────────────────────
  if (esAdmin || permisos.tienePermiso('personal:ver')) {
    steps.push({
      anchorId: 'tour-sidebar-admin',
      title: 'Gestión de Usuarios',
      content: 'Administre el personal, configure roles y asigne permisos de acceso a cada módulo del sistema.',
      route: '/administrador?tab=personal',
      expandSection: 'admin',
    });
  }

  return steps;
};
