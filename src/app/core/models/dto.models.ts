/** Credenciales de inicio de sesión. */
export interface LoginRequest {
  username: string;
  password: string;
}

/** Respuesta del servidor tras autenticación exitosa. */
export interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: UsuarioDTO;
}

/** Datos del usuario autenticado (incluye rol, consultorio, especialidad, sede). */
export interface UsuarioDTO {
  id: number;
  username?: string;
  cedula?: string;
  nombre: string;
  apellido?: string;
  /** Identificador del rol (ej. administrador, medico, recepcionista). */
  rol: string;
  consultorio_id?: number;
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_nombre?: string;
  id_sede?: number;
}

/** Modalidad de pago (particular / seguro). */
export interface ResponsablePagoDTO {
  id_responsable: number;
  nombre: string;
  status: boolean;
}

/** Representa una admisión (atención) activa de un paciente. */
export interface AdmisionDTO {
  id_atencion: number;
  numero: string;
  id_estado_actual: number;
  id_servicio: number;
  id_paciente: number;
  id_especialidad?: number;
  id_responsable?: number;
  nombre: string;
  segundo_nombre?: string;
  apellido: string;
  segundo_apellido?: string;
  cedula: string;
  telefono?: string;
  nombre_estado: string;
  nombre_servicio: string;
  prefijo?: string;
  modalidad_pago?: string;
  fecha_creacion: string;
  hora_llegada?: string;
  hora_salida?: string;
}

/** Datos del paciente (incluye ambos nombres y apellidos). */
export interface PacienteDTO {
  id_paciente: number;
  cedula: string;
  nombre: string;
  apellido: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  status?: boolean;
  id_sede?: number;
}

/** Cuerpo para crear o actualizar un paciente. */
export interface CrearPacienteRequest {
  id_paciente?: number | null;
  cedula: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  fecha_nacimiento?: string;
  telefono?: string;
  status?: boolean;
}

/** Cuerpo para generar un nuevo turno. */
export interface GenerarTurnoRequest {
  id_paciente: number;
  id_servicio: number;
  id_responsable?: number;
  id_cliente?: number;
  id_especialidad?: number;
}

/** Respuesta tras generar un turno exitosamente. */
export interface GenerarTurnoResponse {
  id_atencion: number;
  numero: string;
  hora_llegada: string;
}

/** Representación de un turno en listas y tableros. */
export interface TurnoDTO {
  id: number;
  id_atencion?: number;
  numero: string;
  /** Estado actual del turno (SALA DE ESPERA, LLAMADO, EN_ATENCION, ATENDIDO, AUSENTE). */
  estado: string;
  hora_llegada: string;
  paciente: {
    nombre: string;
    apellido?: string;
    documento: string;
    telefono?: string | null;
  };
  id_consultorio?: number;
  id_especialidad?: number;
  id_servicio?: number;
  id_medico?: number;
  id_sede?: number;
  id_estado_actual?: number;
  nombre_servicio?: string;
  especialidad_nombre?: string;
  consultorio_nombre?: string;
  updated_at?: string;
}

/** Respuesta al llamar al siguiente paciente. */
export interface LlamarSiguienteResponseDTO {
  mensaje: string;
  /** El turno llamado, o null si no hay pacientes en espera. */
  turno: TurnoDTO | null;
}

/** Estado detallado del consultorio del médico autenticado. */
export interface MiEstadoDTO {
  /** Estado del consultorio (LIBRE, OCUPADO, EN_PAUSA, etc.). */
  estado: string;
  servicio_id: number;
  nombre: string;
  servicio_nombre?: string;
  turno_id?: number;
  turno_numero?: string;
  turno_estado?: string;
  nombre_paciente?: string;
  apellido_paciente?: string;
  documento_paciente?: string;
  turno_hora_llegada?: string;
  hora_llamado?: string;
}

/** Datos de un consultorio físico. */
export interface ConsultorioDTO {
  id_consultorio?: number;
  id: number;
  nombre: string;
  /** Estado físico (OPERATIVO, INOPERATIVO). */
  estado_fisico: string;
  id_servicio?: number;
  id_sede?: number;
  servicio_nombre?: string;
  piso?: string;
}

/** Consultorio para administración (visión simplificada). */
export interface AdminConsultorioDTO {
  id: number;
  nombre: string;
  estado: string;
  servicio_id?: number;
}

/** Estado en tiempo real de un consultorio con su turno actual. */
export interface ConsultorioEstadoDTO {
  id_consultorio: number;
  nombre: string;
  estado: string;
  turno_actual?: TurnoDTO | null;
  especialidad_nombre?: string;
  medico_nombre?: string;
}

/** Representación de un miembro del personal (médicos, recepcionistas, etc.). */
export interface PersonalDTO {
  id_usuario: number;
  id?: number;
  cedula?: string;
  username?: string;
  nombre: string;
  apellido?: string;
  primer_nombre?: string;
  segundo_nombre?: string;
  primer_apellido?: string;
  segundo_apellido?: string;
  telefono?: string;
  email?: string;
  /** Nombre del rol (administrador, medico, recepcionista, etc.). */
  rol: string;
  piso?: string;
  id_consultorio?: number;
  consultorio_id?: number;
  id_servicio?: number;
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_id?: number;
  id_sede?: number;
  status?: boolean;
  activo?: boolean;
  fecha_creacion?: string;
  consultorio_nombre?: string;
  servicio_nombre?: string;
}

/** Cuerpo para crear un nuevo miembro del personal. */
export interface CrearPersonalRequest {
  cedula: string;
  primer_nombre: string;
  segundo_nombre?: string;
  primer_apellido: string;
  segundo_apellido?: string;
  telefono?: string;
  password?: string;
  rol: string;
  piso?: string;
  id_consultorio?: number;
  id_servicio?: number;
  id_especialidad?: number;
  username?: string;
  status?: boolean;
  id_sede?: number;
}

/** Servicio médico ofrecido (consulta, laboratorio, imágenes). */
export interface ServicioDTO {
  id: number;
  nombre: string;
  prefijo?: string;
  activo: boolean;
}

/** Cuerpo para crear un nuevo servicio. */
export interface CrearServicioRequest {
  nombre: string;
  prefijo?: string;
  piso?: string;
  activo?: boolean;
}

/** Especialidad médica asociada a un servicio y opcionalmente a consultorios. */
export interface EspecialidadDTO {
  id_especialidad: number;
  id?: number;
  nombre: string;
  codigo?: string;
  prefijo?: string;
  piso?: string;
  activo?: boolean;
  id_servicio?: number;
  servicio_id?: number;
  id_sede?: number;
  nombre_servicio?: string;
  /** IDs de los consultorios donde se practica esta especialidad. */
  consultorios_ids?: number[];
}

/** Cuerpo para crear o actualizar una especialidad. */
export interface CrearEspecialidadRequest {
  nombre: string;
  prefijo?: string;
  id_servicio?: number;
  id_sede?: number;
  piso?: string;
  consultorios_ids?: number[];
  activo?: boolean;
}

/** Sede o sucursal de la clínica. */
export interface SedeDTO {
  id_sede: number;
  id?: number;
  nombre: string;
  direccion?: string;
  activo?: boolean;
}

/** Aseguradora registrada en el sistema. */
export interface AseguradoraDTO {
  id_cliente: number;
  aseguradora?: string;
  nombre?: string;
  tipo?: string;
  id_sede?: number;
}

/** Reporte diario de operaciones con estadísticas, KPIs y desglose por servicio. */
export interface ReporteDiarioDTO {
  total: number;
  turnos: TurnoReporteDTO[];
  estadisticas: {
    atendidos: number;
    ausentes: number;
    en_espera: number;
    en_atencion: number;
    registrados: number;
  };
  kpis: {
    tiempo_promedio_espera_min: number;
    tiempo_promedio_atencion_min: number;
    ausentismo_porcentaje: number;
  };
  por_servicio: ServicioReporteDTO[];
  ausentes: AusenteReporteDTO[];
}

/** Turno individual dentro del reporte diario. */
export interface TurnoReporteDTO {
  id: number;
  numero: string;
  estado: string;
  id_estado_actual: number;
  hora_llegada: string;
  hora_fin?: string;
  servicio_nombre: string;
  especialidad?: string;
  consultorio?: string;
  medico_nombre?: string;
  medico_apellido?: string;
  hora_inicio_atencion?: string;
  hora_fin_atencion?: string;
  hora_marcado_ausente?: string;
  hora_retirado?: string;
  id_sede: number;
  paciente: {
    nombre: string;
    apellido?: string;
    documento: string;
    telefono?: string | null;
  };
}

/** Estadísticas agregadas por servicio. */
export interface ServicioReporteDTO {
  servicio: string;
  total: number;
  atendidos: number;
  ausentes: number;
  en_espera: number;
  en_atencion: number;
  registrados: number;
}

/** Paciente ausente registrado en el reporte. */
export interface AusenteReporteDTO {
  numero: string;
  paciente_nombre: string;
  paciente_apellido: string;
  paciente_documento: string;
  servicio: string;
  especialidad?: string;
  hora_llegada: string;
}

/** Paciente en espera con datos básicos de admisión. */
export interface PacienteEnEsperaDTO {
  id_atencion: number;
  hora_llegada: string;
  hora_salida?: string;
  nombre: string;
  apellido: string;
  cedula: string;
  nombre_estado: string;
  nombre_servicio: string;
  id_estado_actual: number;
  id_especialidad?: number;
  nombre_especialidad?: string;
}

/** Envoltorio de respuesta estándar del API. */
export interface ApiResponse<T = unknown> {
  mensaje: string;
  data?: T;
}

/** Respuesta de error estándar. */
export interface ErrorResponse {
  mensaje: string;
  error?: string;
}

/** Rol de usuario configurable. */
export interface RolDTO {
  id: number;
  nombre: string;
  /** Identificador único del rol para permisos (ej. medico, recepcionista). */
  key: string;
  id_sede: number | null;
  activo: boolean;
  sede_nombre?: string;
}

/** Cuerpo para crear un nuevo rol. */
export interface CrearRolRequest {
  nombre: string;
  key?: string;
  id_sede?: number | null;
  activo?: boolean;
}

/** Permiso individual del sistema. */
export interface PermisoDTO {
  id_permiso: number;
  /** Clave del permiso (ej. admision:ver). */
  key: string;
  nombre: string;
  descripcion?: string;
}

/** Recurso con sus acciones disponibles para la matriz de permisos. */
export interface RecursoMatrizDTO {
  key: string;
  nombre: string;
  descripcion?: string;
  /** Lista de acciones permitidas (ver, crear, editar, eliminar). */
  acciones: string[];
}

/** Matriz completa de recursos y acciones básicas. */
export interface MatrizPermisosDTO {
  recursos: RecursoMatrizDTO[];
  accionesBasicas: string[];
}

/** Respuesta del endpoint de salud del servidor. */
export interface HealthResponse {
  status: string;
  message: string;
}

/** Respuesta con el nuevo ID de estado tras una actualización. */
export interface EstadoActualizadoResponse {
  id_estado_actual: number;
}
