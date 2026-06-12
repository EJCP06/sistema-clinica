export type Rol = string;

export interface Usuario {
  id: number;
  nombre: string;
  apellido?: string;
  username: string;
  password: string;
  rol: Rol;
  permisos: string[];
  consultorioId?: string;    // para compatibilidad con mock anterior
  consultorio_id?: number;   // viene del backend real
  servicio_id?: number;
  id_especialidad?: number;
  especialidad_nombre?: string;
  id_sede?: number;
}

export interface Sede {
  id_sede: number;
  nombre: string;
}
