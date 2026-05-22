import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@env/environment';

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
  // TURNOS (CORREGIDO)
  // =========================

  // ✅ crear turno
  crearTurno(body: {
    nombre_paciente: string;
    documento_paciente: string;
    telefono_paciente?: string;
    servicio_id: number;
    notificar?: boolean;
  }): Observable<any> {
    return this.http.post(`${this.base}/turnos`, body);
  }

  // ✅ LISTAR TURNOS (ARREGLADO)
  getTurnosTodos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/turnos/todos`);
  }

  // =========================
  // RECEPCIÓN
  // =========================
  actualizarEstadoAtencion(idAtencion: number, idEstadoNuevo: number): Observable<any> {
    return this.http.put(`${this.base}/recepcion/atencion/${idAtencion}/estado`, {
      id_estado_nuevo: idEstadoNuevo,
    });
  }

  // =========================
  // SHARED
  // =========================
  getAseguradoras(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/shared/aseguradoras`);
  }

  crearAseguradora(body: { nombre: string }): Observable<any> {
    return this.http.post(`${this.base}/shared/aseguradoras`, body);
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

  transferirPaciente(turnoId: number, nuevo_servicio_id: number): Observable<any> {
    return this.http.post(`${this.base}/turnos/${turnoId}/transferir`, {
      nuevo_servicio_id,
    });
  }

  marcarAusente(turnoId: number): Observable<any> {
    return this.http.put(`${this.base}/turnos/${turnoId}/ausente`, {});
  }

  // =========================
  // ADMIN
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

  getServicios(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/admin/servicios`);
  }

  getSedes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/admin/sedes`);
  }

  // =========================
  // PERSONAL
  // =========================
  getTurnos(): Observable<any[]> {
    return this.http.get<any[]>(`${this.base}/turnos`);
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

  // =========================
  // ADMIN (FALTANTES)
  // =========================

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
