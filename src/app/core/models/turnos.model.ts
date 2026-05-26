export interface Paciente {
  documento: string;
  nombre: string;
  telefono?: string;
}

export interface Especialidad {
  id: string;
  nombre: string; // ej. Pediatría
  ubicacion: string; // ej. Piso 1
  prefijo: string; // ej. PED
}

export interface Consultorio {
  id: string;
  nombre: string;
  especialidadId: string;
  estado: 'LIBRE' | 'EN_DESCANSO' | 'EN_ATENCION' | 'STANDBY';
  medicoAsignado: string;
  turnoActualId?: string;
}

export type EstadoTurno = 'EN_ESPERA' | 'LLAMADO' | 'EN_ATENCION' | 'ATENDIDO' | 'AUSENTE' | 'TRANSFERIDO' | 'DESCARTADO';

export interface Turno {
  id: string; // ej. PED-009
  numero: number; // 9
  paciente: Paciente;
  especialidadId: string;
  estado: EstadoTurno;
  horaLlegada: Date;
  horaLlamado?: Date;
  horaInicioAtencion?: Date;
  horaFin?: Date;
  consultorioId?: string;
}
