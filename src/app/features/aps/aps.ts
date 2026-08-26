import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, interval } from 'rxjs';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, FileText, CheckCircle2, ChevronDown, Undo2, KeyRound, DollarSign, Trash2, Megaphone, Edit2, UserPlus, XCircle } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { EspecialidadesService } from '../../core/services/especialidades.service';
import { ScrollService } from '../../core/services/scroll.service';
import { AdmisionDTO } from '@core/models/dto.models';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';


@Component({
  selector: 'app-aps',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './aps.html'
})
/**
 * Componente APS (Atención Primaria en Salud).
 * Gestiona el flujo de pacientes: presupuesto, caja, clave de aseguradora,
 * sala de espera, reincorporación y marcado como ausente.
 */
export class ApsComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly FileText = FileText;
  readonly CheckCircle2 = CheckCircle2;
  readonly ChevronDown = ChevronDown;
  readonly Undo2 = Undo2;
  readonly KeyRound = KeyRound;
  readonly DollarSign = DollarSign;
  readonly Trash2 = Trash2;
  readonly Megaphone = Megaphone;
  readonly Edit2 = Edit2;
  readonly UserPlus = UserPlus;
  readonly XCircle = XCircle;

  pageSize = 9;
  currentPage = 1;

  sidebarOpen = false;
  cedulaBusqueda = '';
  cargando: boolean = true;

  searchFilter: string = 'todo';
  showSearchFilterDropdown = false;

  ultimasAdmisiones: AdmisionDTO[] = [];

  // ---- Modal de edición de paciente (igual que admisión de pacientes) ----
  mostrarRegistro: boolean = false;
  isEditMode: boolean = false;
  filaEnEdicion: any = null;
  isSaving: boolean = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;

  nuevoPaciente: any = {
    id_paciente: null,
    cedula: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    fecha_nacimiento: '',
    telefono: '',
  };

  seleccion: any = {
    id_servicio: null,
    id_responsable: null,
    id_cliente: null,
    id_atencion: null,
    id_especialidad: null,
    id_medico: null,
    id_consultorio: null,
    nombre_servicio_label: '',
    nombre_medico_label: '',
    nombre_especialidad_label: '',
  };

  categoriaServicio: string = '';
  showPayerDropdown: boolean = false;
  showServiceDropdown: boolean = false;
  showEspecialidadDropdown: boolean = false;
  showMedicoDropdown: boolean = false;
  showAseguradoraDropdown: boolean = false;

  // ---- Autocomplete de los selects del modal (escribir para filtrar) ----
  aseguradoraFiltro: string = '';
  especialidadFiltro: string = '';
  medicoFiltro: string = '';
  aseguradoraIndex: number = -1;
  especialidadIndex: number = -1;
  medicoIndex: number = -1;

  get aseguradorasFiltradas(): any[] {
    const q = (this.aseguradoraFiltro || '').trim().toLowerCase();
    return this.aseguradoras.filter((a: any) => !q || (a.aseguradora || '').toLowerCase().includes(q));
  }

  get especialidadesFiltradas(): any[] {
    const q = (this.especialidadFiltro || '').trim().toLowerCase();
    return this.getEspecialidades().filter((s: any) => !q || (s.nombre || s.nombre_servicio || '').toLowerCase().includes(q));
  }

  get medicosConFiltro(): any[] {
    const q = (this.medicoFiltro || '').trim().toLowerCase();
    return this.medicosFiltrados.filter((m: any) => !q || ((m.nombre || '') + ' ' + (m.apellido || '')).toLowerCase().includes(q));
  }

  onAseguradoraInput(event: Event) {
    this.aseguradoraFiltro = (event.target as HTMLInputElement).value;
    this.showAseguradoraDropdown = true;
    this.aseguradoraIndex = -1;
  }

  onAseguradoraKeydown(event: KeyboardEvent) {
    const list = this.aseguradorasFiltradas;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showAseguradoraDropdown = true;
      if (list.length) this.aseguradoraIndex = (this.aseguradoraIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.aseguradoraIndex = (this.aseguradoraIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showAseguradoraDropdown && list[this.aseguradoraIndex]) {
        this.selectAseguradora(list[this.aseguradoraIndex].id_cliente);
      }
    } else if (event.key === 'Escape') {
      this.showAseguradoraDropdown = false;
    }
  }

  onEspecialidadInput(event: Event) {
    this.especialidadFiltro = (event.target as HTMLInputElement).value;
    this.showEspecialidadDropdown = true;
    this.especialidadIndex = -1;
  }

  onEspecialidadKeydown(event: KeyboardEvent) {
    const list = this.especialidadesFiltradas;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showEspecialidadDropdown = true;
      if (list.length) this.especialidadIndex = (this.especialidadIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.especialidadIndex = (this.especialidadIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showEspecialidadDropdown && list[this.especialidadIndex]) {
        this.selectEspecialidad(list[this.especialidadIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showEspecialidadDropdown = false;
    }
  }

  onMedicoInput(event: Event) {
    this.medicoFiltro = (event.target as HTMLInputElement).value;
    this.showMedicoDropdown = true;
    this.medicoIndex = -1;
  }

  onMedicoKeydown(event: KeyboardEvent) {
    const list = this.medicosConFiltro;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showMedicoDropdown = true;
      if (list.length) this.medicoIndex = (this.medicoIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.medicoIndex = (this.medicoIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showMedicoDropdown && list[this.medicoIndex]) {
        this.selectMedico(list[this.medicoIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showMedicoDropdown = false;
    }
  }

  servicios: any[] = [];
  especialidades: any[] = [];
  aseguradoras: any[] = [];
  responsables: any[] = [];
  medicos: any[] = [];
  consultorios: any[] = [];

  get admisionesFiltradas(): AdmisionDTO[] {
    return this.ultimasAdmisiones.filter(a => {
      const query = (this.cedulaBusqueda || '').trim().toLowerCase();
      if (!query) return true;

      const matchNombre = (a.nombre || '').toLowerCase().includes(query);
      const matchApellido = (a.apellido || '').toLowerCase().includes(query);
      const matchCedula = (a.cedula || '').toLowerCase().includes(query);

      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      return matchNombre || matchApellido || matchCedula;
    });
  }

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  trackById = (index: number, item: AdmisionDTO) => item?.id_atencion ?? index;

  private marcandoAusente = false;
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private espService = inject(EspecialidadesService);
  private scrollService = inject(ScrollService);

  constructor(private api: ApiService, public auth: AuthService) {}

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false;
      this.showPayerDropdown = false;
      this.showServiceDropdown = false;
      this.showEspecialidadDropdown = false;
      this.showMedicoDropdown = false;
      this.showAseguradoraDropdown = false;
    } else {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!target.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!target.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false;
      if (!target.closest('.medico-dropdown-container')) this.showMedicoDropdown = false;
      if (!target.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false;
    }
  }

  ngOnInit() {
    this.cargarDatosMaestros();
    this.cargarUltimasAdmisiones();

    this.api.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: any) => {
      if (this.marcandoAusente) return;
      if (event?.tipo === 'llamado') return;
      if (event?.admision) {
        const a = event.admision;
        const servicioLower = (a.nombre_servicio || '').toLowerCase();
        const esLaboratorio = servicioLower.includes('laboratorio');
        const esImagenes = servicioLower.includes('imágenes') || servicioLower.includes('imagenes');
        const esConsulta = !esLaboratorio && !esImagenes && a.nombre_servicio !== 'SIN ASIGNAR';
        const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
        const esSeguro = modalidadPagoLower === 'seguro';
        const esParticular = modalidadPagoLower === 'particular';
        const pasaFiltro = (esLaboratorio || esImagenes) ? esSeguro : esConsulta ? (esSeguro || esParticular) : false;
        
        if (event.tipo === 'nuevo-turno') {
          if ((esLaboratorio || esImagenes ? esSeguro : pasaFiltro) && ![6, 9].includes(Number(a.id_estado_actual))) {
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        } else if (event.tipo === 'retirado') {
          const idx = this.ultimasAdmisiones.findIndex(x => x.id_atencion === a.id_atencion);
          if (idx !== -1) {
            this.ultimasAdmisiones[idx] = a;
            this.ultimasAdmisiones = [...this.ultimasAdmisiones];
          }
        } else if (event.tipo === 'estado-cambiado') {
          if ([6, 9].includes(Number(event.id_estado_nuevo))) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
          } else if (Number(event.id_estado_nuevo) === 3) {
            // En estado 3: si es lab/imagenes se retira de APS (pasa a su módulo)
            if (esLaboratorio || esImagenes) {
              this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
            } else if (pasaFiltro) {
              // Consultas: se queda en APS para atención médica
              this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
            }
          }
        }
      } else if (event.tipo === 'liberacion' || event.tipo === 'retirado') {
        this.cargarUltimasAdmisiones();
      } else if (event.tipo === 'estado-cambiado') {
        if ([6, 9].includes(Number(event.id_estado_nuevo))) {
          const id = Number(event.id_atencion);
          if (!isNaN(id)) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== id);
          } else {
            this.cargarUltimasAdmisiones();
          }
        }
      } else {
        this.cargarUltimasAdmisiones();
      }

    });

    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarUltimasAdmisiones();
    });
  }

  ngOnDestroy() {
  }

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(filter: string) {
    this.searchFilter = filter;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(): string {
    const labels: Record<string, string> = {
      'todo': 'TODO',
      'nombre': 'NOMBRES',
      'apellido': 'APELLIDOS',
      'cedula': 'CÉDULA'
    };
    return labels[this.searchFilter] || 'TODO';
  }

  cargarUltimasAdmisiones() {
    this.cargando = true;
    this.api.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => {
        const items = data || [];
        this.ultimasAdmisiones = items.filter(a => {
          if ([6, 9].includes(Number(a.id_estado_actual))) return false;
          
          const servicioLower = (a.nombre_servicio || '').toLowerCase();
          const esLaboratorio = servicioLower.includes('laboratorio');
          const esImagenes = servicioLower.includes('imágenes') || servicioLower.includes('imagenes');
          const esConsulta = !esLaboratorio && !esImagenes && a.nombre_servicio !== 'SIN ASIGNAR';

          const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
          const esSeguro = modalidadPagoLower === 'seguro';
          const esParticular = modalidadPagoLower === 'particular';

          if (esLaboratorio || esImagenes) return esSeguro;
          if (esConsulta) return esSeguro || esParticular;
          return false;
        });
        this.cargando = false;
      },
      error: () => {
        this.cargando = false;
        console.error('Error cargando ultimas admisiones');
      }
    });
  }

  onSearchChange(value: string | undefined) {
  }

  /**
   * Llamado individual: anuncia por voz al paciente específico (el que el
   * analista eligió en la fila). Así cada analista llama a SU paciente y no
   * siempre al primero de la cola.
   */
  llamarPaciente(paciente: any) {
    this.api.post(`recepcion/atencion/${paciente.id_atencion}/llamar-aps`, {}).subscribe({
      next: () => {},
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente')
    });
  }

  /**
   * Segundo llamado para pacientes de aseguradora: cuando la clave fue
   * aprobada (estado Espera de Clave), se llama al paciente por voz para
   * confirmar antes de pasarlo a Sala de Espera. Igual que el botón
   * "Llamar" global: el anuncio suena al instante y se repite en cada
   * pulsación, sin cambiar el estado.
   */
  llamarClave(admision: any) {
    this.api.post(`recepcion/atencion/${admision.id_atencion}/llamar-clave`, {}).subscribe({
      next: () => {},
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente')
    });
  }

  async enviarAPresupuesto(admision: any) {
    const result = await this.swal.confirm('¿Ya se creó el presupuesto al paciente?');
    if (!result.isConfirmed) return;

    const targetState = this.esAseguradora(admision) ? 8 : 2;
    this.api.actualizarEstadoAtencion(admision.id_atencion, targetState).subscribe({
      next: () => {
        this.cargarUltimasAdmisiones();
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async solicitarClave(admision: any) {
    const result = await this.swal.confirm('¿Deseas solicitar la clave de aseguradora?');
    if (!result.isConfirmed) return;

    this.api.actualizarEstadoAtencion(admision.id_atencion, 8).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async enviarACaja(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => {
        // Remover inmediatamente de la tabla local si es lab/imagenes
        const adm = this.ultimasAdmisiones.find(a => a.id_atencion === id_atencion);
        if (adm) {
          const svc = (adm.nombre_servicio || '').toLowerCase();
          if (svc.includes('laboratorio') || svc.includes('imágenes') || svc.includes('imagenes')) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== id_atencion);
          } else {
            this.cargarUltimasAdmisiones();
          }
        } else {
          this.cargarUltimasAdmisiones();
        }
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async aprobarClave(admision: any) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;

    this.api.actualizarEstadoAtencion(admision.id_atencion, 3).subscribe({
      next: () => {
        // Remover inmediatamente de la tabla local si es lab/imagenes
        const svc = (admision.nombre_servicio || '').toLowerCase();
        if (svc.includes('laboratorio') || svc.includes('imágenes') || svc.includes('imagenes')) {
          this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== admision.id_atencion);
        } else {
          this.cargarUltimasAdmisiones();
        }
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async enviarASalaEspera(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 4).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async reincorporar(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas reincorporar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.reincorporarPaciente(id_atencion).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al reincorporar paciente')
    });
  }

  async marcarAusente(admision: any) {
    const result = await this.swal.confirm('¿Quieres retirar al paciente?', '¿Estás seguro?');
    if (!result.isConfirmed) return;

    this.marcandoAusente = true;

    this.api.put(`recepcion/atencion/${admision.id_atencion}/marcar_ausente`, {}).pipe(
      finalize(() => this.marcandoAusente = false)
    ).subscribe({
      next: () => {
        this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== admision.id_atencion);
        this.api.cambios$.next({ id_atencion: admision.id_atencion });
        this.swal.success('Paciente retirado correctamente');
      },
      error: () => {
        this.swal.error('Error al retirar paciente');
      },
    });
  }

  // ===================== MODAL DE EDICIÓN DE PACIENTE =====================

  /** Carga los catálogos necesarios para el modal de edición. */
  cargarDatosMaestros() {
    this.api.getServicios().subscribe({
      next: (data: any) => (this.servicios = data || []),
      error: () => {},
    });
    this.espService.getAllEspecialidades().subscribe({
      next: (data: any) => (this.especialidades = data || []),
      error: () => {},
    });
    this.api.getAseguradoras().subscribe({
      next: (data: any) => (this.aseguradoras = data || []),
      error: () => {},
    });
    this.api.get('recepcion/responsables-pago').subscribe({
      next: (data: any) => (this.responsables = data || []),
      error: () => {},
    });
    this.api.getPersonal('medico').subscribe({
      next: (data: any) => (this.medicos = data || []),
      error: () => {},
    });
    this.api.getConsultorios().subscribe({
      next: (data: any) => (this.consultorios = data || []),
      error: () => {},
    });
  }

  abrirModalRegistro() {
    this.mostrarRegistro = true;
    this.scrollService.block();
  }

  cerrarModalRegistro() {
    this.mostrarRegistro = false;
    this.scrollService.unblock();
    this.isEditMode = false;
    this.filaEnEdicion = null;
  }

  /** Carga la admisión seleccionada (solo estado Registrado) en el modal de edición. */
  editarFila(fila: any, trigger?: EventTarget | null) {
    this.filaEnEdicion = fila;
    this.isEditMode = true;
    this.nuevoPaciente = {
      id_paciente: fila.id_paciente,
      cedula: fila.cedula,
      primer_nombre: fila.nombre,
      segundo_nombre: fila.segundo_nombre,
      primer_apellido: fila.apellido,
      segundo_apellido: fila.segundo_apellido,
      fecha_nacimiento: this.fechaADisplay(fila.fecha_nacimiento),
      telefono: fila.telefono,
    };

    this.seleccion = {
      id_servicio: fila.id_servicio,
      id_responsable: fila.id_responsable,
      id_cliente: fila.id_cliente,
      id_atencion: fila.id_atencion,
      id_especialidad: fila.id_especialidad,
      id_medico: fila.id_medico || null,
      id_consultorio: fila.id_consultorio || null,
      nombre_medico_label: fila.nombre_medico || '',
      nombre_servicio_label: '',
      nombre_especialidad_label: '',
    };

    this.categoriaServicio = this.getServicioCategoria(fila.nombre_servicio);

    if (fila.id_especialidad) {
      const esp = this.especialidades.find(
        (e: any) => (e.id_especialidad || e.id) === fila.id_especialidad,
      );        if (esp) {
          this.seleccion.nombre_especialidad_label = esp.nombre;
          this.especialidadFiltro = esp.nombre;
        }
      }

    const asig = this.aseguradoras.find((a: any) => a.id_cliente === fila.id_cliente);
    this.aseguradoraFiltro = asig ? asig.aseguradora : '';
    this.medicoFiltro = fila.nombre_medico || (fila.id_medico ? this.getNombreMedicoLabel(fila.id_medico) : '');

    this.abrirModalRegistro();
  }

  /** Guarda los cambios del paciente y de la atención (misma lógica que admisión). */
  guardarPaciente() {
    if (this.isSaving) return;
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) {
      this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio');
      return;
    }
    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      this.swal.warning('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    const fechaNacimiento = (this.nuevoPaciente.fecha_nacimiento || '').toString().trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNacimiento)) {
      this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)');
      return;
    }

    this.isSaving = true;
    this.inicioGuardado = Date.now();

    const datosPaciente = {
      cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim(),
      primer_nombre: (this.nuevoPaciente.primer_nombre || '').toString().toUpperCase().trim(),
      segundo_nombre: (this.nuevoPaciente.segundo_nombre || '').toString().toUpperCase().trim(),
      primer_apellido: (this.nuevoPaciente.primer_apellido || '').toString().toUpperCase().trim(),
      segundo_apellido: (this.nuevoPaciente.segundo_apellido || '').toString().toUpperCase().trim(),
      fecha_nacimiento: this.fechaABackend(this.nuevoPaciente.fecha_nacimiento),
      telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim(),
    };

    this.api.put(`recepcion/pacientes/${this.nuevoPaciente.id_paciente}`, datosPaciente).subscribe({
      next: () => {
        const bodyAtencion = {
          id_servicio: this.seleccion.id_servicio,
          id_responsable: this.seleccion.id_responsable,
          id_cliente: this.seleccion.id_cliente,
          id_especialidad: this.seleccion.id_especialidad || null,
          id_medico: this.seleccion.id_medico || null,
          id_consultorio: this.seleccion.id_consultorio || null,
        };
        this.api.put(`recepcion/atencion/${this.seleccion.id_atencion}`, bodyAtencion).subscribe({
          next: () => {
            this.finalizarGuardado(() => {
              this.mostrarRegistro = false;
              this.scrollService.unblock();
              this.isEditMode = false;
              this.filaEnEdicion = null;
              this.swal.success('Cambios guardados con éxito');
              this.cargarUltimasAdmisiones();
              this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.seleccion.id_atencion });
            });
          },
          error: () =>
            this.finalizarGuardado(() => this.swal.error('Error al actualizar la atención')),
        });
      },
      error: (err: any) => {
        this.finalizarGuardado(() => {
          if (err.status === 409) {
            this.swal.error('Ya existe otro paciente con esa cédula');
          } else {
            this.swal.error(err.error?.mensaje || 'Error al actualizar datos del paciente');
          }
        });
      },
    });
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => {
      if (accion) accion();
      this.isSaving = false;
    }, restante);
  }

  togglePayerDropdown() {
    this.showPayerDropdown = !this.showPayerDropdown;
  }

  selectPayer(id: number) {
    if (this.seleccion.id_responsable === id) {
      this.showPayerDropdown = false;
      return;
    }
    this.seleccion.id_responsable = id;
    this.showPayerDropdown = false;
    if (id !== 2) {
      this.seleccion.id_cliente = null;
    }
    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';
    this.categoriaServicio = '';
    this.aseguradoraFiltro = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';
  }

  toggleAseguradoraDropdown() {
    this.showAseguradoraDropdown = !this.showAseguradoraDropdown;
  }

  selectAseguradora(id: number) {
    this.seleccion.id_cliente = id;
    this.showAseguradoraDropdown = false;
    this.aseguradoraIndex = -1;
    const asig = this.aseguradoras.find((a: any) => a.id_cliente === id);
    this.aseguradoraFiltro = asig ? asig.aseguradora : '';
  }

  getNombreAseguradoraSeleccionada(id: any): string {
    if (!id) return 'Seleccione...';
    const asig = this.aseguradoras.find((a: any) => a.id_cliente === id);
    return asig ? asig.aseguradora : 'Seleccione...';
  }

  getNombreResponsable(id: any): string {
    if (!id) return 'Seleccione...';
    const rp = this.responsables.find((r: any) => r.id === id);
    const nombre = rp?.nombre || (id === 1 ? 'Particular' : id === 2 ? 'Seguro' : 'Seleccione...');
    return this.getResponsableLabel(nombre);
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }


  toggleServiceDropdown() {
    this.showServiceDropdown = !this.showServiceDropdown;
  }

  selectCategoria(categoria: string) {
    if (this.categoriaServicio === categoria) {
      this.showServiceDropdown = false;
      return;
    }
    this.categoriaServicio = categoria;
    this.showServiceDropdown = false;

    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';

    if (categoria !== 'Consulta') {
      const normalizedSearch = this.normalizeString(categoria);
      const s = this.servicios.find((serv: any) => {
        const nombre = this.normalizeString(serv.nombre || serv.nombre_servicio || '');
        return nombre.includes(normalizedSearch);
      });

      if (s) {
        this.seleccion.id_servicio = s.id || s.id_servicio;
      } else {
        this.swal.warning(
          `El servicio de ${categoria} no está configurado para esta sede. Por favor, pida al administrador que lo cree.`,
        );
        this.categoriaServicio = '';
      }
    }
  }

  toggleEspecialidadDropdown() {
    this.showEspecialidadDropdown = !this.showEspecialidadDropdown;
  }

  selectEspecialidad(item: any) {
    if (this.categoriaServicio === 'Consulta') {
      this.seleccion.id_servicio = item.id_servicio;
      this.seleccion.id_especialidad = item.id_especialidad || item.id;
      this.seleccion.nombre_servicio_label = item.nombre || '';
      this.seleccion.id_medico = null;
      this.seleccion.id_consultorio = null;
      this.seleccion.nombre_medico_label = '';
    } else {
      this.seleccion.id_servicio = item.id || item.id_servicio;
      this.seleccion.id_especialidad = null;
      this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || '';
    }
    this.especialidadFiltro = item.nombre || item.nombre_servicio || '';
    this.especialidadIndex = -1;
    this.showEspecialidadDropdown = false;
  }

  getEspecialidades() {
    if (!this.categoriaServicio) {
      return this.especialidades.filter((e: any) => e.activo !== false);
    }

    if (this.categoriaServicio === 'Consulta') {
      return this.especialidades.filter((e: any) => e.activo !== false);
    }
    if (this.categoriaServicio === 'Laboratorio') {
      return this.servicios.filter((s: any) => {
        const n = (s.nombre || s.nombre_servicio || '').toLowerCase();
        return n.includes('laboratorio');
      });
    }
    if (this.categoriaServicio === 'Imágenes') {
      return this.servicios.filter((s: any) => {
        const n = (s.nombre || s.nombre_servicio || '').toLowerCase();
        return n.includes('imagen');
      });
    }
    return [];
  }

  get medicosFiltrados(): any[] {
    if (!this.seleccion.id_especialidad) return [];
    const target = Number(this.seleccion.id_especialidad);
    return this.medicos.filter((m: any) => {
      // Especialidad inactiva para este médico: no aparece en esa especialidad
      const inactivas = Array.isArray(m.especialidades_inactivas) ? m.especialidades_inactivas.map(Number) : [];
      if (inactivas.includes(target)) return false;
      const espId = Number(m.id_especialidad || m.especialidad_id);
      if (espId === target) return true;
      const extra = m.especialidades;
      return Array.isArray(extra) && extra.some((e: any) => Number(e) === target);
    });
  }

  toggleMedicoDropdown() {
    this.showMedicoDropdown = !this.showMedicoDropdown;
  }

  selectMedico(m: any) {
    this.seleccion.id_medico = m.id_usuario || m.id;
    this.seleccion.id_consultorio = m.id_consultorio || m.consultorio_id || null;
    this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim();
    this.medicoFiltro = this.seleccion.nombre_medico_label;
    this.medicoIndex = -1;
    this.showMedicoDropdown = false;
  }

  getNombreMedicoLabel(id: any): string {
    if (!id) return 'Seleccione médico...';
    if (this.seleccion.nombre_medico_label) return this.seleccion.nombre_medico_label;
    const m = this.medicos.find((doc: any) => (doc.id_usuario || doc.id) === id);
    if (m) return ((m.nombre || '') + ' ' + (m.apellido || '')).trim();
    return 'Seleccione médico...';
  }

  getMedicoConsultorio(): string {
    if (!this.seleccion.id_consultorio) return '';
    const con = this.consultorios.find((c: any) => c.id == this.seleccion.id_consultorio);
    return con ? con.nombre : '';
  }

  getNombreServicioLabel(id: any): string {
    if (this.seleccion.nombre_servicio_label) return this.seleccion.nombre_servicio_label;
    if (!id) return 'Seleccione...';
    const s = this.servicios.find((serv: any) => (serv.id || serv.id_servicio) === id);
    if (s) return s.nombre || s.nombre_servicio || 'Seleccione...';
    return 'Seleccione...';
  }

  soloLetras(event: any) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
      return;
    }
    const input = event.target as HTMLInputElement;
    if (inputChar === ' ' && input.value.length === 0) {
      event.preventDefault();
    }
  }

  trimCampo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.trim();
    input.dispatchEvent(new Event('input'));
  }

  soloNumeros(event: any) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  onFechaNacimientoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart || 0;
    const resultado = this.aplicarCambioFecha(this.nuevoPaciente.fecha_nacimiento || '', input.value, cursorPos);
    this.nuevoPaciente.fecha_nacimiento = resultado.valor;
    input.value = resultado.valor;
    input.setSelectionRange(resultado.cursor, resultado.cursor);
  }

  private fechaADisplay(fecha: string): string {
    if (!fecha || fecha.length < 10) return fecha || '';
    const partes = fecha.substring(0, 10).split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  private aplicarCambioFecha(displayAnterior: string, nuevoValor: string, cursorPos: number): { valor: string; cursor: number } {
    const viejo = this.obtenerSlots(displayAnterior);
    const nuevoDigitos = nuevoValor.replace(/\D/g, '').substring(0, 8);
    const viejoDigitos = viejo.filter(ch => /\d/.test(ch)).join('');

    if (nuevoDigitos.length === 0) {
      return { valor: '', cursor: 0 };
    }

    if (nuevoDigitos.length < viejoDigitos.length) {
      const cuantos = viejoDigitos.length - nuevoDigitos.length;
      const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
      const slots = viejo.slice();
      for (let i = cursorDigitos; i < cursorDigitos + cuantos && i < 8; i++) slots[i] = ' ';
      return { valor: this.reconstruir(slots), cursor: this.posicionDeSlot(cursorDigitos) };
    }

    if (nuevoDigitos.length === viejoDigitos.length) {
      const slots = viejo.map((ch, i) => /\d/.test(ch) ? nuevoDigitos[this.runIndex(i, viejo)] : ch);
      return { valor: this.reconstruir(slots), cursor: Math.min(cursorPos, 10) };
    }

    const added = nuevoDigitos.length - viejoDigitos.length;
    const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
    const insertSlot = Math.max(0, cursorDigitos - added);
    const slots = viejo.slice();
    let pos = insertSlot;
    let ultimoRellenado = -1;
    for (let k = insertSlot; k < insertSlot + added && k < 8; k++) {
      while (pos < 8 && /\d/.test(slots[pos])) pos++;
      if (pos >= 8) break;
      slots[pos] = nuevoDigitos[k];
      ultimoRellenado = pos;
      pos++;
    }
    const cursor = ultimoRellenado >= 0 ? this.posicionDeSlot(ultimoRellenado) + 1 : this.posicionDeSlot(insertSlot);
    return { valor: this.reconstruir(slots), cursor };
  }

  private obtenerSlots(display: string): string[] {
    if (!display) return Array(8).fill(' ');
    return [0, 1, 3, 4, 6, 7, 8, 9].map(i => display[i] ?? ' ');
  }

  private reconstruir(slots: string[]): string {
    return slots[0] + slots[1] + '/' + slots[2] + slots[3] + '/' + slots[4] + slots[5] + slots[6] + slots[7];
  }

  private posicionDeSlot(slotIndex: number): number {
    const posiciones = [0, 1, 3, 4, 6, 7, 8, 9];
    return posiciones[slotIndex] ?? 10;
  }

  private runIndex(slotIndex: number, viejo: string[]): number {
    let count = 0;
    for (let i = 0; i < slotIndex; i++) {
      if (/\d/.test(viejo[i])) count++;
    }
    return count;
  }

  private fechaABackend(fecha: string): string | null {
    if (!fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return null;
    const partes = fecha.split('/');
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }

  esAseguradora(dto: { modalidad_pago?: string }): boolean {
    const modalidad = (dto.modalidad_pago || '').toString().trim().toLowerCase();
    return modalidad.includes('seguro') || modalidad.includes('asegur');
  }

  getResponsableLabel(value: string | undefined): string {
    const modalidad = (value || '').toString().trim().toLowerCase();
    if (modalidad.includes('particular')) return 'Particular';
    if (modalidad.includes('seguro') || modalidad.includes('asegur')) return 'Aseguradora';
    return 'SIN ASIGNAR';
  }

  getServicioCategoria(value: string | undefined): string {
    const servicio = (value || '').toString().trim().toLowerCase();
    if (servicio.includes('laboratorio')) return 'Laboratorio';
    if (servicio.includes('imágenes') || servicio.includes('imagenes')) return 'Imágenes';
    return 'Consulta';
  }
}
