import { Injectable, inject, ChangeDetectorRef } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { ScrollService } from '../../core/services/scroll.service';
import { fechaABackend, fechaADisplay } from './recepcion-fechas.util';
import { RecepcionSeleccionService } from './recepcion-seleccion.service';

export interface NuevoPaciente {
  id_paciente?: number | null;
  id_cliente?: number | null;
  cedula: string;
  tipo_documento: string;
  nombre?: string;
  primer_nombre: string;
  segundo_nombre: string;
  primer_apellido: string;
  segundo_apellido: string;
  fecha_nacimiento: string;
  telefono: string;
  status: boolean;
}

@Injectable({ providedIn: 'root' })
export class RecepcionPacienteService {
  private api = inject(ApiService);
  private swal = inject(SwalService);
  private scrollService = inject(ScrollService);
  private seleccionSvc = inject(RecepcionSeleccionService);

  nuevoPaciente: NuevoPaciente = {
    cedula: '', tipo_documento: 'v', primer_nombre: '', segundo_nombre: '',
    primer_apellido: '', segundo_apellido: '', fecha_nacimiento: '', telefono: '', status: true,
  };

  pacienteExistenteCargado = false;
  esRegistroDirecto = false;
  isEditMode = false;

  get nombreCompleto(): string {
    const p = this.nuevoPaciente;
    const nombres = [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ');
    const apellidos = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
    return [nombres, apellidos].filter(Boolean).join(' ').trim();
  }

  prepararNuevoPaciente(isAseguradorasView: boolean, cedulaBusqueda: string, searchFilter: string) {
    this.pacienteExistenteCargado = false;
    this.esRegistroDirecto = true;
    this.isEditMode = false;
    this.nuevoPaciente = {
      id_paciente: null, cedula: '', tipo_documento: 'v', primer_nombre: '', segundo_nombre: '',
      primer_apellido: '', segundo_apellido: '', fecha_nacimiento: '', telefono: '', status: true,
    };
    this.seleccionSvc.resetSeleccion();
    this.seleccionSvc.seleccion.id_responsable = isAseguradorasView ? 2 : null;
    if (cedulaBusqueda && cedulaBusqueda.trim().length > 0) {
      const val = cedulaBusqueda.trim();
      if (searchFilter === 'cedula' || (!isNaN(Number(val)) && searchFilter === 'todo')) {
        this.nuevoPaciente.cedula = val;
        this.onCedulaFormChange(val, false);
      } else if (searchFilter === 'nombre') {
        this.nuevoPaciente.primer_nombre = val.toUpperCase();
      } else if (searchFilter === 'apellido') {
        this.nuevoPaciente.primer_apellido = val.toUpperCase();
      }
    }
  }

  onCedulaFormChange(cedula: string, isEditMode: boolean) {
    if (isEditMode) return;
    if (!cedula || cedula.trim().length < 2) {
      this.pacienteExistenteCargado = false;
      this.nuevoPaciente.id_paciente = null;
      return;
    }
    return this.api.get<any[]>(`recepcion/pacientes/${cedula}`).subscribe({
      next: (data) => {
        const p = data ? data.find((paciente: any) => paciente.cedula === cedula && paciente.tipo_documento === this.nuevoPaciente.tipo_documento) : null;
        if (p) {
          this.pacienteExistenteCargado = true;
          this.nuevoPaciente.id_paciente = p.id_paciente || p.id;
          this.nuevoPaciente.cedula = p.cedula;
          this.nuevoPaciente.tipo_documento = p.tipo_documento || 'v';
          this.nuevoPaciente.primer_nombre = p.primer_nombre || p.nombre || '';
          this.nuevoPaciente.segundo_nombre = p.segundo_nombre || '';
          this.nuevoPaciente.primer_apellido = p.primer_apellido || p.apellido || '';
          this.nuevoPaciente.segundo_apellido = p.segundo_apellido || '';
          this.nuevoPaciente.fecha_nacimiento = fechaADisplay(p.fecha_nacimiento);
          this.nuevoPaciente.telefono = p.telefono;
        } else {
          if (this.nuevoPaciente.id_paciente) {
            this.nuevoPaciente.primer_nombre = '';
            this.nuevoPaciente.segundo_nombre = '';
            this.nuevoPaciente.primer_apellido = '';
            this.nuevoPaciente.segundo_apellido = '';
            this.nuevoPaciente.fecha_nacimiento = '';
            this.nuevoPaciente.telefono = '';
          }
          this.pacienteExistenteCargado = false;
          this.nuevoPaciente.id_paciente = null;
        }
      },
      error: () => {
        this.pacienteExistenteCargado = false;
        this.nuevoPaciente.id_paciente = null;
      },
    });
  }

  seleccionarPaciente(paciente: any, abrirModalCb: () => void) {
    this.pacienteExistenteCargado = true;
    this.isEditMode = false;
    abrirModalCb();
    this.nuevoPaciente = {
      id_paciente: paciente.id_paciente || paciente.id, cedula: paciente.cedula,
      tipo_documento: paciente.tipo_documento || 'v',
      primer_nombre: paciente.primer_nombre || paciente.nombre || '',
      segundo_nombre: paciente.segundo_nombre || '',
      primer_apellido: paciente.primer_apellido || paciente.apellido || '',
      segundo_apellido: paciente.segundo_apellido || '',
      fecha_nacimiento: fechaADisplay(paciente.fecha_nacimiento),
      telefono: paciente.telefono, status: true,
    };
    this.seleccionSvc.resetSeleccion();
  }

  editarPaciente(fila: any) {
    this.pacienteExistenteCargado = true;
    this.nuevoPaciente = {
      id_paciente: fila.id_paciente, cedula: fila.cedula,
      tipo_documento: fila.tipo_documento || 'v',
      primer_nombre: fila.nombre, segundo_nombre: fila.segundo_nombre || '',
      primer_apellido: fila.apellido, segundo_apellido: fila.segundo_apellido || '',
      fecha_nacimiento: fechaADisplay(fila.fecha_nacimiento), telefono: fila.telefono, status: true,
    };
    this.seleccionSvc.seleccion = {
      id_servicio: fila.id_servicio, id_responsable: fila.id_responsable,
      id_cliente: fila.id_cliente, id_atencion: fila.id_atencion,
      id_especialidad: fila.id_especialidad, id_medico: fila.id_medico || null,
      id_consultorio: fila.id_consultorio || null,
      nombre_medico_label: fila.nombre_medico || '', nombre_servicio_label: '',
      nombre_especialidad_label: '',
    };
    this.seleccionSvc.categoriaServicio = this.seleccionSvc.getServicioCategoria(fila.nombre_servicio);
    const asig = this.seleccionSvc['_aseguradorasRef']?.find((a: any) => a.id_cliente === fila.id_cliente);
    this.seleccionSvc.aseguradoraFiltro = asig ? asig.aseguradora : '';
    if (fila.id_especialidad) {
      const esp = this.seleccionSvc.especialidades.find((e: any) => (e.id_especialidad || e.id) === fila.id_especialidad);
      if (esp) {
        this.seleccionSvc.seleccion.nombre_especialidad_label = esp.nombre;
        this.seleccionSvc.especialidadFiltro = esp.nombre;
      }
    }
    this.seleccionSvc.medicoFiltro = fila.nombre_medico || (fila.id_medico ? this.seleccionSvc.getNombreMedicoLabel(fila.id_medico) : '');
  }

  soloLetras(event: any) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) { event.preventDefault(); return; }
    const input = event.target as HTMLInputElement;
    if (inputChar === ' ' && input.value.length === 0) event.preventDefault();
  }

  trimCampo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.trim();
    input.dispatchEvent(new Event('input'));
  }

  soloNumeros(event: any) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault();
  }

  onDocKeyPress(event: any, tipoDocumento: string) {
    const input = event.target as HTMLInputElement;
    const maxLen = tipoDocumento === 'p' ? 12 : 8;
    const pattern = tipoDocumento === 'p' ? /[a-zA-Z0-9]/ : /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && (!pattern.test(inputChar) || input.value.length >= maxLen)) event.preventDefault();
  }

  onDocTypeChange() {
    const tipo = this.nuevoPaciente.tipo_documento;
    const maxLen = tipo === 'p' ? 12 : 8;
    const val = (this.nuevoPaciente.cedula || '').toString();
    if (val.length > maxLen) this.nuevoPaciente.cedula = val.substring(0, maxLen);
  }

  getDocPlaceholder(): string {
    return this.nuevoPaciente.tipo_documento === 'p' ? 'Ej: AB1234567' : 'Ej: 13894759';
  }

  getDocTypeLabel(): string {
    const labels: Record<string, string> = { v: 'V', e: 'E', p: 'P' };
    return labels[this.nuevoPaciente.tipo_documento] || 'V';
  }

  seleccionarDocType(tipo: string) {
    this.nuevoPaciente.tipo_documento = tipo;
    this.onDocTypeChange();
  }
}
