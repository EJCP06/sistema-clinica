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
import { TourAnchorMatMenuDirective } from 'ngx-ui-tour-md-menu';

import { ColaAutocompleteService, AutocompleteState } from '../../shared/features/cola-servicio/cola-autocomplete.service';
import { ColaDateMaskService } from '../../shared/features/cola-servicio/cola-date-mask.service';
import { ApsAdmissionListService } from './aps-admission-list.service';

@Component({
  selector: 'app-aps',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header, PaginationComponent, PaginatePipe, FillersPipe, TourAnchorMatMenuDirective],
  templateUrl: './aps.html'
})
export class ApsComponent implements OnInit, OnDestroy {
  readonly Search = Search; readonly FileText = FileText; readonly CheckCircle2 = CheckCircle2;
  readonly ChevronDown = ChevronDown; readonly Undo2 = Undo2; readonly KeyRound = KeyRound;
  readonly DollarSign = DollarSign; readonly Trash2 = Trash2; readonly Megaphone = Megaphone;
  readonly Edit2 = Edit2; readonly UserPlus = UserPlus; readonly XCircle = XCircle;

  pageSize = 9; currentPage = 1; sidebarOpen = false; cedulaBusqueda = ''; cargando = true;
  searchFilter = 'todo'; showSearchFilterDropdown = false;
  ultimasAdmisiones: AdmisionDTO[] = [];

  mostrarRegistro = false; isEditMode = false; filaEnEdicion: any = null; isSaving = false;
  private inicioGuardado = 0; private readonly MIN_GUARDADO = 800;

  nuevoPaciente: any = { id_paciente: null, cedula: '', primer_nombre: '', segundo_nombre: '', primer_apellido: '', segundo_apellido: '', fecha_nacimiento: '', telefono: '' };
  seleccion: any = { id_servicio: null, id_responsable: null, id_cliente: null, id_atencion: null, id_especialidad: null, id_medico: null, id_consultorio: null, nombre_servicio_label: '', nombre_medico_label: '', nombre_especialidad_label: '' };

  categoriaServicio = ''; showPayerDropdown = false; showServiceDropdown = false;
  showEspecialidadDropdown = false; showMedicoDropdown = false; showAseguradoraDropdown = false;

  aseguradoraState: AutocompleteState; especialidadState: AutocompleteState; medicoState: AutocompleteState;

  servicios: any[] = []; especialidades: any[] = []; aseguradoras: any[] = [];
  responsables: any[] = []; medicos: any[] = []; consultorios: any[] = [];

  get admisionesFiltradas(): AdmisionDTO[] {
    return this.ultimasAdmisiones.filter(a => {
      const q = (this.cedulaBusqueda || '').trim().toLowerCase();
      if (!q) return true;
      const mN = (a.nombre || '').toLowerCase().includes(q);
      const mA = (a.apellido || '').toLowerCase().includes(q);
      const mC = (a.cedula || '').toLowerCase().includes(q);
      if (this.searchFilter === 'nombre') return mN;
      if (this.searchFilter === 'apellido') return mA;
      if (this.searchFilter === 'cedula') return mC;
      return mN || mA || mC;
    });
  }

  get fillersVacios(): number[] { return Array(this.pageSize).fill(0); }
  trackById = (index: number, item: AdmisionDTO) => item?.id_atencion ?? index;

  get aseguradorasFiltradas(): any[] { return this.ac.filterItems(this.aseguradoras, this.aseguradoraState.filtro, 'aseguradora'); }
  get especialidadesFiltradas(): any[] { return this.ac.filterItems(this.getEspecialidades(), this.especialidadState.filtro, 'nombre'); }
  get medicosConFiltro(): any[] { return this.ac.filterByComposite(this.medicosFiltrados, this.medicoState.filtro, 'nombre', 'apellido'); }

  private marcandoAusente = false;
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private espService = inject(EspecialidadesService);
  private scrollService = inject(ScrollService);
  private ac = inject(ColaAutocompleteService);
  private dateMask = inject(ColaDateMaskService);
  private apsList = inject(ApsAdmissionListService);

  constructor(private api: ApiService, public auth: AuthService) {
    this.aseguradoraState = this.ac.create();
    this.especialidadState = this.ac.create();
    this.medicoState = this.ac.create();
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false; this.showPayerDropdown = false; this.showServiceDropdown = false;
      this.showEspecialidadDropdown = false; this.showMedicoDropdown = false; this.showAseguradoraDropdown = false;
    } else {
      const t = event.target as HTMLElement;
      if (!t.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!t.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!t.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!t.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false;
      if (!t.closest('.medico-dropdown-container')) this.showMedicoDropdown = false;
      if (!t.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false;
    }
  }

  ngOnInit() {
    this.cargarDatosMaestros();
    this.cargarUltimasAdmisiones();

    this.api.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: any) => {
      if (this.marcandoAusente) return;
      if (event?.tipo === 'llamado') return;
      // El anuncio general de silencio no altera la cola de admisiones.
      if (event?.tipo === 'anuncio-general') return;
      if (event?.admision) {
        const a = event.admision;
        const servicioLower = (a.nombre_servicio || '').toLowerCase();
        const esLab = servicioLower.includes('laboratorio');
        const esImg = servicioLower.includes('imágenes') || servicioLower.includes('imagenes');
        const esCon = this.apsList.esConsulta(a.nombre_servicio);
        const modalidad = (a.modalidad_pago || '').toLowerCase();
        const esSeg = modalidad === 'seguro'; const esPart = modalidad === 'particular';

        if (event.tipo === 'nuevo-turno') {
          if ((esLab || esImg ? esSeg : (esCon ? (esSeg || esPart) : false)) && ![6, 9].includes(Number(a.id_estado_actual)))
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
        } else if (event.tipo === 'retirado') {
          const idx = this.ultimasAdmisiones.findIndex(x => x.id_atencion === a.id_atencion);
          if (idx !== -1) { this.ultimasAdmisiones[idx] = a; this.ultimasAdmisiones = [...this.ultimasAdmisiones]; }
        } else if (event.tipo === 'ausente') {
          this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
        } else if (event.tipo === 'estado-cambiado') {
          if ([6, 9].includes(Number(event.id_estado_nuevo)))
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
          else if (Number(event.id_estado_nuevo) === 3) {
            if (esLab || esImg) this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
            else if (esSeg || esPart) this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        }
      } else if (event.tipo === 'eliminado') {
        const id = Number(event.id_atencion); if (!isNaN(id)) this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== id);
      } else if (event.tipo === 'liberacion' || event.tipo === 'retirado') {
        this.cargarUltimasAdmisiones();
      } else if (event.tipo === 'estado-cambiado') {
        if ([6, 9].includes(Number(event.id_estado_nuevo))) {
          const id = Number(event.id_atencion); if (!isNaN(id)) this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== id); else this.cargarUltimasAdmisiones();
        }
      } else { this.cargarUltimasAdmisiones(); }
    });

    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.cargarUltimasAdmisiones());
  }

  ngOnDestroy() {}
  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }
  toggleSearchFilterDropdown() { this.showSearchFilterDropdown = !this.showSearchFilterDropdown; }
  selectSearchFilter(filter: string) { this.searchFilter = filter; this.showSearchFilterDropdown = false; }
  getSearchFilterLabel(): string { return ({ todo: 'TODO', nombre: 'NOMBRES', apellido: 'APELLIDOS', cedula: 'CÉDULA' } as Record<string, string>)[this.searchFilter] || 'TODO'; }
  onSearchChange(_value: string | undefined) {}

  cargarUltimasAdmisiones() {
    this.cargando = true;
    this.api.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => { this.ultimasAdmisiones = this.apsList.filtrarParaAps(data || []); this.cargando = false; },
      error: () => { this.cargando = false; console.error('Error cargando ultimas admisiones'); },
    });
  }

  llamarPaciente(paciente: any) { this.api.post(`recepcion/atencion/${paciente.id_atencion}/llamar-aps`, {}).subscribe({ next: () => {}, error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente') }); }
  llamarClave(admision: any) { this.api.post(`recepcion/atencion/${admision.id_atencion}/llamar-clave`, {}).subscribe({ next: () => {}, error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente') }); }

  anunciandoSilencio = false;
  /**
   * Emite el anuncio general de SILENCIO por voz en el turnero de la sede
   * (botón rojo con megáfono junto al buscador).
   */
  anunciarSilencio() {
    if (this.anunciandoSilencio) return;
    this.anunciandoSilencio = true;
    this.api.post('recepcion/anuncio-silencio', {}).pipe(finalize(() => this.anunciandoSilencio = false)).subscribe({
      next: () => {},
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al emitir el anuncio'),
    });
  }

  async enviarAPresupuesto(admision: any) { const r = await this.swal.confirm('¿Ya se creó el presupuesto al paciente?'); if (!r.isConfirmed) return; this.api.actualizarEstadoAtencion(admision.id_atencion, this.apsList.esAseguradora(admision) ? 8 : 2).subscribe({ next: () => this.cargarUltimasAdmisiones(), error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado') }); }
  async solicitarClave(admision: any) { const r = await this.swal.confirm('¿Deseas solicitar la clave de aseguradora?'); if (!r.isConfirmed) return; this.api.actualizarEstadoAtencion(admision.id_atencion, 8).subscribe({ next: () => this.cargarUltimasAdmisiones(), error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado') }); }

  async enviarACaja(id_atencion: number) {
    const r = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?'); if (!r.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => { const adm = this.ultimasAdmisiones.find(a => a.id_atencion === id_atencion); const svc = (adm?.nombre_servicio || '').toLowerCase(); if (svc.includes('laboratorio') || svc.includes('imágenes') || svc.includes('imagenes')) this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== id_atencion); else this.cargarUltimasAdmisiones(); },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado'),
    });
  }

  async aprobarClave(admision: any) {
    const r = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?'); if (!r.isConfirmed) return;
    this.api.actualizarEstadoAtencion(admision.id_atencion, 3).subscribe({
      next: () => { const svc = (admision.nombre_servicio || '').toLowerCase(); if (svc.includes('laboratorio') || svc.includes('imágenes') || svc.includes('imagenes')) this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== admision.id_atencion); else this.cargarUltimasAdmisiones(); },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado'),
    });
  }

  async enviarASalaEspera(id_atencion: number) { const r = await this.swal.confirm('¿Deseas enviar este paciente a Sala de Espera?'); if (!r.isConfirmed) return; this.api.actualizarEstadoAtencion(id_atencion, 4).subscribe({ next: () => this.cargarUltimasAdmisiones(), error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado') }); }
  async reincorporar(id_atencion: number) { const r = await this.swal.confirm('¿Deseas reincorporar este paciente a la Sala de Espera?'); if (!r.isConfirmed) return; this.api.reincorporarPaciente(id_atencion).subscribe({ next: () => this.cargarUltimasAdmisiones(), error: (err) => this.swal.error(err.error?.mensaje || 'Error al reincorporar paciente') }); }

  async marcarAusente(admision: any) {
    const r = await this.swal.confirm('¿Quieres retirar al paciente?', '¿Estás seguro?'); if (!r.isConfirmed) return;
    this.marcandoAusente = true;
    this.api.put(`recepcion/atencion/${admision.id_atencion}/marcar_ausente`, {}).pipe(finalize(() => this.marcandoAusente = false)).subscribe({
      next: () => { this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== admision.id_atencion); this.api.cambios$.next({ id_atencion: admision.id_atencion }); this.swal.success('Paciente retirado correctamente'); },
      error: () => this.swal.error('Error al retirar paciente'),
    });
  }

  // --- Modal ---
  cargarDatosMaestros() {
    this.api.getServicios().subscribe({ next: (d: any) => (this.servicios = d || []), error: () => {} });
    this.espService.getAllEspecialidades().subscribe({ next: (d: any) => (this.especialidades = d || []), error: () => {} });
    this.api.getAseguradoras().subscribe({ next: (d: any) => (this.aseguradoras = d || []), error: () => {} });
    this.api.get('recepcion/responsables-pago').subscribe({ next: (d: any) => (this.responsables = d || []), error: () => {} });
    this.api.getPersonal('medico').subscribe({ next: (d: any) => (this.medicos = d || []), error: () => {} });
    this.api.getConsultorios().subscribe({ next: (d: any) => (this.consultorios = d || []), error: () => {} });
  }

  abrirModalRegistro() { this.mostrarRegistro = true; this.scrollService.block(); }
  cerrarModalRegistro() { this.mostrarRegistro = false; this.scrollService.unblock(); this.isEditMode = false; this.filaEnEdicion = null; }

  editarFila(fila: any, _trigger?: EventTarget | null) {
    this.filaEnEdicion = fila; this.isEditMode = true;
    this.nuevoPaciente = { id_paciente: fila.id_paciente, cedula: fila.cedula, primer_nombre: fila.nombre, segundo_nombre: fila.segundo_nombre, primer_apellido: fila.apellido, segundo_apellido: fila.segundo_apellido, fecha_nacimiento: this.dateMask.fechaADisplay(fila.fecha_nacimiento), telefono: fila.telefono };
    this.seleccion = { id_servicio: fila.id_servicio, id_responsable: fila.id_responsable, id_cliente: fila.id_cliente, id_atencion: fila.id_atencion, id_especialidad: fila.id_especialidad, id_medico: fila.id_medico || null, id_consultorio: fila.id_consultorio || null, nombre_medico_label: fila.nombre_medico || '', nombre_servicio_label: '', nombre_especialidad_label: '' };
    this.categoriaServicio = this.getServicioCategoria(fila.nombre_servicio);
    if (fila.id_especialidad) { const esp = this.especialidades.find((e: any) => (e.id_especialidad || e.id) === fila.id_especialidad); if (esp) { this.seleccion.nombre_especialidad_label = esp.nombre; this.especialidadState.filtro = esp.nombre; } }
    const asig = this.aseguradoras.find((a: any) => a.id_cliente === fila.id_cliente);
    this.aseguradoraState.filtro = asig ? asig.aseguradora : '';
    this.medicoState.filtro = fila.nombre_medico || (fila.id_medico ? this.getNombreMedicoLabel(fila.id_medico) : '');
    this.abrirModalRegistro();
  }

  guardarPaciente() {
    if (this.isSaving) return;
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) { this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio'); return; }
    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) { this.swal.warning('Debe seleccionar el nombre de la aseguradora'); return; }
    const fn = (this.nuevoPaciente.fecha_nacimiento || '').toString().trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fn)) { this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)'); return; }
    this.isSaving = true; this.inicioGuardado = Date.now();
    const datosPaciente = { cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim(), primer_nombre: (this.nuevoPaciente.primer_nombre || '').toString().toUpperCase().trim(), segundo_nombre: (this.nuevoPaciente.segundo_nombre || '').toString().toUpperCase().trim(), primer_apellido: (this.nuevoPaciente.primer_apellido || '').toString().toUpperCase().trim(), segundo_apellido: (this.nuevoPaciente.segundo_apellido || '').toString().toUpperCase().trim(), fecha_nacimiento: this.dateMask.fechaABackend(this.nuevoPaciente.fecha_nacimiento), telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim() };
    this.api.put(`recepcion/pacientes/${this.nuevoPaciente.id_paciente}`, datosPaciente).subscribe({
      next: () => { this.api.put(`recepcion/atencion/${this.seleccion.id_atencion}`, { id_servicio: this.seleccion.id_servicio, id_responsable: this.seleccion.id_responsable, id_cliente: this.seleccion.id_cliente, id_especialidad: this.seleccion.id_especialidad || null, id_medico: this.seleccion.id_medico || null, id_consultorio: this.seleccion.id_consultorio || null }).subscribe({ next: () => this.finalizarGuardado(() => { this.mostrarRegistro = false; this.scrollService.unblock(); this.isEditMode = false; this.filaEnEdicion = null; this.swal.success('Cambios guardados con éxito'); this.cargarUltimasAdmisiones(); this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.seleccion.id_atencion }); }), error: () => this.finalizarGuardado(() => this.swal.error('Error al actualizar la atención')) }); },
      error: (err: any) => this.finalizarGuardado(() => { if (err.status === 409) this.swal.error('Ya existe otro paciente con esa cédula'); else this.swal.error(err.error?.mensaje || 'Error al actualizar datos del paciente'); }),
    });
  }

  private finalizarGuardado(accion?: () => void) { const t = Date.now() - this.inicioGuardado; setTimeout(() => { if (accion) accion(); this.isSaving = false; }, Math.max(0, this.MIN_GUARDADO - t)); }

  // --- Autocomplete delegates ---
  onAseguradoraInput(event: Event) { this.ac.onInput(this.aseguradoraState, event); this.showAseguradoraDropdown = true; }
  onAseguradoraKeydown(event: KeyboardEvent) { this.ac.onKeydown(this.aseguradoraState, event, this.aseguradorasFiltradas); if (event.key === 'Enter' && this.aseguradoraState.index >= 0) this.selectAseguradora(this.aseguradorasFiltradas[this.aseguradoraState.index]?.id_cliente); }
  onEspecialidadInput(event: Event) { this.ac.onInput(this.especialidadState, event); this.showEspecialidadDropdown = true; }
  onEspecialidadKeydown(event: KeyboardEvent) { this.ac.onKeydown(this.especialidadState, event, this.especialidadesFiltradas); if (event.key === 'Enter' && this.especialidadState.index >= 0) this.selectEspecialidad(this.especialidadesFiltradas[this.especialidadState.index]); }
  onMedicoInput(event: Event) { this.ac.onInput(this.medicoState, event); this.showMedicoDropdown = true; }
  onMedicoKeydown(event: KeyboardEvent) { this.ac.onKeydown(this.medicoState, event, this.medicosConFiltro); if (event.key === 'Enter' && this.medicoState.index >= 0) this.selectMedico(this.medicosConFiltro[this.medicoState.index]); }

  // --- Dropdown helpers ---
  togglePayerDropdown() { this.showPayerDropdown = !this.showPayerDropdown; }
  selectPayer(id: number) { if (this.seleccion.id_responsable === id) { this.showPayerDropdown = false; return; } this.seleccion.id_responsable = id; this.showPayerDropdown = false; if (id !== 2) this.seleccion.id_cliente = null; this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = ''; this.categoriaServicio = ''; this.aseguradoraState.filtro = ''; this.especialidadState.filtro = ''; this.medicoState.filtro = ''; }
  toggleAseguradoraDropdown() { this.showAseguradoraDropdown = !this.showAseguradoraDropdown; }
  selectAseguradora(id: number) { this.seleccion.id_cliente = id; this.showAseguradoraDropdown = false; this.aseguradoraState.index = -1; const asig = this.aseguradoras.find((a: any) => a.id_cliente === id); this.aseguradoraState.filtro = asig ? asig.aseguradora : ''; }
  getNombreAseguradoraSeleccionada(id: any): string { if (!id) return 'Seleccione...'; const asig = this.aseguradoras.find((a: any) => a.id_cliente === id); return asig ? asig.aseguradora : 'Seleccione...'; }
  getNombreResponsable(id: any): string { if (!id) return 'Seleccione...'; const rp = this.responsables.find((r: any) => r.id === id); return this.getResponsableLabel(rp?.nombre || (id === 1 ? 'Particular' : id === 2 ? 'Seguro' : 'Seleccione...')); }
  toggleServiceDropdown() { this.showServiceDropdown = !this.showServiceDropdown; }

  selectCategoria(categoria: string) {
    if (this.categoriaServicio === categoria) { this.showServiceDropdown = false; return; }
    this.categoriaServicio = categoria; this.showServiceDropdown = false;
    this.seleccion.id_servicio = null; this.seleccion.id_especialidad = null; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = ''; this.seleccion.nombre_servicio_label = ''; this.especialidadState.filtro = ''; this.medicoState.filtro = '';
    if (categoria !== 'Consulta') {
      const n = this.normalizeString(categoria);
      const s = this.servicios.find((sv: any) => this.normalizeString(sv.nombre || sv.nombre_servicio || '').includes(n));
      if (s) this.seleccion.id_servicio = s.id || s.id_servicio;
      else { this.swal.warning(`El servicio de ${categoria} no está configurado para esta sede.`); this.categoriaServicio = ''; }
    }
  }

  toggleEspecialidadDropdown() { this.showEspecialidadDropdown = !this.showEspecialidadDropdown; }
  selectEspecialidad(item: any) {
    if (this.categoriaServicio === 'Consulta') { this.seleccion.id_servicio = item.id_servicio; this.seleccion.id_especialidad = item.id_especialidad || item.id; this.seleccion.nombre_servicio_label = item.nombre || ''; this.seleccion.id_medico = null; this.seleccion.id_consultorio = null; this.seleccion.nombre_medico_label = ''; }
    else { this.seleccion.id_servicio = item.id || item.id_servicio; this.seleccion.id_especialidad = null; this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || ''; }
    this.ac.select(this.especialidadState, item.nombre || item.nombre_servicio || ''); this.showEspecialidadDropdown = false;
  }

  getEspecialidades() {
    if (!this.categoriaServicio || this.categoriaServicio === 'Consulta') return this.especialidades.filter((e: any) => e.activo !== false);
    if (this.categoriaServicio === 'Laboratorio') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('laboratorio'));
    if (this.categoriaServicio === 'Imágenes') return this.servicios.filter((s: any) => (s.nombre || s.nombre_servicio || '').toLowerCase().includes('imagen'));
    return [];
  }

  get medicosFiltrados(): any[] {
    if (!this.seleccion.id_especialidad) return [];
    const target = Number(this.seleccion.id_especialidad);
    return this.medicos.filter((m: any) => { const inactivas = Array.isArray(m.especialidades_inactivas) ? m.especialidades_inactivas.map(Number) : []; if (inactivas.includes(target)) return false; const espId = Number(m.id_especialidad || m.especialidad_id); if (espId === target) return true; return Array.isArray(m.especialidades) && m.especialidades.some((e: any) => Number(e) === target); });
  }

  toggleMedicoDropdown() { this.showMedicoDropdown = !this.showMedicoDropdown; }
  selectMedico(m: any) { this.seleccion.id_medico = m.id_usuario || m.id; this.seleccion.id_consultorio = m.id_consultorio || m.consultorio_id || null; this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim(); this.ac.select(this.medicoState, this.seleccion.nombre_medico_label); this.showMedicoDropdown = false; }
  getNombreMedicoLabel(id: any): string { if (!id) return 'Seleccione médico...'; if (this.seleccion.nombre_medico_label) return this.seleccion.nombre_medico_label; const m = this.medicos.find((d: any) => (d.id_usuario || d.id) === id); return m ? ((m.nombre || '') + ' ' + (m.apellido || '')).trim() : 'Seleccione médico...'; }
  getMedicoConsultorio(): string { if (!this.seleccion.id_consultorio) return ''; const c = this.consultorios.find((c: any) => c.id == this.seleccion.id_consultorio); return c ? c.nombre : ''; }
  getNombreServicioLabel(id: any): string { if (this.seleccion.nombre_servicio_label) return this.seleccion.nombre_servicio_label; if (!id) return 'Seleccione...'; const s = this.servicios.find((sv: any) => (sv.id || sv.id_servicio) === id); return s ? s.nombre || s.nombre_servicio || 'Seleccione...' : 'Seleccione...'; }

  soloLetras(event: any) { const p = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/; const c = String.fromCharCode(event.charCode); if (event.charCode !== 0 && !p.test(c)) event.preventDefault(); else { const i = event.target as HTMLInputElement; if (c === ' ' && i.value.length === 0) event.preventDefault(); } }
  trimCampo(event: Event) { const i = event.target as HTMLInputElement; i.value = i.value.trim(); i.dispatchEvent(new Event('input')); }
  soloNumeros(event: any) { if (event.charCode !== 0 && !/[0-9]/.test(String.fromCharCode(event.charCode))) event.preventDefault(); }

  onFechaNacimientoInput(event: Event) {
    const input = event.target as HTMLInputElement; const cursorPos = input.selectionStart || 0;
    const r = this.dateMask.aplicarCambioFecha(this.nuevoPaciente.fecha_nacimiento || '', input.value, cursorPos);
    this.nuevoPaciente.fecha_nacimiento = r.valor; input.value = r.valor; input.setSelectionRange(r.cursor, r.cursor);
  }

  private normalizeString(str: string): string { return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); }
  esAseguradora(dto: { modalidad_pago?: string }): boolean { return this.apsList.esAseguradora(dto); }
  getResponsableLabel(value: string | undefined): string { const m = (value || '').toString().trim().toLowerCase(); if (m.includes('particular')) return 'Particular'; if (m.includes('seguro') || m.includes('asegur')) return 'Aseguradora'; return 'SIN ASIGNAR'; }
  getServicioCategoria(value: string | undefined): string { const s = (value || '').toString().trim().toLowerCase(); if (s.includes('laboratorio')) return 'Laboratorio'; if (s.includes('imágenes') || s.includes('imagenes')) return 'Imágenes'; return 'Consulta'; }
}
