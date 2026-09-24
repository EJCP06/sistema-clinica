import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import {
  LucideAngularModule,
  Search,
  FileText,
  CheckCircle2,
  ChevronDown,
  Undo2,
  DollarSign,
  XCircle,
  Trash2,
  Megaphone,
  Edit2,
  UserPlus,
  UserX,
} from 'lucide-angular';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { SwalService } from '@core/services/swal.service';
import { EspecialidadesService } from '@core/services/especialidades.service';
import { ScrollService } from '@core/services/scroll.service';
import { AdmisionDTO } from '@core/models/dto.models';

import { Sidebar } from '@shared/components/sidebar/sidebar';
import { Header } from '@shared/components/header/header';
import { PaginationComponent } from '@shared/components/pagination/pagination';
import { PaginatePipe } from '@shared/pipes/paginate.pipe';
import { FillersPipe } from '@shared/pipes/fillers.pipe';

import { ColaAutocompleteService, AutocompleteState } from './cola-autocomplete.service';
import { ColaDateMaskService } from './cola-date-mask.service';
import { ColaCountdownService } from './cola-countdown.service';
import { TourAnchorMatMenuDirective } from 'ngx-ui-tour-md-menu';

export type TipoServicioCola = 'laboratorio' | 'imagenes';

@Component({
  selector: 'app-cola-servicio',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    Sidebar,
    Header,
    PaginationComponent,
    PaginatePipe,
    FillersPipe,
    TourAnchorMatMenuDirective,
  ],
  templateUrl: './cola-servicio.html',
})
export class ColaServicioComponent implements OnInit, OnDestroy {
  readonly tipo: TipoServicioCola =
    (inject(ActivatedRoute).snapshot.data['tipo'] as TipoServicioCola) ?? 'laboratorio';

  get etiquetaServicio(): string {
    return this.tipo === 'laboratorio' ? 'Laboratorio' : 'Imágenes';
  }

  get tituloPagina(): string {
    return `Módulo de ${this.etiquetaServicio}`;
  }

  private esDelServicio(nombreServicio: string | undefined | null): boolean {
    const nombre = (nombreServicio || '').toLowerCase();
    return this.tipo === 'laboratorio'
      ? nombre.includes('laboratorio')
      : nombre.includes('imágenes') || nombre.includes('imagenes');
  }

  readonly Search = Search;
  readonly FileText = FileText;
  readonly CheckCircle2 = CheckCircle2;
  readonly ChevronDown = ChevronDown;
  readonly Undo2 = Undo2;
  readonly DollarSign = DollarSign;
  readonly XCircle = XCircle;
  readonly Trash2 = Trash2;
  readonly Megaphone = Megaphone;
  readonly Edit2 = Edit2;
  readonly UserPlus = UserPlus;
  readonly UserX = UserX;

  pageSize = 9;
  currentPage = 1;
  sidebarOpen = false;
  cedulaBusqueda = '';
  searchFilter = 'todo';
  showSearchFilterDropdown = false;
  showDocTypeDropdown = false;

  ultimasAdmisiones: AdmisionDTO[] = [];
  cargando = true;

  mostrarRegistro = false;
  isEditMode = false;
  filaEnEdicion: any = null;
  isSaving = false;
  private inicioGuardado = 0;
  private readonly MIN_GUARDADO = 800;

  nuevoPaciente: any = {
    id_paciente: null, cedula: '', tipo_documento: 'v',
    primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '',
    fecha_nacimiento: '', telefono: '',
  };

  seleccion: any = {
    id_servicio: null, id_responsable: null, id_cliente: null, id_atencion: null,
    id_especialidad: null, id_medico: null, id_consultorio: null,
    nombre_servicio_label: '', nombre_medico_label: '', nombre_especialidad_label: '',
  };

  categoriaServicio = '';
  showPayerDropdown = false;
  showServiceDropdown = false;
  showEspecialidadDropdown = false;
  showMedicoDropdown = false;
  showAseguradoraDropdown = false;

  aseguradoraState: AutocompleteState;
  especialidadState: AutocompleteState;
  medicoState: AutocompleteState;

  servicios: any[] = [];
  especialidades: any[] = [];
  aseguradoras: any[] = [];
  responsables: any[] = [];
  medicos: any[] = [];
  consultorios: any[] = [];

  get admisionesFiltradas(): AdmisionDTO[] {
    return this.ultimasAdmisiones.filter((a) => {
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

  get puedeLlamar(): boolean {
    return this.auth.tieneRol(['analista', 'coordinador', 'administrador', this.tipo]);
  }

  trackById = (index: number, item: AdmisionDTO) => item?.id_atencion ?? index;

  get aseguradorasFiltradas(): any[] {
    return this.ac.filterItems(this.aseguradoras, this.aseguradoraState.filtro, 'aseguradora');
  }

  get especialidadesFiltradas(): any[] {
    return this.ac.filterItems(this.getEspecialidades(), this.especialidadState.filtro, 'nombre');
  }

  get medicosConFiltro(): any[] {
    return this.ac.filterByComposite(this.medicosFiltrados, this.medicoState.filtro, 'nombre', 'apellido');
  }

  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private auth = inject(AuthService);
  private espService = inject(EspecialidadesService);
  private scrollService = inject(ScrollService);
  private ac = inject(ColaAutocompleteService);
  private dateMask = inject(ColaDateMaskService);
  private countdown = inject(ColaCountdownService);

  constructor(private api: ApiService) {
    this.aseguradoraState = this.ac.create();
    this.especialidadState = this.ac.create();
    this.medicoState = this.ac.create();
  }

  get usuario() { return this.auth.usuarioActual; }

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

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
      if (!target.closest('.doc-type-container')) this.showDocTypeDropdown = false;
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
      // Anuncio general por megáfono (silencio): no altera la cola.
      if (event?.tipo === 'anuncio-general') return;
      if (event?.admision) {
        const a = event.admision;
        const esDelServicio = this.esDelServicio(a.nombre_servicio);
        const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
        const esSeguro = modalidadPagoLower === 'seguro' || modalidadPagoLower.includes('asegur');
        const esParticular = modalidadPagoLower === 'particular';

        if (event.tipo === 'nuevo-turno') {
          if (esDelServicio && (esParticular || esSeguro) && ![6, 9].includes(Number(a.id_estado_actual))) {
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        } else if (event.tipo === 'retirado') {
          const idx = this.ultimasAdmisiones.findIndex((x) => x.id_atencion === a.id_atencion);
          if (idx !== -1) {
            this.ultimasAdmisiones[idx] = a;
            this.ultimasAdmisiones = [...this.ultimasAdmisiones];
          }
        } else if (event.tipo === 'estado-cambiado') {
          if ([6, 9].includes(Number(event.id_estado_nuevo))) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(
              (x) => x.id_atencion !== a.id_atencion,
            );
          } else if (Number(event.id_estado_nuevo) === 3 && esDelServicio && (esParticular || esSeguro)) {
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        }
      } else if (event.tipo === 'eliminado') {
        const id = Number(event.id_atencion);
        if (!isNaN(id)) {
          this.countdown.stopCountdown(id);
          this.ultimasAdmisiones = this.ultimasAdmisiones.filter((x) => x.id_atencion !== id);
        }
      } else if (event.tipo === 'liberacion' || event.tipo === 'retirado') {
        this.cargarUltimasAdmisiones();
      } else if (event.tipo === 'estado-cambiado') {
        const nuevoEstado = Number(event.id_estado_nuevo);
        const idAtencion = Number(event.id_atencion);
        if ([6, 9].includes(nuevoEstado)) {
          if (!isNaN(idAtencion)) {
            this.countdown.stopCountdown(idAtencion);
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter((x) => x.id_atencion !== idAtencion);
          } else {
            this.cargarUltimasAdmisiones();
          }
        } else if (nuevoEstado === 4) {
          const adm = this.ultimasAdmisiones.find((x) => x.id_atencion === idAtencion);
          if (adm) {
            adm.id_estado_actual = 4;
            adm.nombre_estado = 'LLAMADO';
            this.countdown.stopCountdown(idAtencion);
            this.countdown.startCountdown(adm, this.tipo, {
              onExpire: (id) => {
                this.ultimasAdmisiones = this.ultimasAdmisiones.filter((x) => x.id_atencion !== id);
                this.api.cambios$.next({ id_atencion: id });
              },
              onTick: () => {},
            });
          }
        } else if (nuevoEstado === 5) {
          this.countdown.stopCountdown(idAtencion);
          const adm = this.ultimasAdmisiones.find((x) => x.id_atencion === idAtencion);
          if (adm) { adm.id_estado_actual = 5; adm.nombre_estado = 'EN ATENCION'; }
        } else if (nuevoEstado === 7) {
          this.countdown.stopCountdown(idAtencion);
          this.cargarUltimasAdmisiones();
        } else {
          this.cargarUltimasAdmisiones();
        }
      } else if (event.tipo !== 'llamado') {
        this.cargarUltimasAdmisiones();
      }
    });

    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarUltimasAdmisiones();
    });
  }

  ngOnDestroy() { this.countdown.stopAllCountdowns(); }

  getCountdown(idAtencion: number): number { return this.countdown.getCountdown(idAtencion); }

  // --- Search / filter ---
  toggleSearchFilterDropdown() { this.showSearchFilterDropdown = !this.showSearchFilterDropdown; }

  selectSearchFilter(filter: string) { this.searchFilter = filter; this.showSearchFilterDropdown = false; }

  getSearchFilterLabel(): string {
    const labels: Record<string, string> = { todo: 'TODO', nombre: 'NOMBRES', apellido: 'APELLIDOS', cedula: 'Nº DOC' };
    return labels[this.searchFilter] || 'TODO';
  }

  onSearchChange(value: string | undefined) { this.cedulaBusqueda = value || ''; this.currentPage = 1; }
  onSearch() { this.currentPage = 1; }

  // --- Doc type ---
  toggleDocTypeDropdown() { this.showDocTypeDropdown = !this.showDocTypeDropdown; }

  selectDocType(tipo: string) {
    this.nuevoPaciente.tipo_documento = tipo;
    this.showDocTypeDropdown = false;
    this.onDocTypeChange();
  }

  getDocTypeLabel(): string {
    const labels: Record<string, string> = { v: 'V', e: 'E', p: 'P' };
    return labels[this.nuevoPaciente.tipo_documento] || 'V';
  }

  // --- Autocomplete delegates ---
  onAseguradoraInput(event: Event) { this.ac.onInput(this.aseguradoraState, event); this.showAseguradoraDropdown = true; }
  onAseguradoraKeydown(event: KeyboardEvent) {
    this.ac.onKeydown(this.aseguradoraState, event, this.aseguradorasFiltradas);
    if (event.key === 'Enter' && this.aseguradoraState.index >= 0) {
      this.selectAseguradora(this.aseguradorasFiltradas[this.aseguradoraState.index]?.id_cliente);
    }
  }

  onEspecialidadInput(event: Event) { this.ac.onInput(this.especialidadState, event); this.showEspecialidadDropdown = true; }
  onEspecialidadKeydown(event: KeyboardEvent) {
    this.ac.onKeydown(this.especialidadState, event, this.especialidadesFiltradas);
    if (event.key === 'Enter' && this.especialidadState.index >= 0) {
      this.selectEspecialidad(this.especialidadesFiltradas[this.especialidadState.index]);
    }
  }

  onMedicoInput(event: Event) { this.ac.onInput(this.medicoState, event); this.showMedicoDropdown = true; }
  onMedicoKeydown(event: KeyboardEvent) {
    this.ac.onKeydown(this.medicoState, event, this.medicosConFiltro);
    if (event.key === 'Enter' && this.medicoState.index >= 0) {
      this.selectMedico(this.medicosConFiltro[this.medicoState.index]);
    }
  }

  // --- Load data ---
  cargarUltimasAdmisiones() {
    this.cargando = true;
    this.api.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => {
        const items = data || [];
        this.ultimasAdmisiones = items.filter((a) => {
          if ([6, 9].includes(Number(a.id_estado_actual))) return false;
          const esDelServicio = this.esDelServicio(a.nombre_servicio);
          const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
          const esSeguro = modalidadPagoLower === 'seguro' || modalidadPagoLower.includes('asegur');
          const esParticular = modalidadPagoLower === 'particular';
          if (esDelServicio) {
            if (esSeguro && ![3, 4, 5, 7].includes(Number(a.id_estado_actual))) return false;
            return esParticular || esSeguro;
          }
          return false;
        });
        for (const a of this.ultimasAdmisiones) {
          if (Number(a.id_estado_actual) === 4) {
            this.countdown.startCountdown(a, this.tipo, {
              onExpire: (id) => {
                this.ultimasAdmisiones = this.ultimasAdmisiones.filter((x) => x.id_atencion !== id);
                this.api.cambios$.next({ id_atencion: id });
              },
              onTick: () => {},
            });
          }
        }
        this.cargando = false;
      },
      error: () => { this.cargando = false; console.error('Error cargando ultimas admisiones'); },
    });
  }

  // --- Actions ---
  llamarPaciente(paciente: any) {
    this.api.post(`recepcion/atencion/${paciente.id_atencion}/llamar-${this.tipo}`, {}).subscribe({ next: () => {}, error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente') });
  }

  llamarPacienteSalaEspera(paciente: any) {
    this.api.post(`recepcion/atencion/${paciente.id_atencion}/llamar-${this.tipo}-se`, {}).subscribe({
      next: () => {
        paciente.id_estado_actual = 4;
        paciente.nombre_estado = 'LLAMADO';
        paciente.hora_llamado = new Date().toISOString();
        this.countdown.startCountdown(paciente, this.tipo, {
          onExpire: (id) => { this.ultimasAdmisiones = this.ultimasAdmisiones.filter((x) => x.id_atencion !== id); this.api.cambios$.next({ id_atencion: id }); },
          onTick: () => {},
        });
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente'),
    });
  }

  async enviarAPresupuesto(id_atencion: number) {
    const result = await this.swal.confirm('¿Ya se creó el presupuesto al paciente?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 2).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado'),
    });
  }

  async enviarACaja(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado'),
    });
  }

  async enviarASalaEspera(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 4).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado'),
    });
  }

  async reincorporar(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas reincorporar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.reincorporarPaciente(id_atencion).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al reincorporar paciente'),
    });
  }

  async marcarAusente(admision: any) {
    const result = await this.swal.confirm('¿Quieres retirar al paciente?', '¿Estás seguro?');
    if (!result.isConfirmed) return;
    this.api.put(`recepcion/atencion/${admision.id_atencion}/marcar_ausente`, {}).subscribe({
      next: () => {
        this.ultimasAdmisiones = this.ultimasAdmisiones.filter((a) => a.id_atencion !== admision.id_atencion);
        this.api.cambios$.next({ id_atencion: admision.id_atencion });
        this.swal.success('Paciente retirado correctamente');
      },
      error: () => this.swal.error('Error al retirar paciente'),
    });
  }

  async marcarAusente7(admision: any) {
    const result = await this.swal.confirm(`¿Marcar turno ${admision.numero} como AUSENTE?`);
    if (!result.isConfirmed) return;
    this.api.put(`recepcion/atencion/${admision.id_atencion}/marcar-ausente-real`, {}).subscribe({
      next: () => {
        this.ultimasAdmisiones = this.ultimasAdmisiones.filter((a) => a.id_atencion !== admision.id_atencion);
        this.api.cambios$.next({ id_atencion: admision.id_atencion });
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al marcar ausente'),
    });
  }

  iniciarAtencion(admision: any) {
    this.countdown.stopCountdown(admision.id_atencion);
    const prevEstado = admision.id_estado_actual;
    const prevNombre = admision.nombre_estado;
    admision.id_estado_actual = 5;
    admision.nombre_estado = 'EN ATENCION';
    this.api.put(`recepcion/atencion/${admision.id_atencion}/estado`, { id_estado_nuevo: 5 }).subscribe({
      error: (err) => { admision.id_estado_actual = prevEstado; admision.nombre_estado = prevNombre; this.swal.error(err.error?.mensaje || 'Error al iniciar atención'); },
    });
  }

  finalizarAtencion(admision: any) {
    this.countdown.stopCountdown(admision.id_atencion);
    const idx = this.ultimasAdmisiones.findIndex((a) => a.id_atencion === admision.id_atencion);
    this.ultimasAdmisiones = this.ultimasAdmisiones.filter((a) => a.id_atencion !== admision.id_atencion);
    this.api.put(`recepcion/atencion/${admision.id_atencion}/estado`, { id_estado_nuevo: 6 }).subscribe({
      error: (err) => { if (idx >= 0) this.ultimasAdmisiones.splice(idx, 0, admision); this.swal.error(err.error?.mensaje || 'Error al finalizar atención'); },
    });
  }

  // --- Modal ---
  cargarDatosMaestros() {
    this.api.getServicios().subscribe({ next: (data: any) => (this.servicios = data || []), error: (e) => console.error('Error cargando servicios:', e) });
    this.espService.getAllEspecialidades().subscribe({ next: (data: any) => (this.especialidades = data || []), error: (e) => console.error('Error cargando especialidades:', e) });
    this.api.getAseguradoras().subscribe({ next: (data: any) => (this.aseguradoras = data || []), error: (e) => console.error('Error cargando aseguradoras:', e) });
    this.api.get('recepcion/responsables-pago').subscribe({ next: (data: any) => (this.responsables = data || []), error: (e) => console.error('Error cargando responsables:', e) });
    this.api.getPersonal('medico').subscribe({ next: (data: any) => (this.medicos = data || []), error: (e) => console.error('Error cargando medicos:', e) });
    this.api.getConsultorios().subscribe({ next: (data: any) => (this.consultorios = data || []), error: (e) => console.error('Error cargando consultorios:', e) });
  }

  abrirModalRegistro() { this.mostrarRegistro = true; this.scrollService.block(); }

  cerrarModalRegistro() {
    this.mostrarRegistro = false;
    this.scrollService.unblock();
    this.isEditMode = false;
    this.filaEnEdicion = null;
    this.showDocTypeDropdown = false;
  }

  editarFila(fila: any, _trigger?: EventTarget | null) {
    this.filaEnEdicion = fila;
    this.isEditMode = true;
    this.nuevoPaciente = {
      id_paciente: fila.id_paciente, cedula: fila.cedula, tipo_documento: fila.tipo_documento || 'v',
      primer_nombre: fila.nombre, segundo_nombre: fila.segundo_nombre,
      primer_apellido: fila.apellido, segundo_apellido: fila.segundo_apellido,
      fecha_nacimiento: this.dateMask.fechaADisplay(fila.fecha_nacimiento), telefono: fila.telefono,
    };
    this.seleccion = {
      id_servicio: fila.id_servicio, id_responsable: fila.id_responsable, id_cliente: fila.id_cliente,
      id_atencion: fila.id_atencion, id_especialidad: fila.id_especialidad,
      id_medico: fila.id_medico || null, id_consultorio: fila.id_consultorio || null,
      nombre_medico_label: fila.nombre_medico || '', nombre_servicio_label: '', nombre_especialidad_label: '',
    };
    this.categoriaServicio = this.getServicioCategoria(fila.nombre_servicio);
    if (fila.id_especialidad) {
      const esp = this.especialidades.find((e: any) => (e.id_especialidad || e.id) === fila.id_especialidad);
      if (esp) { this.seleccion.nombre_especialidad_label = esp.nombre; this.especialidadState.filtro = esp.nombre; }
    }
    const asig = this.aseguradoras.find((a: any) => a.id_cliente === fila.id_cliente);
    this.aseguradoraState.filtro = asig ? asig.aseguradora : '';
    this.medicoState.filtro = fila.nombre_medico || (fila.id_medico ? this.getNombreMedicoLabel(fila.id_medico) : '');
    this.abrirModalRegistro();
  }

  guardarPaciente() {
    if (this.isSaving) return;
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) { this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio'); return; }
    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) { this.swal.warning('Debe seleccionar el nombre de la aseguradora'); return; }
    const fechaNacimiento = (this.nuevoPaciente.fecha_nacimiento || '').toString().trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNacimiento)) { this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)'); return; }
    const docLen = (this.nuevoPaciente.cedula || '').length;
    const tipoDoc = this.nuevoPaciente.tipo_documento;
    if (tipoDoc === 'p') { if (docLen < 10) { this.swal.warning('El pasaporte debe tener entre 10 y 12 caracteres'); return; } }
    else { if (docLen < 7) { this.swal.warning('La cédula debe tener entre 7 y 8 dígitos'); return; } }
    const tel = (this.nuevoPaciente.telefono || '').replace(/\D/g, '');
    if (tel.length > 0 && tel.length < 11) { this.swal.warning('El teléfono debe tener entre 11 y 12 dígitos'); return; }

    this.isSaving = true;
    this.inicioGuardado = Date.now();

    const datosPaciente = {
      cedula: (this.nuevoPaciente.tipo_documento !== 'p')
        ? (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim()
        : (this.nuevoPaciente.cedula || '').toString().trim().toUpperCase(),
      tipo_documento: this.nuevoPaciente.tipo_documento || 'v',
      primer_nombre: (this.nuevoPaciente.primer_nombre || '').toString().toUpperCase().trim(),
      segundo_nombre: (this.nuevoPaciente.segundo_nombre || '').toString().toUpperCase().trim(),
      primer_apellido: (this.nuevoPaciente.primer_apellido || '').toString().toUpperCase().trim(),
      segundo_apellido: (this.nuevoPaciente.segundo_apellido || '').toString().toUpperCase().trim(),
      fecha_nacimiento: this.dateMask.fechaABackend(this.nuevoPaciente.fecha_nacimiento),
      telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim(),
    };

    this.api.put(`recepcion/pacientes/${this.nuevoPaciente.id_paciente}`, datosPaciente).subscribe({
      next: () => {
        const bodyAtencion = {
          id_servicio: this.seleccion.id_servicio, id_responsable: this.seleccion.id_responsable,
          id_cliente: this.seleccion.id_cliente, id_especialidad: this.seleccion.id_especialidad || null,
          id_medico: this.seleccion.id_medico || null, id_consultorio: this.seleccion.id_consultorio || null,
        };
        this.api.put(`recepcion/atencion/${this.seleccion.id_atencion}`, bodyAtencion).subscribe({
          next: () => {
            this.finalizarGuardado(() => {
              this.mostrarRegistro = false; this.scrollService.unblock(); this.isEditMode = false;
              this.filaEnEdicion = null; this.swal.success('Cambios guardados con éxito');
              this.cargarUltimasAdmisiones();
              this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.seleccion.id_atencion });
            });
          },
          error: () => this.finalizarGuardado(() => this.swal.error('Error al actualizar la atención')),
        });
      },
      error: (err: any) => {
        this.finalizarGuardado(() => {
          if (err.status === 409) this.swal.error('Ya existe otro paciente con esa cédula');
          else this.swal.error(err.error?.mensaje || 'Error al actualizar datos del paciente');
        });
      },
    });
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => { if (accion) accion(); this.isSaving = false; }, restante);
  }

  // --- Dropdown helpers ---
  togglePayerDropdown() { this.showPayerDropdown = !this.showPayerDropdown; }

  selectPayer(id: number) {
    if (this.seleccion.id_responsable === id) { this.showPayerDropdown = false; return; }
    this.seleccion.id_responsable = id; this.showPayerDropdown = false;
    if (id !== 2) this.seleccion.id_cliente = null;
    this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null; this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = '';
    this.categoriaServicio = ''; this.aseguradoraState.filtro = '';
    this.especialidadState.filtro = ''; this.medicoState.filtro = '';
  }

  toggleAseguradoraDropdown() { this.showAseguradoraDropdown = !this.showAseguradoraDropdown; }

  selectAseguradora(id: number) {
    this.seleccion.id_cliente = id; this.showAseguradoraDropdown = false; this.aseguradoraState.index = -1;
    const asig = this.aseguradoras.find((a: any) => a.id_cliente === id);
    this.aseguradoraState.filtro = asig ? asig.aseguradora : '';
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

  toggleServiceDropdown() { this.showServiceDropdown = !this.showServiceDropdown; }

  selectCategoria(categoria: string) {
    if (this.categoriaServicio === categoria) { this.showServiceDropdown = false; return; }
    this.categoriaServicio = categoria; this.showServiceDropdown = false;
    this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null; this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = '';
    this.especialidadState.filtro = ''; this.medicoState.filtro = '';
    if (categoria !== 'Consulta') {
      const normalizedSearch = this.normalizeString(categoria);
      const s = this.servicios.find((serv: any) => {
        const nombre = this.normalizeString(serv.nombre || serv.nombre_servicio || '');
        return nombre.includes(normalizedSearch);
      });
      if (s) { this.seleccion.id_servicio = s.id || s.id_servicio; }
      else { this.swal.warning(`El servicio de ${categoria} no está configurado para esta sede. Por favor, pida al administrador que lo cree.`); this.categoriaServicio = ''; }
    }
  }

  toggleEspecialidadDropdown() { this.showEspecialidadDropdown = !this.showEspecialidadDropdown; }

  selectEspecialidad(item: any) {
    if (this.categoriaServicio === 'Consulta') {
      this.seleccion.id_servicio = item.id_servicio; this.seleccion.id_especialidad = item.id_especialidad || item.id;
      this.seleccion.nombre_servicio_label = item.nombre || ''; this.seleccion.id_medico = null;
      this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = '';
    } else {
      this.seleccion.id_servicio = item.id || item.id_servicio; this.seleccion.id_especialidad = null;
      this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || '';
    }
    this.ac.select(this.especialidadState, item.nombre || item.nombre_servicio || '');
    this.showEspecialidadDropdown = false;
  }

  getEspecialidades() {
    if (!this.categoriaServicio) return this.especialidades.filter((e: any) => e.activo !== false);
    if (this.categoriaServicio === 'Consulta') return this.especialidades.filter((e: any) => e.activo !== false);
    if (this.categoriaServicio === 'Laboratorio') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('laboratorio'));
    if (this.categoriaServicio === 'Imágenes') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('imagen'));
    return [];
  }

  get medicosFiltrados(): any[] {
    if (!this.seleccion.id_especialidad) return [];
    const target = Number(this.seleccion.id_especialidad);
    return this.medicos.filter((m: any) => {
      const inactivas = Array.isArray(m.especialidades_inactivas) ? m.especialidades_inactivas.map(Number) : [];
      if (inactivas.includes(target)) return false;
      const espId = Number(m.id_especialidad || m.especialidad_id);
      if (espId === target) return true;
      const extra = m.especialidades;
      return Array.isArray(extra) && extra.some((e: any) => Number(e) === target);
    });
  }

  toggleMedicoDropdown() { this.showMedicoDropdown = !this.showMedicoDropdown; }

  selectMedico(m: any) {
    this.seleccion.id_medico = m.id_usuario || m.id;
    this.seleccion.id_consultorio = m.id_consultorio || m.consultorio_id || null;
    this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim();
    this.ac.select(this.medicoState, this.seleccion.nombre_medico_label);
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

  // --- Input validators ---
  soloLetras(event: any) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault();
    else { const input = event.target as HTMLInputElement; if (inputChar === ' ' && input.value.length === 0) event.preventDefault(); }
  }

  trimCampo(event: Event) { const input = event.target as HTMLInputElement; input.value = input.value.trim(); input.dispatchEvent(new Event('input')); }
  soloNumeros(event: any) { const pattern = /[0-9]/; const inputChar = String.fromCharCode(event.charCode); if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault(); }

  onDocKeyPress(event: any) {
    const tipo = this.nuevoPaciente.tipo_documento;
    const input = event.target as HTMLInputElement;
    const maxLen = tipo === 'p' ? 12 : 8;
    const pattern = tipo === 'p' ? /[a-zA-Z0-9]/ : /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && (!pattern.test(inputChar) || input.value.length >= maxLen)) event.preventDefault();
  }

  onDocTypeChange() {
    const maxLen = this.nuevoPaciente.tipo_documento === 'p' ? 12 : 8;
    const val = (this.nuevoPaciente.cedula || '').toString();
    if (val.length > maxLen) this.nuevoPaciente.cedula = val.substring(0, maxLen);
  }

  getDocPlaceholder(): string { return this.nuevoPaciente.tipo_documento === 'p' ? 'Ej: AB1234567' : 'Ej: 13894759'; }

  onFechaNacimientoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart || 0;
    const resultado = this.dateMask.aplicarCambioFecha(this.nuevoPaciente.fecha_nacimiento || '', input.value, cursorPos);
    this.nuevoPaciente.fecha_nacimiento = resultado.valor;
    input.value = resultado.valor;
    input.setSelectionRange(resultado.cursor, resultado.cursor);
  }

  // --- Display helpers ---
  private normalizeString(str: string): string { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  getResponsableLabel(value: string | undefined): string { const m = (value || '').toString().trim().toLowerCase(); if (m.includes('particular')) return 'Particular'; if (m.includes('seguro') || m.includes('asegur')) return 'Aseguradora'; return 'SIN ASIGNAR'; }
  getServicioCategoria(value: string | undefined): string { const s = (value || '').toString().trim().toLowerCase(); if (s.includes('laboratorio')) return 'Laboratorio'; if (s.includes('imágenes') || s.includes('imagenes')) return 'Imágenes'; return 'Consulta'; }
}
