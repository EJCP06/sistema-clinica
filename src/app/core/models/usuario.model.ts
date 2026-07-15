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
  consultorioId?: string;
  consultorio_id?: number;
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_nombre?: string;
  id_sede?: number;
}

/** Datos básicos de una sede/sucursal. */
export interface Sede {
  id_sede: number;
  nombre: string;
}

export interface Sede {
  id_sede: number;
  nombre: string;
}
