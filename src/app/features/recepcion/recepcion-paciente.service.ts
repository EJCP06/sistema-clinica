import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../core/services/api.service';
import { SwalService } from '../../core/services/swal.service';
import { ScrollService } from '../../core/services/scroll.service';
import { fechaADisplay } from './recepcion-fechas.util';
import { RecepcionSeleccionService } from './recepcion-seleccion.service';
import { SexoDTO, EstadoCivilDTO, ParentescoDTO } from '../../core/models/dto.models';

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
  email: string;
  direccion: string;
  /** Sexo: código 'M'/'F' (el select muestra Masculino/Femenino). */
  sexo: string;
  /** Estado civil: código 'S'/'C'/'V'/'D' (el select muestra Soltero(a)...). */
  estado_civil: string;
  /** Checkbox "menor de edad": true = se registra con representante. */
  con_representante: boolean;
  /** Cédula PELADA del representante (ej: 31693727). */
  cedula_representante: string;
  /** Número de hijo (1, 2, 3...); viaja dentro de la cédula armada '31693727-1'. */
  numero_hijo: string;
  /** Nombre del representante. */
  nombre_representante: string;
  /** Parentesco del representante (nombre del catálogo "Parentesco"). */
  parentesco_representante: string;
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
    primer_apellido: '', segundo_apellido: '', fecha_nacimiento: '', telefono: '', email: '', direccion: '',
    sexo: '', estado_civil: '', con_representante: false, cedula_representante: '', numero_hijo: '',
    nombre_representante: '', parentesco_representante: '', status: true,
  };

  /** Catálogos que alimentan los selects del modal (tablas Sexo/Estado_Civil/Parentesco). */
  sexos: SexoDTO[] = [];
  estadosCiviles: EstadoCivilDTO[] = [];
  parentescos: ParentescoDTO[] = [];

  constructor() {
    this.api.get<SexoDTO[]>('shared/sexos').subscribe({ next: (d) => (this.sexos = d || []), error: () => {} });
    this.api.get<EstadoCivilDTO[]>('shared/estados-civiles').subscribe({ next: (d) => (this.estadosCiviles = d || []), error: () => {} });
    this.api.get<ParentescoDTO[]>('shared/parentescos').subscribe({ next: (d) => (this.parentescos = d || []), error: () => {} });
  }

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
      primer_apellido: '', segundo_apellido: '', fecha_nacimiento: '', telefono: '', email: '', direccion: '',
      sexo: '', estado_civil: '', con_representante: false, cedula_representante: '', numero_hijo: '',
      nombre_representante: '', parentesco_representante: '', status: true,
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
          this.nuevoPaciente.telefono = p.telefono || '';
          this.nuevoPaciente.email = p.email || '';
          this.nuevoPaciente.direccion = p.direccion || '';
          this.nuevoPaciente.sexo = p.sexo || '';
          this.nuevoPaciente.estado_civil = p.estado_civil || '';
          this.cargarRepresentante(p);
        } else {
          if (this.nuevoPaciente.id_paciente) {
            this.nuevoPaciente.primer_nombre = '';
            this.nuevoPaciente.segundo_nombre = '';
            this.nuevoPaciente.primer_apellido = '';
            this.nuevoPaciente.segundo_apellido = '';
            this.nuevoPaciente.fecha_nacimiento = '';
            this.nuevoPaciente.telefono = '';
            this.nuevoPaciente.email = '';
            this.nuevoPaciente.direccion = '';
            this.nuevoPaciente.sexo = '';
            this.nuevoPaciente.estado_civil = '';
            this.nuevoPaciente.con_representante = false;
            this.nuevoPaciente.cedula_representante = '';
            this.nuevoPaciente.numero_hijo = '';
            this.nuevoPaciente.nombre_representante = '';
            this.nuevoPaciente.parentesco_representante = '';
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
      telefono: paciente.telefono || '', email: paciente.email || '', direccion: paciente.direccion || '',
      sexo: paciente.sexo || '', estado_civil: paciente.estado_civil || '',
      con_representante: false, cedula_representante: '', numero_hijo: '', nombre_representante: '',
      parentesco_representante: '', status: true,
    };
    this.cargarRepresentante(paciente);
    this.seleccionSvc.resetSeleccion();
  }

  editarPaciente(fila: any) {
    this.pacienteExistenteCargado = true;
    this.nuevoPaciente = {
      id_paciente: fila.id_paciente, cedula: fila.cedula,
      tipo_documento: fila.tipo_documento || 'v',
      primer_nombre: fila.nombre || '', segundo_nombre: fila.segundo_nombre || '',
      primer_apellido: fila.apellido || '', segundo_apellido: fila.segundo_apellido || '',
      fecha_nacimiento: fechaADisplay(fila.fecha_nacimiento), telefono: fila.telefono || '', email: fila.email || '', direccion: fila.direccion || '',
      sexo: fila.sexo || '', estado_civil: fila.estado_civil || '',
      con_representante: false, cedula_representante: '', numero_hijo: '', nombre_representante: '',
      parentesco_representante: '', status: true,
    };
    this.cargarRepresentante(fila);
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

  /**
   * Carga los datos del representante de un paciente ya registrado.
   *
   * Si el paciente es niño (cédula armada '31693727-1' o con representante
   * guardado) el checkbox "Es niño(a)" queda MARCADO al abrir el modal. Los
   * datos del representante se cargan en cualquier caso.
   */
  private cargarRepresentante(p: any) {
    const cedula = (p?.cedula || '').toString();
    const esMenor = /^\d{6,8}-\d{1,2}$/.test(cedula);
    const partes = esMenor ? cedula.split('-') : [];
    const tieneRep = !!(p?.cedula_representante || p?.nombre_representante || p?.numero_hijo);
    this.nuevoPaciente.con_representante = esMenor || tieneRep;
    this.nuevoPaciente.cedula_representante = p?.cedula_representante || (esMenor ? partes[0] : '');
    // "numero_hijo" viene de la BD; si es un registro antiguo sin columna se
    // recupera del trozo después del guion de la cédula armada.
    this.nuevoPaciente.numero_hijo = p?.numero_hijo ? String(p.numero_hijo) : (esMenor ? partes[1] || '' : '');
    this.nuevoPaciente.nombre_representante = p?.nombre_representante || '';
    this.nuevoPaciente.parentesco_representante = p?.parentesco_representante || '';
  }

  /**
   * Cambio del checkbox "menor de edad".
   *  - Al marcarlo: el paciente se registrará con la cédula armada del representante.
   *  - Al desmarcarlo (p. ej. el niño ya tiene cédula propia): NO se borra la
   *    cédula, para que siga viéndose la que tenía y pueda editarse por la
   *    nueva; solo se rellena con la armada si el campo estaba vacío.
   *    Los datos del representante NO se borran de la BD al guardar: el backend
   *    usa COALESCE y conserva el histórico si no se envían.
   */
  onConRepresentanteChange(con: boolean) {
    this.nuevoPaciente.con_representante = con;
    if (!con && !(this.nuevoPaciente.cedula || '').trim()) {
      // El tipo de documento (V/E/P) seleccionado en el representante se
      // conserva: es el mismo campo "tipo_documento" del paciente.
      this.nuevoPaciente.cedula = this.cedulaArmada;
    }
  }

  /** Cédula armada del menor: '31693727-1' (cédula del representante + número de hijo). */
  get cedulaArmada(): string {
    const rep = (this.nuevoPaciente.cedula_representante || '').replace(/\D/g, '');
    const hijo = (this.nuevoPaciente.numero_hijo || '').replace(/\D/g, '');
    return rep && hijo ? `${rep}-${hijo}` : '';
  }

  getSexoLabel(): string {
    return this.sexos.find((s) => s.codigo === this.nuevoPaciente.sexo)?.nombre || '';
  }

  getEstadoCivilLabel(): string {
    return this.estadosCiviles.find((e) => e.codigo === this.nuevoPaciente.estado_civil)?.nombre || '';
  }

  getParentescoLabel(): string {
    const seleccionado = (this.nuevoPaciente.parentesco_representante || '').trim();
    if (!seleccionado) return '';
    // Coincidencia sin importar mayúsculas/acentos; si no está en el catálogo
    // se muestra el valor guardado tal cual (registros antiguos o personalizados).
    return this.parentescos.find((p) => this.mismaClave(p.nombre, seleccionado))?.nombre || seleccionado;
  }

  esParentescoSeleccionado(nombre: string): boolean {
    const seleccionado = (this.nuevoPaciente.parentesco_representante || '').trim();
    return !!seleccionado && this.mismaClave(nombre, seleccionado);
  }

  private mismaClave(a: string, b: string): boolean {
    const norm = (v: string) => (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return norm(a) === norm(b);
  }

  seleccionarSexo(codigo: string) {
    this.nuevoPaciente.sexo = codigo;
  }

  seleccionarEstadoCivil(codigo: string) {
    this.nuevoPaciente.estado_civil = codigo;
  }

  seleccionarParentesco(nombre: string) {
    this.nuevoPaciente.parentesco_representante = nombre;
  }

  /** Opciones del select "Numero de Hijo": del 1 al 12 (se guardan como texto). */
  readonly numerosHijo: string[] = Array.from({ length: 12 }, (_, i) => String(i + 1));

  seleccionarNumeroHijo(numero: string) {
    this.nuevoPaciente.numero_hijo = numero;
  }

  getNumeroHijoLabel(): string {
    return (this.nuevoPaciente.numero_hijo || '').replace(/\D/g, '');
  }
}
