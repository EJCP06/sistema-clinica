import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { fechaABackend } from './recepcion-fechas.util';
import { RecepcionSeleccionService } from './recepcion-seleccion.service';

export interface PacienteData { id_paciente?: number | null; cedula: string; tipo_documento: string; primer_nombre: string; segundo_nombre: string; primer_apellido: string; segundo_apellido: string; fecha_nacimiento: string; telefono: string; }

export interface RecepcionState {
  mostrarRegistro: boolean; pacienteEncontrado: any; cedulaBusqueda: string; isSaving: boolean;
}

@Injectable({ providedIn: 'root' })
export class RecepcionAtencionService {
  private api = inject(ApiService);
  private swal = inject(SwalService);
  private sel = inject(RecepcionSeleccionService);

  ultimasAdmisiones: any[] = [];

  cargarUltimasAdmisiones(onDone?: () => void) {
    this.api.get<any[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => { this.ultimasAdmisiones = (data || []).filter((a: any) => ![5, 6, 7, 9].includes(a.id_estado_actual)); onDone?.(); },
      error: (e: any) => { console.error('Error cargando admisiones:', e); onDone?.(); },
    });
  }

  generarAtencionDirecta(id_paciente: number, state: RecepcionState, finalizarCb: (fn?: () => void) => void, onReload: () => void) {
    const body = { id_paciente, id_servicio: this.sel.seleccion.id_servicio, id_responsable: this.sel.seleccion.id_responsable, id_cliente: this.sel.seleccion.id_cliente, id_especialidad: this.sel.seleccion.id_especialidad || null, id_medico: this.sel.seleccion.id_medico || null, id_consultorio: this.sel.seleccion.id_consultorio || null };
    this.api.post('recepcion/generar-turno', body).subscribe({
      next: (res: any) => finalizarCb(() => { state.mostrarRegistro = false; state.pacienteEncontrado = null; state.cedulaBusqueda = ''; this.swal.success('Generado con exito: ' + (res.numero || 'Listo')); onReload(); this.api.cambios$.next({ tipo: 'nuevo-turno', id_atencion: res.id_atencion }); }),
      error: (e: any) => { console.error('Error al generar turno:', e); finalizarCb(() => this.swal.error('Error al asignar el servicio / generar turno.')); },
    });
  }

  generarAtencion(pacienteEncontrado: any, state: RecepcionState, finalizarCb: (fn?: () => void) => void, onReload: () => void) {
    if (!this.sel.seleccion.id_servicio || !this.sel.seleccion.id_responsable) { this.swal.warning('Debe seleccionar Especialidad y Responsable de Pago'); return; }
    if (this.sel.seleccion.id_responsable === 2 && !this.sel.seleccion.id_cliente) { this.swal.warning('Debe seleccionar el nombre de la aseguradora'); return; }
    state.isSaving = true;
    const body = { id_paciente: pacienteEncontrado.id_paciente || pacienteEncontrado.id, id_servicio: this.sel.seleccion.id_servicio, id_responsable: this.sel.seleccion.id_responsable, id_cliente: this.sel.seleccion.id_cliente, id_especialidad: this.sel.seleccion.id_especialidad || null, id_medico: this.sel.seleccion.id_medico || null, id_consultorio: this.sel.seleccion.id_consultorio || null };
    this.api.post('recepcion/generar-turno', body).subscribe({
      next: (res: any) => finalizarCb(() => { state.pacienteEncontrado = null; state.mostrarRegistro = false; state.cedulaBusqueda = ''; this.swal.success('Turno / Servicio asignado con exito: ' + (res.numero || 'Listo')); onReload(); this.api.cambios$.next({ tipo: 'nuevo-turno', id_atencion: res.id_atencion }); }),
      error: (e: any) => { console.error('Error al asignar servicio:', e); finalizarCb(() => this.swal.error('Error al asignar el servicio')); },
    });
  }

  async marcarAusente(fila: any, onReload: () => void) {
    const r = await this.swal.confirm('Marcar como ausente?', 'Esta accion no se puede deshacer.');
    if (!r.isConfirmed) return;
    this.api.put(`recepcion/atencion/${fila.id_atencion}/marcar_ausente`, {}).subscribe({ next: () => { onReload(); this.swal.success('Paciente marcado como ausente correctamente'); }, error: () => this.swal.error('Error al marcar como ausente') });
  }

  async eliminarAdmision(fila: any, onReload: () => void) {
    const r = await this.swal.confirmDelete(`Eliminar admision de ${fila.nombre} ${fila.apellido}?`);
    if (!r.isConfirmed) return;
    if (fila.id_atencion) this.api.delete(`recepcion/atencion/${fila.id_atencion}`).subscribe({ next: () => { onReload(); this.swal.success('Atencion eliminada correctamente'); }, error: () => this.swal.error('Error al eliminar atencion') });
    else this.api.delete(`recepcion/pacientes/${fila.id_paciente}`).subscribe({ next: () => { onReload(); this.swal.success('Paciente eliminado correctamente'); }, error: () => this.swal.error('Error al eliminar paciente') });
  }

  actualizarPacienteExistente(id_paciente: number, esEdicionTotal: boolean, nuevoPaciente: PacienteData, state: RecepcionState, finalizarCb: (fn?: () => void) => void, onReload: () => void) {
    const esNum = nuevoPaciente.tipo_documento !== 'p';
    const d = { cedula: esNum ? nuevoPaciente.cedula.replace(/\D/g, '').trim() : nuevoPaciente.cedula.trim().toUpperCase(), tipo_documento: nuevoPaciente.tipo_documento || 'v', primer_nombre: nuevoPaciente.primer_nombre.toUpperCase().trim(), segundo_nombre: nuevoPaciente.segundo_nombre.toUpperCase().trim(), primer_apellido: nuevoPaciente.primer_apellido.toUpperCase().trim(), segundo_apellido: nuevoPaciente.segundo_apellido.toUpperCase().trim(), fecha_nacimiento: fechaABackend(nuevoPaciente.fecha_nacimiento), telefono: nuevoPaciente.telefono.replace(/\D/g, '').trim() };
    this.api.put(`recepcion/pacientes/${id_paciente}`, d).subscribe({
      next: () => {
        if (esEdicionTotal) {
          const ba = { id_servicio: this.sel.seleccion.id_servicio, id_responsable: this.sel.seleccion.id_responsable, id_cliente: this.sel.seleccion.id_cliente, id_especialidad: this.sel.seleccion.id_especialidad || null, id_medico: this.sel.seleccion.id_medico || null, id_consultorio: this.sel.seleccion.id_consultorio || null };
          this.api.put(`recepcion/atencion/${this.sel.seleccion.id_atencion}`, ba).subscribe({ next: () => finalizarCb(() => { state.mostrarRegistro = false; this.swal.success('Cambios guardados con exito'); onReload(); this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.sel.seleccion.id_atencion ?? undefined }); }), error: () => finalizarCb(() => this.swal.error('Error al actualizar la atencion')) });
        }
      },
      error: () => finalizarCb(() => this.swal.error('Error al actualizar datos del paciente')),
    });
  }
}
