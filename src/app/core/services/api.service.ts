import { Injectable, inject, NgZone } from '@angular/core';
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
  private zone = inject(NgZone);
  private base = environment.apiUrl;
  private socket!: Socket;
  /** Observable que emite eventos en tiempo real (cambios de estado, nuevos llamados, actualización de permisos). */
  public cambios$ = new Subject<{ tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; apellido?: string; id_sede?: number }>();

  constructor() {
    this.conectarSocket(sessionStorage.getItem('clinica_token'));
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !this.socket?.connected) {
          this.socket?.connect();
        }
      });
    }
  }

  private conectarSocket(token: string | null) {
    this.zone.runOutsideAngular(() => {
      this.socket = io(environment.socketUrl, {
        auth: { token },
        transports: ['polling', 'websocket'],
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
        autoConnect: true,
      });
      this.socket.on('estado-actualizado', (data: unknown) => {
        this.zone.run(() => {
          this.cambios$.next(data as { tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number });
        });
      });
      this.socket.on('nuevo-llamado', (data: unknown) => {
        this.zone.run(() => {
          this.cambios$.next(data as { tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number });
        });
      });
      this.socket.on('permisos-actualizados', (data: unknown) => {
        this.zone.run(() => {
          this.cambios$.next({ tipo: 'permisos', ...(data as Record<string, any>) } as { tipo?: string; id_atencion?: number; turno?: string; consultorio?: string; paciente?: string; id_sede?: number });
        });
      });
      this.socket.on('usuario-desactivado', () => {
        this.zone.run(() => {
          this.cambios$.next({ tipo: 'usuario-desactivado' } as any);
        });
      });
      this.socket.on('connect_error', () => {
        setTimeout(() => { if (!this.socket.connected) this.socket.connect(); }, 3000);
      });
    });
  }

  /**
   * Actualiza el token de autenticación del socket y reconecta.
   * Si no hay socket previo lo crea; si el token es nulo desconecta.
   */
  actualizarSocketToken(token: string | null) {
    if (token) {
      if (this.socket) {
        this.socket.auth = { token };
        this.socket.disconnect().connect();
      } else {
        this.conectarSocket(token);
      }
    } else {
      if (this.socket) {
        this.socket.disconnect();
      }
    }
  }

  /**
   * @param endpoint - Ruta relativa de la API
   * @returns Observable con la respuesta tipada
   */
  get<T = unknown>(endpoint: string): Observable<T> {
    return this.http.get<T>(`${this.base}/${endpoint}`);
  }

  /**
   * @param endpoint - Ruta relativa de la API
   * @param data - Cuerpo de la petición
   * @returns Observable con la respuesta tipada
   */
  post<T = unknown>(endpoint: string, data: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}/${endpoint}`, data);
  }

  /**
   * @param endpoint - Ruta relativa de la API
   * @param data - Cuerpo de la petición
   * @returns Observable con la respuesta tipada
   */
  put<T = unknown>(endpoint: string, data: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}/${endpoint}`, data);
  }

  /**
   * @param endpoint - Ruta relativa de la API
   * @returns Observable con la respuesta tipada
   */
  delete<T = unknown>(endpoint: string): Observable<T> {
    return this.http.delete<T>(`${this.base}/${endpoint}`);
  }

  /**
   * Autentica al usuario y retorna token + datos del usuario.
   */
  login(username: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/login`, { username, password });
  }

  /** Registra un nuevo turno en el sistema. */
  crearTurno(body: GenerarTurnoRequest): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/turnos`, body);
  }

  /** Obtiene todos los turnos registrados (uso administrativo). */
  getTurnosTodos(): Observable<TurnoDTO[]> {
    return this.http.get<TurnoDTO[]>(`${this.base}/turnos/todos`);
  }

  /** Cambia el estado de una atención (ej. espera → llamado). */
  actualizarEstadoAtencion(idAtencion: number, idEstadoNuevo: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/recepcion/atencion/${idAtencion}/estado`, {
      id_estado_nuevo: idEstadoNuevo,
    });
  }

  /** Reincorpora a un paciente que había sido marcado como ausente. */
  reincorporarPaciente(idAtencion: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/turnos/${idAtencion}/reincorporar`, {});
  }

  /** Estado actual del consultorio del médico autenticado. */
  getMiEstado(): Observable<MiEstadoDTO> {
    return this.http.get<MiEstadoDTO>(`${this.base}/consultorios/mi-estado`);
  }

  /** Llama al siguiente paciente en espera para el consultorio actual. */
  llamarSiguiente(): Observable<LlamarSiguienteResponseDTO> {
    return this.http.post<LlamarSiguienteResponseDTO>(
      `${this.base}/consultorios/llamar-siguiente`,
      {},
    );
  }

  /** Marca el inicio formal de la atención del paciente actual. */
  iniciarAtencion(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/iniciar-atencion`, {});
  }

  /** Finaliza la atención del paciente actual y libera el consultorio. */
  finalizarAtencion(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/finalizar-atencion`, {});
  }

  /** Fuerza la liberación del consultorio cuando queda colgado. */
  liberarConsultorio(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/consultorios/liberar-consultorio`, {});
  }

  /** Marca un turno como ausente por inasistencia del paciente. */
  marcarAusente(turnoId: number): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/turnos/${turnoId}/ausente`, {});
  }

  /**
   * @param fecha_desde - Fecha inicial ISO (opcional)
   * @param fecha_hasta - Fecha final ISO (opcional)
   * @returns Reporte con turnos, estadísticas y KPIs
   */
  getReporteDiario(fecha_desde?: string, fecha_hasta?: string): Observable<ReporteDiarioDTO> {
    const params = new URLSearchParams();
    if (fecha_desde) params.set('fecha_desde', fecha_desde);
    if (fecha_hasta) params.set('fecha_hasta', fecha_hasta);
    const qs = params.toString();
    return this.http.get<ReporteDiarioDTO>(`${this.base}/admin/reportes/diario${qs ? '?' + qs : ''}`);
  }


  /** Turnos del día filtrados para el usuario autenticado. */
  getTurnos(): Observable<TurnoDTO[]> {
    return this.http.get<TurnoDTO[]>(`${this.base}/turnos`);
  }

  /** Catálogo de servicios médicos disponibles. */
  getServicios(): Observable<ServicioDTO[]> {
    return this.http.get<ServicioDTO[]>(`${this.base}/admin/servicios`);
  }

  /** Catálogo de especialidades médicas. */
  getEspecialidades(): Observable<EspecialidadDTO[]> {
    return this.http.get<EspecialidadDTO[]>(`${this.base}/especialidades`);
  }

  /** Sedes registradas en el sistema. */
  getSedes(): Observable<SedeDTO[]> {
    return this.http.get<SedeDTO[]>(`${this.base}/admin/sedes`);
  }

  /**
   * @param rol - Filtro opcional por nombre de rol
   * @returns Lista del personal
   */
  getPersonal(rol?: string): Observable<PersonalDTO[]> {
    const params = rol ? `?rol=${rol}` : '';
    return this.http.get<PersonalDTO[]>(`${this.base}/admin/personal${params}`);
  }

  /** Crea un nuevo registro de personal. */
  crearPersonal(body: Partial<PersonalDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/personal`, body);
  }

  /** Actualiza los datos de un miembro del personal. */
  actualizarPersonal(id: number, body: Partial<PersonalDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/personal/${id}`, body);
  }

  /** Elimina (desactiva) un usuario del sistema. */
  eliminarPersonal(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/personal/${id}`);
  }

  /** Crea una nueva especialidad médica. */
  crearEspecialidad(body: Partial<EspecialidadDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/especialidades`, body);
  }

  /** Actualiza los datos de una especialidad. */
  actualizarEspecialidad(id: number, body: Partial<EspecialidadDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/especialidades/${id}`, body);
  }

  /** Elimina una especialidad del catálogo. */
  eliminarEspecialidad(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/especialidades/${id}`);
  }

  /** Lista de aseguradoras registradas. */
  getAseguradoras(): Observable<AseguradoraDTO[]> {
    return this.http.get<AseguradoraDTO[]>(`${this.base}/shared/aseguradoras`);
  }

  /** Registra una nueva aseguradora. */
  crearAseguradora(body: { nombre: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/shared/aseguradoras`, body);
  }

  /** Catálogo de consultorios disponibles. */
  getConsultorios(): Observable<ConsultorioDTO[]> {
    return this.http.get<ConsultorioDTO[]>(`${this.base}/admin/consultorios`);
  }

  /** Crea un nuevo servicio. */
  crearServicio(body: Partial<ServicioDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/servicios`, body);
  }

  /** Actualiza un servicio existente. */
  actualizarServicio(id: number, body: Partial<ServicioDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/servicios/${id}`, body);
  }

  /** Elimina un servicio del catálogo. */
  eliminarServicio(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/servicios/${id}`);
  }

  /** Crea un nuevo consultorio. */
  crearConsultorio(body: Partial<ConsultorioDTO>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/consultorios`, body);
  }

  /** Actualiza los datos de un consultorio. */
  actualizarConsultorio(id: number, body: Partial<ConsultorioDTO>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/consultorios/${id}`, body);
  }

  /** Elimina un consultorio. */
  eliminarConsultorio(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/consultorios/${id}`);
  }

  /** Importación masiva de personal desde archivo Excel. */
  importarPersonal(body: { rows: Record<string, unknown>[]; rol: string }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/personal/importar`, body);
  }

  /** Importación masiva de especialidades desde Excel. */
  importarEspecialidades(body: { rows: Record<string, unknown>[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/especialidades/importar`, body);
  }

  /** Importación masiva de aseguradoras desde Excel. */
  importarAseguradoras(body: { rows: Record<string, unknown>[] }): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/shared/aseguradoras/importar`, body);
  }

  /** Roles de usuario disponibles en el sistema. */
  getRoles(): Observable<RolDTO[]> {
    return this.http.get<RolDTO[]>(`${this.base}/admin/roles`);
  }

  /** Crea un nuevo rol con sus permisos. */
  crearRol(body: Partial<CrearRolRequest>): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/roles`, body);
  }

  /** Actualiza un rol existente. */
  actualizarRol(id: number, body: Partial<CrearRolRequest>): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/roles/${id}`, body);
  }

  /** Elimina un rol del sistema. */
  eliminarRol(id: number): Observable<ApiResponse> {
    return this.http.delete<ApiResponse>(`${this.base}/admin/roles/${id}`);
  }

  /** Catálogo completo de permisos del sistema. */
  getPermisos(): Observable<PermisoDTO[]> {
    return this.http.get<PermisoDTO[]>(`${this.base}/admin/permisos`);
  }

  /** Permisos asignados a un rol específico. */
  getPermisosByRol(idRol: number): Observable<PermisoDTO[]> {
    return this.http.get<PermisoDTO[]>(`${this.base}/admin/roles/${idRol}/permisos`);
  }

  /** Asigna una lista de permisos a un rol. */
  asignarPermisos(idRol: number, permisos: string[]): Observable<ApiResponse> {
    return this.http.put<ApiResponse>(`${this.base}/admin/roles/${idRol}/permisos`, { permisos });
  }

  /** Matriz completa de recursos y acciones disponibles. */
  getMatrizPermisos(): Observable<MatrizPermisosDTO> {
    return this.http.get<MatrizPermisosDTO>(`${this.base}/admin/permisos/matriz`);
  }

  /** Recarga la caché de permisos en el servidor. */
  recargarCachePermisos(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/permisos/recargar-cache`, {});
  }

  /** Siembra los permisos base del rol administrador. */
  seedPermisosAdmin(): Observable<ApiResponse> {
    return this.http.post<ApiResponse>(`${this.base}/admin/permisos/seed-admin`, {});
  }
}
