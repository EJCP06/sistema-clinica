import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '@env/environment';
import { io, Socket } from 'socket.io-client';

export type LlamarSiguienteResponse = {
  mensaje: string;
  turno: {
    id: number;
    numero: string;
    estado: string;
    hora_llegada: string;
    paciente: { nombre: string; documento: string; telefono?: string | null };
  };
};

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private base = environment.apiUrl;
  private socket: Socket;
  public cambios$ = new Subject<any>();

  constructor() {
    this.socket = io(environment.apiUrl.replace('/api', ''));
    this.socket.on('estado-actualizado', (data: any) => {
      this.cambios$.next(data);
    });
  }

  // =========================
  // MÉTODOS GENÉRICOS
  // =========================
  get(endpoint: string): Observable<any> {
    return this.http.get(`${this.base}/${endpoint}`);
  }

  post(endpoint: string, data: any): Observable<any> {
    return this.http.post(`${this.base}/${endpoint}`, data);
  }

  put(endpoint: string, data: any): Observable<any> {
    return this.http.put(`${this.base}/${endpoint}`, data);
  }

  delete(endpoint: string): Observable<any> {
    return this.http.delete(`${this.base}/${endpoint}`);
  }

  // =========================
  // AUTH
  // =========================
  login(username: string, password: string): Observable<any> {
    return this.http.post(`${this.base}/auth/login`, { username, password });
  }

  // =========================
  // TURNOS
  // =========================
  crearTurno(body: any): Observable<any> {
    return this.http.post(`${this.base}/turnos`, body);
  }

  getTurnosTodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/turnos/todos`);
  }

  actualizarEstadoAtencion(idAtencion: number, idEstadoNuevo: number): Observable<any> {
    return this.http.put(`${this.base}/recepcion/atencion/${idAtencion}/estado`, {
      id_estado_nuevo: idEstadoNuevo,
    });
  }

  // =========================
  // CONSULTORIOS
  // =========================
  getMiEstado(): Observable<any> {
    return this.http.get<any>(`${this.base}/consultorios/mi-estado`);
  }

  llamarSiguiente(): Observable<LlamarSiguienteResponse> {
    return this.http.post<LlamarSiguienteResponse>(
      `${this.base}/consultorios/llamar-siguiente`,
      {},
    );
  }

  iniciarAtencion(): Observable<any> {
    return this.http.post(`${this.base}/consultorios/iniciar-atencion`, {});
  }

  finalizarAtencion(): Observable<any> {
    return this.http.post(`${this.base}/consultorios/finalizar-atencion`, {});
  }

  pausarConsultorio(): Observable<any> {
    return this.http.put(`${this.base}/consultorios/pausar`, {});
  }

  reanudarConsultorio(): Observable<any> {
    return this.http.put(`${this.base}/consultorios/reanudar`, {});
  }

  // =========================
  // TURNOS ACCIONES
  // =========================
  pausarAtencion(turnoId: number): Observable<any> {
    return this.http.put(`${this.base}/turnos/${turnoId}/pausar`, {});
  }

  reanudarAtencion(turnoId: number): Observable<any> {
    return this.http.put(`${this.base}/turnos/${turnoId}/reanudar`, {});
  }

  marcarAusente(turnoId: number): Observable<any> {
    return this.http.put(`${this.base}/turnos/${turnoId}/ausente`, {});
  }

  // =========================
  // ADMIN & SERVICES
  // =========================
  getReporteDiario(): Observable<any> {
    return this.http.get(`${this.base}/admin/reportes/diario`);
  }

  getEstadisticasAvanzadas(fechaInicio?: string, fechaFin?: string): Observable<any> {
    const params =
      fechaInicio && fechaFin ? `?fecha_inicio=${fechaInicio}&fecha_fin=${fechaFin}` : '';
    return this.http.get(`${this.base}/admin/reportes/avanzadas${params}`);
  }

  cerrarSistema(): Observable<any> {
    return this.http.post(`${this.base}/admin/sistema/cerrar`, {});
  }

  getTurnos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/turnos`);
  }

  getServicios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/admin/servicios`);
  }

  getEspecialidades(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/especialidades`);
  }

  getSedes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/admin/sedes`);
  }

  getPersonal(rol?: string): Observable<any[]> {
    const params = rol ? `?rol=${rol}` : '';
    return this.http.get<any[]>(`${this.base}/admin/personal${params}`);
  }

  crearPersonal(body: any): Observable<any> {
    return this.http.post(`${this.base}/admin/personal`, body);
  }

  actualizarPersonal(id: number, body: any): Observable<any> {
    return this.http.put(`${this.base}/admin/personal/${id}`, body);
  }

  eliminarPersonal(id: number): Observable<any> {
    return this.http.delete(`${this.base}/admin/personal/${id}`);
  }

  crearEspecialidad(body: any): Observable<any> {
    return this.http.post(`${this.base}/especialidades`, body);
  }

  actualizarEspecialidad(id: number, body: any): Observable<any> {
    return this.http.put(`${this.base}/especialidades/${id}`, body);
  }

  eliminarEspecialidad(id: number): Observable<any> {
    return this.http.delete(`${this.base}/especialidades/${id}`);
  }

  getAseguradoras(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/shared/aseguradoras`);
  }

  crearAseguradora(body: { nombre: string }): Observable<any> {
    return this.http.post(`${this.base}/shared/aseguradoras`, body);
  }

  getConsultorios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/admin/consultorios`);
  }

  crearServicio(body: any): Observable<any> {
    return this.http.post(`${this.base}/admin/servicios`, body);
  }

  actualizarServicio(id: number, body: any): Observable<any> {
    return this.http.put(`${this.base}/admin/servicios/${id}`, body);
  }

  eliminarServicio(id: number): Observable<any> {
    return this.http.delete(`${this.base}/admin/servicios/${id}`);
  }

  crearConsultorio(body: any): Observable<any> {
    return this.http.post(`${this.base}/admin/consultorios`, body);
  }

  actualizarConsultorio(id: number, body: any): Observable<any> {
    return this.http.put(`${this.base}/admin/consultorios/${id}`, body);
  }

  eliminarConsultorio(id: number): Observable<any> {
    return this.http.delete(`${this.base}/admin/consultorios/${id}`);
  }
}
