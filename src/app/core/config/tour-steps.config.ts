import { IStepOption } from 'ngx-ui-tour-md-menu';

/**
 * Configuración de pasos del tour guiado — enfoque en el sidebar.
 *
 * El tour explica la navegación del sistema paso a paso:
 *   1. Bienvenida
 *   2. Estructura del sidebar
 *   3. Panel Control (solo admin)
 *   4. Operaciones (cada módulo según permisos)
 *   5. Despedida
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
  // IMPORTANTE: este paso NO debe tener `route`. Si la ruta fuera de un
  // módulo al que el usuario no tiene acceso, el guard la bloquearía,
  // `navigateByUrl` devolvería false y la librería del tour terminaría
  // el recorrido en seco (ver ngx-ui-tour-core: si !navigated -> end()).
  {
    anchorId: 'tour-sidebar-logo',
    title: '¡Bienvenido al Sistema!',
    content: 'Este tour le mostrará cómo navegar por el sistema de colas.',
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
      anchorId: 'tour-atencion-content',
      title: 'Atención Médica',
      content: 'En esta vista se observan los pacientes que esperan por la atención de su servicio, asi el médico tendrá encuenta el orden de los pacientes.',
      route: '/atencion',
      expandSection: 'operaciones',
      placement: { horizontal: true },
      infoSections: [
        { title: 'Tabla de Pacientes en espera', content: 'Muestra una tabla con el listado de pacientes en cola.' },
        { title: 'Tabla de Pacientes atendidos', content: 'Muestra una tabla con el historial de pacientes atendidos durante el día.' },
        { title: 'Tarjetas', content: 'Muestra dos tarjetas, una con el número de pacientes en espera y la especialidad asignada al consultorio.' },
        { title: 'Botones', content: 'Muestra unos botones. El botón principal para llamar al próximo paciente. Cuando hay turno activo, muestra opciones de Iniciar, Ausentar y Finalizar atención.' },
      ],
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
      content: 'Este modulo permite acceder a la admisión de pacientes, atención de APS, atención médica, laboratorio e imágenes, aseguradoras y especialidades de la clínica, dependiendo del permiso asignado.',
      expandSection: 'operaciones',
      placement: { horizontal: true },
    });
    steps.push(...modulosOperaciones);
  }

  // ─── 5. USUARIOS (solo admin) ──────────────────────────
  if (esAdmin || permisos.tienePermiso('personal:ver')) {
    steps.push({
      anchorId: 'tour-sidebar-admin',
      title: 'Usuarios',
      content: 'Este modulo permite administrar los usuarios del sistema, con sus roles y permisos para cada uno.',
      route: '/administrador?tab=personal',
      expandSection: 'admin',
      placement: { horizontal: true },
    });

    // Personal
    if (permisos.tienePermiso('personal:ver')) {
      steps.push({
        anchorId: 'tour-admin-personal',
        title: 'Personal',
        content: 'En esta vista se administran los usuarios del sistema, asignandoles sus roles especificos.',
        route: '/administrador?tab=personal',
        expandSection: 'admin',
        placement: { horizontal: true },
        infoSections: [
          { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar personal rápidamente.' },
          { title: 'Botón Nuevo Usuario', content: 'Muestra el formulario para registrar un nuevo usuario y escoger su rol en el sistema.' },
          { title: 'Tabla de Personal', content: 'Muestra el listado de usuarios, permitiendo editar o eliminar cada uno.' },
        ],
      });
    }

    // Roles
    if (permisos.tienePermiso('roles:ver')) {
      steps.push({
        anchorId: 'tour-admin-roles',
        title: 'Roles',
        content: 'En esta vista se configuran los roles del sistema, para que sean asignados a los usuarios.',
        route: '/administrador?tab=roles',
        expandSection: 'admin',
        placement: { horizontal: true },
        infoSections: [
          { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar roles rápidamente.' },
          { title: 'Botón Nuevo Rol', content: 'Muestra el formulario para crear un nuevo rol en el sistema.' },
          { title: 'Tabla de Roles', content: 'Muestra el listado de roles, permitiendo editar o eliminar cada uno.' },
        ],
      });
    }

    // Permisología
    if (permisos.tienePermiso('permisologia:ver')) {
      steps.push({
        anchorId: 'tour-admin-permisos',
        title: 'Permisología',
        content: 'En esta vista se asignan permisos específicos a cada rol para controlar el acceso a los módulos del sistema.',
        route: '/administrador?tab=permisologia',
        expandSection: 'admin',
        placement: { horizontal: true },
        infoSections: [
          { title: 'Buscador', content: 'Muestra una barra de búsqueda con filtro para encontrar permisos rápidamente.' },
          { title: 'Botón Nuevo Permiso', content: 'Muestra el formulario para crear un nuevo permiso en el sistema, seleccionando el rol que se le va asignar el permiso, el módulo y la acción que permite el acceso.' },
          { title: 'Tabla de Permisos', content: 'Muestra una tabla con todos los módulos y acciones, permitiendo activar o desactivar cada permiso para el rol seleccionado, y tambien editar o eliminar cada uno.' },
        ],
      });
    }
  }

  // ─── 6. DESPEDIDA ──────────────────────────────────────
  steps.push({
    anchorId: 'tour-sidebar-logo',
    title: '¡Despedida!',
    content: 'Gracias por realizar la guía rápida. Ahora puede comenzar a utilizar el sistema.',
    placement: { horizontal: true },
  });

  return steps;
};
