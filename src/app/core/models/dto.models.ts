// ==========================================
// AUTH DTOs
// ==========================================
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  mensaje: string;
  token: string;
  usuario: UsuarioDTO;
}

export interface UsuarioDTO {
  id: number;
  username?: string;
  cedula?: string;
  nombre: string;
  apellido?: string;
  rol: string;
  consultorio_id?: number;
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_nombre?: string;
  id_sede?: number;
}

// ==========================================
// RESPONSABLE PAGO DTO
// ==========================================
export interface ResponsablePagoDTO {
  id_responsable: number;
  nombre: string;
  status: boolean;
}

// ==========================================
// PATIENT / ADMISSION DTOs
// ==========================================
export interface AdmisionDTO {
  id_atencion: number;
  numero: string;
  id_estado_actual: number;
  id_servicio: number;
  id_paciente: number;
  id_especialidad?: number;
  id_responsable?: number;
  nombre: string;
  apellido: string;
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

export interface PacienteDTO {
  id_paciente: number;
  cedula: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  status?: boolean;
  id_sede?: number;
}

export interface CrearPacienteRequest {
  id_paciente?: number | null;
  cedula: string;
  nombre: string;
  apellido: string;
  telefono?: string;
  status?: boolean;
}

export interface GenerarTurnoRequest {
  id_paciente: number;
  id_servicio: number;
  id_responsable?: number;
  id_cliente?: number;
  id_especialidad?: number;
}

export interface GenerarTurnoResponse {
  id_atencion: number;
  numero: string;
  hora_llegada: string;
}

// ==========================================
// TURN / QUEUE DTOs
// ==========================================
export interface TurnoDTO {
  id: number;
  id_atencion?: number;
  numero: string;
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

export interface LlamarSiguienteResponseDTO {
  mensaje: string;
  turno: TurnoDTO | null;
}

// ==========================================
// CONSULTORIO DTOs
// ==========================================
export interface MiEstadoDTO {
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

export interface ConsultorioDTO {
  id_consultorio?: number;
  id: number;
  nombre: string;
  estado_fisico: string;
  id_servicio?: number;
  id_sede?: number;
  servicio_nombre?: string;
  piso?: string;
}

export interface AdminConsultorioDTO {
  id: number;
  nombre: string;
  estado: string;
  servicio_id?: number;
}

export interface ConsultorioEstadoDTO {
  id_consultorio: number;
  nombre: string;
  estado: string;
  turno_actual?: TurnoDTO | null;
  especialidad_nombre?: string;
  medico_nombre?: string;
}

// ==========================================
// ADMIN DTOs
// ==========================================
export interface PersonalDTO {
  id_usuario: number;
  id?: number;
  cedula?: string;
  username?: string;
  nombre: string;
  apellido?: string;
  telefono?: string;
  email?: string;
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

export interface CrearPersonalRequest {
  cedula: string;
  nombre: string;
  apellido?: string;
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

export interface ServicioDTO {
  id: number;
  nombre: string;
  prefijo?: string;
  activo: boolean;
}

export interface CrearServicioRequest {
  nombre: string;
  prefijo?: string;
  piso?: string;
  activo?: boolean;
}

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
  consultorios_ids?: number[];
}

export interface CrearEspecialidadRequest {
  nombre: string;
  prefijo?: string;
  id_servicio?: number;
  id_sede?: number;
  piso?: string;
  consultorios_ids?: number[];
  activo?: boolean;
}

export interface SedeDTO {
  id_sede: number;
  id?: number;
  nombre: string;
  direccion?: string;
  activo?: boolean;
}

export interface AseguradoraDTO {
  id_cliente: number;
  aseguradora?: string;
  nombre?: string;
  tipo?: string;
  id_sede?: number;
}

// ==========================================
// REPORT DTOs
// ==========================================
export interface ReporteDiarioDTO {
  total: number;
  turnos: TurnoReporteDTO[];
  estadisticas: {
    atendidos: number;
    ausentes: number;
    en_espera: number;
  };
}

export interface TurnoReporteDTO {
  id: number;
  numero: string;
  estado: string;
  hora_llegada: string;
  hora_fin?: string;
  servicio_nombre: string;
  id_sede: number;
  paciente: {
    nombre: string;
    apellido?: string;
    documento: string;
    telefono?: string | null;
  };
}

// ==========================================
// MEDICO DTOs
// ==========================================
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

// ==========================================
// GENERIC DTOs
// ==========================================
export interface ApiResponse<T = unknown> {
  mensaje: string;
  data?: T;
}

export interface ErrorResponse {
  mensaje: string;
  error?: string;
}

export interface HealthResponse {
  status: string;
  message: string;
}

export interface EstadoActualizadoResponse {
  id_estado_actual: number;
}
