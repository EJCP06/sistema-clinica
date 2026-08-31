/** Tipo alias para el nombre del rol (ej. administrador, medico). */
export type Rol = string;

/** Usuario autenticado con sus datos, rol y lista de permisos. */
export interface Usuario {
  id: number;
  id_rol?: number;
  nombre: string;
  apellido?: string;
  username: string;
  password: string;
  /** Nombre del rol (administrador, medico, recepcionista, etc.). */
  rol: Rol;
  /** Lista de claves de permiso (ej. admision:ver, personal:*). */
  permisos: string[];
  /** Todos los roles asignados al usuario (muchos a muchos). */
  roles?: { id: number; key: string; nombre: string; activo?: boolean }[];
  consultorioId?: string;
  consultorio_id?: number;
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_nombre?: string;
  /** Especialidades ACTIVAS del médico con las que puede entrar (id + nombre + su consultorio). */
  especialidades_activas?: { id: number; nombre: string; id_consultorio?: number }[];
  id_sede?: number;
}

/** Datos básicos de una sede/sucursal. */
export interface Sede {
  id_sede: number;
  nombre: string;
}
