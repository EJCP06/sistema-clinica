import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env/environment';
import { io, Socket } from 'socket.io-client';
import {
  LoginRequest,
  LoginResponse,
  AdmisionDTO,
  PacienteDTO,
  TurnoDTO,
  ConsultorioDTO,
  MiEstadoDTO,
  PersonalDTO,
  ServicioDTO,
  EspecialidadDTO,
  SedeDTO,
  AseguradoraDTO,
  ReporteDiarioDTO,
  ApiResponse,
  LlamarSiguienteResponseDTO,
  GenerarTurnoRequest,
  RolDTO,
  CrearRolRequest,
  PermisoDTO,
  MatrizPermisosDTO,
  RecursoMatrizDTO,
} from '@core/models/dto.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private socket: Socket;
  public cambios$ = new Subject<{ tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number }>();

  constructor() {
    const token = sessionStorage.getItem('clinica_token');
    this.socket = io(environment.socketUrl, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });
    this.socket.on('estado-actualizado', (data: unknown) => {
      this.cambios$.next(data as { tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number });
    });
    this.socket.on('nuevo-llamado', (data: unknown) => {
      this.cambios$.next(data as { tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number });
    });
    this.socket.on('connect_error', () => {
      setTimeout(() => { if (!this.socket.connected) this.socket.connect(); }, 3000);
    });
  }

  // =========================
  // MÉTODOS GENÉRICOS
  // =========================
  get<T = unknown>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.base}/${endpoint}`);
  }

  post<T = unknown>(endpoint: string, data: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${endpoint}`, data);
  }

  put<T = unknown>(endpoint: string, data: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${endpoint}`, data);
  }

  delete<T = unknown>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${endpoint}`);
  }

  // =========================
  // AUTH
  // =========================
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, { username, password });
  }

  // =========================
  // TURNOS
  // =========================
  crearTurno(body: GenerarTurnoRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/turnos`, body);
  }

  getTurnosTodos(): Observable<TurnoDTO[]> {
    return this.http.get<TurnoDTO[]>(`${this.base}/turnos/todos`);
  }

  actualizarEstadoAtencion(idAtencion: number, idEstadoNuevo: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/recepcion/atencion/${idAtencion}/estado`, {
      id_estado_nuevo: idEstadoNuevo,
    });
  }

  reincorporarPaciente(idAtencion: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/turnos/${idAtencion}/reincorporar`, {});
  }

  // =========================
  // CONSULTORIOS
  // =========================
  getMiEstado(): Observable<MiEstadoDTO> {
    return this.http.get<MiEstadoDTO>(`${this.base}/consultorios/mi-estado`);
  }

  llamarSiguiente(): Observable<LlamarSiguienteResponseDTO> {
    return this.http.post<LlamarSiguienteResponseDTO>(
      `${this.base}/consultorios/llamar-siguiente`,
      {},
    );
  }

  iniciarAtencion(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/iniciar-atencion`, {});
  }

  finalizarAtencion(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/finalizar-atencion`, {});
  }

  liberarConsultorio(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/liberar-consultorio`, {});
  }

  // =========================
  // SERVICIOS / ESPECIALIDADES
  // =========================
  marcarAusente(turnoId: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/turnos/${turnoId}/ausente`, {});
  }

  // =========================
  // ADMIN & SERVICES
  // =========================
  getReporteDiario(): Observable<ReporteDiarioDTO> {
    return this.http.get<ReporteDiarioDTO>(`${this.base}/admin/reportes/diario`);
  }


  getTurnos(): Observable<TurnoDTO[]> {
    return this.http.get<TurnoDTO[]>(`${this.base}/turnos`);
  }

  getServicios(): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(`${this.base}/admin/servicios`);
  }

  getEspecialidades(): Observable<EspecialidadDTO[]> {
    return this.http.get<EspecialidadDTO[]>(`${this.base}/especialidades`);
  }

  getSedes(): Observable<SedeDTO[]> {
    return this.http.get<SedeDTO[]>(`${this.base}/admin/sedes`);
  }

  getPersonal(rol?: string): Observable<PersonalDTO[]> {
    const params = rol ? `?rol=${rol}` : '';
    return this.http.get<PersonalDTO[]>(`${this.base}/admin/personal${params}`);
  }

  crearPersonal(body: Partial<PersonalDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/personal`, body);
  }

  actualizarPersonal(id: number, body: Partial<PersonalDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/personal/${id}`, body);
  }

  eliminarPersonal(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/personal/${id}`);
  }

  crearEspecialidad(body: Partial<EspecialidadDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/especialidades`, body);
  }

  actualizarEspecialidad(id: number, body: Partial<EspecialidadDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/especialidades/${id}`, body);
  }

  eliminarEspecialidad(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/especialidades/${id}`);
  }

  getAseguradoras(): Observable<AseguradoraDTO[]> {
    return this.http.get<AseguradoraDTO[]>(`${this.base}/shared/aseguradoras`);
  }

  crearAseguradora(body: { nombre: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/shared/aseguradoras`, body);
  }

  getConsultorios(): Observable<ConsultorioDTO[]> {
    return this.http.get<ConsultorioDTO[]>(`${this.base}/admin/consultorios`);
  }

  crearServicio(body: Partial<ServicioDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/servicios`, body);
  }

  actualizarServicio(id: number, body: Partial<ServicioDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/servicios/${id}`, body);
  }

  eliminarServicio(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/servicios/${id}`);
  }

  crearConsultorio(body: Partial<ConsultorioDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/consultorios`, body);
  }

  actualizarConsultorio(id: number, body: Partial<ConsultorioDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/consultorios/${id}`, body);
  }

  eliminarConsultorio(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/consultorios/${id}`);
  }

  // =========================
  // BULK IMPORT (Excel)
  // =========================
  importarPersonal(body: { rows: Record<string, unknown>[]; rol: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/personal/importar`, body);
  }

  importarEspecialidades(body: { rows: Record<string, unknown>[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/especialidades/importar`, body);
  }

  importarAseguradoras(body: { rows: Record<string, unknown>[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/shared/aseguradoras/importar`, body);
  }

  // =========================
  // ROLES
  // =========================
  getRoles(): Observable<RolDTO[]> {
    return this.http.get<RolDTO[]>(`${this.base}/admin/roles`);
  }

  crearRol(body: Partial<CrearRolRequest>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/roles`, body);
  }

  actualizarRol(id: number, body: Partial<CrearRolRequest>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/roles/${id}`, body);
  }

  eliminarRol(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/roles/${id}`);
  }

  // =========================
  // PERMISOS
  // =========================
  getPermisos(): Observable<PermisoDTO[]> {
    return this.http.get<PermisoDTO[]>(`${this.base}/admin/permisos`);
  }

  getPermisosByRol(idRol: number): Observable<PermisoDTO[]> {
    return this.http.get<PermisoDTO[]>(`${this.base}/admin/roles/${idRol}/permisos`);
  }

  asignarPermisos(idRol: number, permisos: string[]): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/roles/${idRol}/permisos`, { permisos });
  }

  getMatrizPermisos(): Observable<MatrizPermisosDTO> {
    return this.http.get<MatrizPermisosDTO>(`${this.base}/admin/permisos/matriz`);
  }

  recargarCachePermisos(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/permisos/recargar-cache`, {});
  }

  seedPermisosAdmin(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/permisos/seed-admin`, {});
  }
}
