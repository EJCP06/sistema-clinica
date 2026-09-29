import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  inject,
  DestroyRef,
} from '@angular/core';
import { finalize, interval } from 'rxjs';
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
import { AdmisionDTO, SexoDTO, EstadoCivilDTO, ParentescoDTO } from '@core/models/dto.models';

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
  showSexoDropdown = false;
  showEstadoCivilDropdown = false;
  showNumeroHijoDropdown = false;
  showParentescoDropdown = false;

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
    fecha_nacimiento: '', telefono: '', email: '', direccion: '', sexo: '', estado_civil: '',
    con_representante: false, cedula_representante: '', numero_hijo: '', nombre_representante: '',
    parentesco_representante: '',
  };

  /** Catálogos que alimentan los selects del modal (tablas Sexo/Estado_Civil/Parentesco). */
  sexos: SexoDTO[] = [];
  estadosCiviles: EstadoCivilDTO[] = [];
  parentescos: ParentescoDTO[] = [];
  /** Opciones del select "Numero de Hijo": del 1 al 12. */
  readonly numerosHijo: string[] = Array.from({ length: 12 }, (_, i) => String(i + 1));

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

  anunciandoSilencio = false;

  /**
   * Emite el anuncio general de SILENCIO por voz en el turnero de la sede
   * (botón rojo con megáfono junto al buscador), igual que el módulo APS.
   */
  anunciarSilencio() {
    if (this.anunciandoSilencio) return;
    this.anunciandoSilencio = true;
    this.api.post('recepcion/anuncio-silencio', {}).pipe(finalize(() => this.anunciandoSilencio = false)).subscribe({
      next: () => {},
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al emitir el anuncio'),
    });
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
      this.showSexoDropdown = false;
      this.showEstadoCivilDropdown = false;
      this.showNumeroHijoDropdown = false;
      this.showParentescoDropdown = false;
    } else {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.doc-type-container')) this.showDocTypeDropdown = false;
      if (!target.closest('.sexo-dropdown-container')) this.showSexoDropdown = false;
      if (!target.closest('.estado-civil-dropdown-container')) this.showEstadoCivilDropdown = false;
      if (!target.closest('.numero-hijo-dropdown-container')) this.showNumeroHijoDropdown = false;
      if (!target.closest('.parentesco-dropdown-container')) this.showParentescoDropdown = false;
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
    this.api.get<SexoDTO[]>('shared/sexos').subscribe({ next: (d) => (this.sexos = d || []), error: () => {} });
    this.api.get<EstadoCivilDTO[]>('shared/estados-civiles').subscribe({ next: (d) => (this.estadosCiviles = d || []), error: () => {} });
    this.api.get<ParentescoDTO[]>('shared/parentescos').subscribe({ next: (d) => (this.parentescos = d || []), error: () => {} });
  }

  abrirModalRegistro() { this.mostrarRegistro = true; this.scrollService.block(); }

  cerrarModalRegistro() {
    this.mostrarRegistro = false;
    this.scrollService.unblock();
    this.isEditMode = false;
    this.filaEnEdicion = null;
    this.showDocTypeDropdown = false;
    this.showSexoDropdown = false;
    this.showEstadoCivilDropdown = false;
    this.showNumeroHijoDropdown = false;
    this.showParentescoDropdown = false;
  }

  editarFila(fila: any, _trigger?: EventTarget | null) {
    this.filaEnEdicion = fila;
    this.isEditMode = true;
    this.nuevoPaciente = {
      id_paciente: fila.id_paciente, cedula: fila.cedula, tipo_documento: fila.tipo_documento || 'v',
      primer_nombre: fila.nombre, segundo_nombre: fila.segundo_nombre,
      primer_apellido: fila.apellido, segundo_apellido: fila.segundo_apellido,
      fecha_nacimiento: this.dateMask.fechaADisplay(fila.fecha_nacimiento), telefono: fila.telefono,
      email: fila.email || '', direccion: fila.direccion || '', sexo: fila.sexo || '', estado_civil: fila.estado_civil || '',
      con_representante: false, cedula_representante: '', numero_hijo: '', nombre_representante: '', parentesco_representante: '',
    };
    this.cargarRepresentante(fila);
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
    const p = this.nuevoPaciente;
    const vacio = (v: string | null | undefined) => !(v || '').trim();
    if (vacio(p.primer_nombre)) { this.swal.warning('El primer nombre es obligatorio'); return; }
    if (vacio(p.segundo_nombre)) { this.swal.warning('El segundo nombre es obligatorio'); return; }
    if (vacio(p.primer_apellido)) { this.swal.warning('El primer apellido es obligatorio'); return; }
    if (vacio(p.segundo_apellido)) { this.swal.warning('El segundo apellido es obligatorio'); return; }
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test((p.fecha_nacimiento || '').trim())) { this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)'); return; }
    if (!p.sexo) { this.swal.warning('Debe seleccionar el sexo'); return; }
    if (!p.estado_civil) { this.swal.warning('Debe seleccionar el estado civil'); return; }
    if (p.con_representante) {
      // Menor de edad: se validan los datos del representante y la cédula del
      // niño se arma como '<cedula_representante>-<numero_hijo>' (ej: 31693727-1).
      const esPasaporte = p.tipo_documento === 'p';
      const cedulaRepCruda = (p.cedula_representante || '').trim();
      const cedRep = esPasaporte ? cedulaRepCruda : cedulaRepCruda.replace(/\D/g, '');
      const hijo = parseInt((p.numero_hijo || '').replace(/\D/g, ''), 10);
      if (esPasaporte) {
        if (cedulaRepCruda.length < 10 || cedulaRepCruda.length > 12) { this.swal.warning('El pasaporte del representante debe tener entre 10 y 12 caracteres'); return; }
      } else if (cedRep.length < 6 || cedRep.length > 8) { this.swal.warning('La cedula del representante debe tener entre 6 y 8 digitos'); return; }
      if (!hijo || hijo < 1) { this.swal.warning('El numero de hijo debe ser 1 o mayor (ej: 1 para el primer hijo)'); return; }
      if (vacio(p.nombre_representante)) { this.swal.warning('El nombre del representante es obligatorio'); return; }
      if (!p.parentesco_representante) { this.swal.warning('Debe seleccionar el parentesco del representante'); return; }
      p.cedula = `${cedRep}-${hijo}`;
    } else {
      const cedula = (p.cedula || '').trim();
      if (p.tipo_documento === 'p') {
        if (cedula.length < 10 || cedula.length > 12) { this.swal.warning('El pasaporte debe tener entre 10 y 12 caracteres'); return; }
      } else if (!/^\d{7,8}$/.test(cedula) && !/^\d{6,8}-\d{1,2}$/.test(cedula)) {
        // Se acepta la cédula armada de un menor ya registrado ('31693727-1')
        // aunque el checkbox del representante esté desmarcado: se conserva
        // tal cual al guardar, hasta que se edite por la cédula nueva.
        this.swal.warning('La cedula debe tener entre 7 y 8 digitos');
        return;
      }
    }
    const tel = (p.telefono || '').replace(/\D/g, '');
    if (tel.length < 11 || tel.length > 12) { this.swal.warning('El telefono es obligatorio y debe tener entre 11 y 12 digitos'); return; }
    const email = (p.email || '').trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { this.swal.warning('El correo electronico no es valido'); return; }
    if (vacio(p.direccion)) { this.swal.warning('La direccion es obligatoria'); return; }
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) { this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio'); return; }
    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) { this.swal.warning('Debe seleccionar el nombre de la aseguradora'); return; }

    this.isSaving = true;
    this.inicioGuardado = Date.now();

    // Si el valor es una cédula armada de menor ('31693727-1') se conserva tal
    // cual; si no, solo se quedan los dígitos (formato de adulto).
    const conRep = !!p.con_representante;
    const cedulaPaciente = (p.cedula || '').toString().trim();
    const cedulaNormalizada = conRep ? cedulaPaciente : (/^\d{6,8}-\d{1,2}$/.test(cedulaPaciente) ? cedulaPaciente : cedulaPaciente.replace(/\D/g, ''));
    const datosPaciente = {
      cedula: (p.tipo_documento !== 'p') ? cedulaNormalizada : cedulaNormalizada.toUpperCase(),
      tipo_documento: p.tipo_documento || 'v',
      primer_nombre: (p.primer_nombre || '').toString().toUpperCase().trim(),
      segundo_nombre: (p.segundo_nombre || '').toString().toUpperCase().trim(),
      primer_apellido: (p.primer_apellido || '').toString().toUpperCase().trim(),
      segundo_apellido: (p.segundo_apellido || '').toString().toUpperCase().trim(),
      fecha_nacimiento: this.dateMask.fechaABackend(p.fecha_nacimiento),
      telefono: (p.telefono || '').toString().replace(/\D/g, '').trim(),
      email: (p.email || '').trim().toLowerCase() || null,
      direccion: (p.direccion || '').trim() || null,
      sexo: p.sexo || null,
      estado_civil: p.estado_civil || null,
      // Con el check desmarcado vienen en null: el COALESCE del backend conserva
      // el histórico del representante (el niño ya tiene su propia cédula).
      cedula_representante: conRep ? (p.tipo_documento === 'p' ? (p.cedula_representante || '').trim().toUpperCase() : (p.cedula_representante || '').replace(/\D/g, '')) : null,
      numero_hijo: conRep ? parseInt((p.numero_hijo || '').replace(/\D/g, ''), 10) || null : null,
      nombre_representante: conRep ? (p.nombre_representante || '').toUpperCase().trim() : null,
      parentesco_representante: conRep ? (p.parentesco_representante || '').trim() : null,
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

  // --- Sexo / Estado Civil ---
  toggleSexoDropdown() { this.showSexoDropdown = !this.showSexoDropdown; }
  selectSexo(codigo: string) { this.nuevoPaciente.sexo = codigo; this.showSexoDropdown = false; }
  getSexoLabel(): string { return this.sexos.find((s) => s.codigo === this.nuevoPaciente.sexo)?.nombre || ''; }
  toggleEstadoCivilDropdown() { this.showEstadoCivilDropdown = !this.showEstadoCivilDropdown; }
  selectEstadoCivil(codigo: string) { this.nuevoPaciente.estado_civil = codigo; this.showEstadoCivilDropdown = false; }
  getEstadoCivilLabel(): string { return this.estadosCiviles.find((e) => e.codigo === this.nuevoPaciente.estado_civil)?.nombre || ''; }

  // --- Menor de edad / representante ---
  /**
   * Carga los datos del representante de un paciente ya registrado.
   * Si es niño (cédula armada '31693727-1' o con representante guardado) el
   * checkbox "Es niño(a)" queda MARCADO al abrir el modal de edición.
   */
  cargarRepresentante(p: any) {
    const cedula = (p?.cedula || '').toString();
    const esMenor = /^\d{6,8}-\d{1,2}$/.test(cedula);
    const partes = esMenor ? cedula.split('-') : [];
    const tieneRep = !!(p?.cedula_representante || p?.nombre_representante || p?.numero_hijo);
    this.nuevoPaciente.con_representante = esMenor || tieneRep;
    this.nuevoPaciente.cedula_representante = p?.cedula_representante || (esMenor ? partes[0] : '');
    this.nuevoPaciente.numero_hijo = p?.numero_hijo ? String(p.numero_hijo) : (esMenor ? partes[1] || '' : '');
    this.nuevoPaciente.nombre_representante = p?.nombre_representante || '';
    this.nuevoPaciente.parentesco_representante = p?.parentesco_representante || '';
  }

  /** Cambio del checkbox "Es niño(a)": al desmarcarlo NO se borra la cédula. */
  onConRepresentanteChange(con: boolean) {
    this.nuevoPaciente.con_representante = con;
    if (!con && !(this.nuevoPaciente.cedula || '').trim()) this.nuevoPaciente.cedula = this.cedulaArmada;
  }

  /** Cédula armada del menor: '31693727-1' (cédula del representante + número de hijo). */
  get cedulaArmada(): string {
    const rep = (this.nuevoPaciente.cedula_representante || '').replace(/\D/g, '');
    const hijo = (this.nuevoPaciente.numero_hijo || '').replace(/\D/g, '');
    return rep && hijo ? `${rep}-${hijo}` : '';
  }

  toggleNumeroHijoDropdown() { this.showNumeroHijoDropdown = !this.showNumeroHijoDropdown; }
  selectNumeroHijo(numero: string) { this.nuevoPaciente.numero_hijo = numero; this.showNumeroHijoDropdown = false; }
  getNumeroHijoLabel(): string { return (this.nuevoPaciente.numero_hijo || '').replace(/\D/g, ''); }

  toggleParentescoDropdown() { this.showParentescoDropdown = !this.showParentescoDropdown; }
  selectParentesco(nombre: string) { this.nuevoPaciente.parentesco_representante = nombre; this.showParentescoDropdown = false; }
  esParentescoSeleccionado(nombre: string): boolean {
    const seleccionado = (this.nuevoPaciente.parentesco_representante || '').trim();
    return !!seleccionado && this.mismaClave(nombre, seleccionado);
  }
  getParentescoLabel(): string {
    const seleccionado = (this.nuevoPaciente.parentesco_representante || '').trim();
    if (!seleccionado) return '';
    return this.parentescos.find((x) => this.mismaClave(x.nombre, seleccionado))?.nombre || seleccionado;
  }
  private mismaClave(a: string, b: string): boolean {
    const norm = (v: string) => (v || '').toString().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase();
    return norm(a) === norm(b);
  }

  // --- Display helpers ---
  private normalizeString(str: string): string { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  getResponsableLabel(value: string | undefined): string { const m = (value || '').toString().trim().toLowerCase(); if (m.includes('particular')) return 'Particular'; if (m.includes('seguro') || m.includes('asegur')) return 'Aseguradora'; return 'SIN ASIGNAR'; }
  getServicioCategoria(value: string | undefined): string { const s = (value || '').toString().trim().toLowerCase(); if (s.includes('laboratorio')) return 'Laboratorio'; if (s.includes('imágenes') || s.includes('imagenes')) return 'Imágenes'; return 'Consulta'; }
}
