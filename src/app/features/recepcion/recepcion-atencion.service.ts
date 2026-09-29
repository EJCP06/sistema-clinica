import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { fechaABackend } from './recepcion-fechas.util';
import { RecepcionSeleccionService } from './recepcion-seleccion.service';

export interface PacienteData { id_paciente?: number | null; cedula: string; tipo_documento: string; primer_nombre: string; segundo_nombre: string; primer_apellido: string; segundo_apellido: string; fecha_nacimiento: string; telefono: string; email: string; direccion: string;
  /** Sexo: código 'M'/'F'. */ sexo?: string;
  /** Estado civil: código 'S'/'C'/'V'/'D'. */ estado_civil?: string;
  /** Checkbox "menor de edad": si es true la cédula viene armada ('31693727-1'). */ con_representante?: boolean;
  /** Cédula pelada del representante. */ cedula_representante?: string;
  /** Número de hijo (va dentro de la cédula armada). */ numero_hijo?: string;
  /** Nombre del representante. */ nombre_representante?: string;
  /** Parentesco del representante. */ parentesco_representante?: string; }

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
    const conRep = !!nuevoPaciente.con_representante;
    const cedulaCruda = (nuevoPaciente.cedula || '').trim();
    const d = {
      // Con el check de "menor de edad" marcado, la cédula viene armada
      // ('31693727-1') y NO se le quita el guion; con el check desmarcado
      // también se conserva la armada (el niño ya tiene cédula y se está
      // editando) y en adultos solo quedan los dígitos.
      cedula: conRep ? cedulaCruda : (esNum ? (/^\d{6,8}-\d{1,2}$/.test(cedulaCruda) ? cedulaCruda : cedulaCruda.replace(/\D/g, '')) : cedulaCruda.toUpperCase()),
      tipo_documento: nuevoPaciente.tipo_documento || 'v',
      primer_nombre: (nuevoPaciente.primer_nombre || '').toUpperCase().trim(),
      segundo_nombre: (nuevoPaciente.segundo_nombre || '').toUpperCase().trim(),
      primer_apellido: (nuevoPaciente.primer_apellido || '').toUpperCase().trim(),
      segundo_apellido: (nuevoPaciente.segundo_apellido || '').toUpperCase().trim(),
      fecha_nacimiento: fechaABackend(nuevoPaciente.fecha_nacimiento),
      telefono: (nuevoPaciente.telefono || '').replace(/\D/g, '').trim(),
      email: (nuevoPaciente.email || '').trim().toLowerCase() || null,
      direccion: (nuevoPaciente.direccion || '').trim() || null,
      sexo: nuevoPaciente.sexo || null,
      estado_civil: nuevoPaciente.estado_civil || null,
      // Si el check está desmarcado vienen en null: el COALESCE del backend
      // conserva el histórico del representante (caso: el niño ya creció y
      // ahora tiene su propia cédula).
      cedula_representante: conRep ? (nuevoPaciente.tipo_documento === 'p' ? (nuevoPaciente.cedula_representante || '').trim().toUpperCase() : (nuevoPaciente.cedula_representante || '').replace(/\D/g, '')) : null,
      numero_hijo: conRep ? parseInt((nuevoPaciente.numero_hijo || '').replace(/\D/g, ''), 10) || null : null,
      nombre_representante: conRep ? (nuevoPaciente.nombre_representante || '').toUpperCase().trim() : null,
      parentesco_representante: conRep ? (nuevoPaciente.parentesco_representante || '').trim() : null,
    };
    this.api.put(`recepcion/pacientes/${id_paciente}`, d).subscribe({
      next: () => {
        if (esEdicionTotal) {
          const ba = { id_servicio: this.sel.seleccion.id_servicio, id_responsable: this.sel.seleccion.id_responsable, id_cliente: this.sel.seleccion.id_cliente, id_especialidad: this.sel.seleccion.id_especialidad || null, id_medico: this.sel.seleccion.id_medico || null, id_consultorio: this.sel.seleccion.id_consultorio || null };
          this.api.put(`recepcion/atencion/${this.sel.seleccion.id_atencion}`, ba).subscribe({ next: () => finalizarCb(() => { state.mostrarRegistro = false; this.swal.success('Cambios guardados con exito'); onReload(); this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.sel.seleccion.id_atencion ?? undefined }); }), error: () => finalizarCb(() => this.swal.error('Error al actualizar la atencion')) });
        } else {
          this.generarAtencionDirecta(id_paciente, state, finalizarCb, onReload);
        }
      },
      error: () => finalizarCb(() => this.swal.error('Error al actualizar datos del paciente')),
    });
  }
}
