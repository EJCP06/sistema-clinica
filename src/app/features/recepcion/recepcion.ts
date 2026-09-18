import {
  Component, OnInit, OnDestroy, HostListener, ElementRef, inject, ChangeDetectorRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { aplicarCambioFecha } from './recepcion-fechas.util';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule, Search, UserPlus, Plus, FileText, CheckCircle2, ChevronRight,
  User, Phone, CreditCard, Stethoscope, ChevronDown, XCircle, ShieldCheck,
  ClipboardList, Edit2, Trash2, Upload, Info,
} from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { ScrollService } from '../../core/services/scroll.service';
import { RecepcionAutocompleteService, AutocompleteItem } from './recepcion-autocomplete.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';
import { RecepcionSeleccionService } from './recepcion-seleccion.service';
import { RecepcionPacienteService } from './recepcion-paciente.service';
import { RecepcionAtencionService, RecepcionState } from './recepcion-atencion.service';
import { RecepcionAseguradoraService } from './recepcion-aseguradora.service';

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './recepcion.html',
})
export class RecepcionComponent implements OnInit, OnDestroy, RecepcionState {
  readonly Search = Search; readonly UserPlus = UserPlus; readonly Plus = Plus;
  readonly FileText = FileText; readonly CheckCircle2 = CheckCircle2; readonly ChevronRight = ChevronRight;
  readonly User = User; readonly Phone = Phone; readonly CreditCard = CreditCard;
  readonly Stethoscope = Stethoscope; readonly ChevronDown = ChevronDown; readonly XCircle = XCircle;
  readonly ShieldCheck = ShieldCheck; readonly ClipboardList = ClipboardList; readonly Edit2 = Edit2;
  readonly Trash2 = Trash2; readonly Upload = Upload; readonly Info = Info;

  pageSize = 9; currentPage = 1;
  sidebarOpen = false; cedulaBusqueda = ''; buscando = false; cargando = true; filaEnEdicion: any = null;
  searchFilter = 'todo'; showSearchFilterDropdown = false; showDocTypeDropdown = false;
  mostrarResultadosBusqueda = false; pacientesEncontrados: any[] = []; pacienteEncontrado: any = null;
  isSaving = false; private inicioGuardado = 0; private readonly MIN_GUARDADO = 800;
  _mostrarRegistro = false; isEditMode = false; modalTrigger: HTMLElement | null = null;
  pageTitle = 'Admision de Pacientes'; pageSubtitle = 'Gestion de entrada y asignacion de turnos medicos'; isAseguradorasView = false;
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription; private busquedaSubscription?: Subscription;
  private cambiosSub?: Subscription;
  private el = inject(ElementRef); private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute); private auth = inject(AuthService);
  private scrollService = inject(ScrollService); private swal = inject(SwalService);
  private api = inject(ApiService); private router = inject(Router);
  private ac = inject(RecepcionAutocompleteService);
  private sel = inject(RecepcionSeleccionService);
  private pac = inject(RecepcionPacienteService);
  private atencion = inject(RecepcionAtencionService);
  private asegs = inject(RecepcionAseguradoraService);

  get seleccion() { return this.sel.seleccion; }
  get nuevoPaciente() { return this.pac.nuevoPaciente; }
  get nombreCompleto() { return this.pac.nombreCompleto; }
  get ultimasAdmisiones() { return this.atencion.ultimasAdmisiones; }
  get aseguradoras() { return this.asegs.aseguradoras; }
  get servicios() { return this.sel.servicios; }
  get especialidades() { return this.sel.especialidades; }
  get responsables() { return this.sel.responsables; }
  get medicos() { return this.sel.medicos; }
  get consultorios() { return this.sel.consultorios; }
  get mostrarRegistro() { return this._mostrarRegistro; }
  set mostrarRegistro(v: boolean) { this._mostrarRegistro = v; if (v) { this.scrollService.block(); } else { this.scrollService.unblock(); } }
  get categoriaServicio() { return this.sel.categoriaServicio; }
  set categoriaServicio(v: string) { this.sel.categoriaServicio = v; }
  get showPayerDropdown() { return this.sel.showPayerDropdown; }
  set showPayerDropdown(v: boolean) { this.sel.showPayerDropdown = v; }
  get showServiceDropdown() { return this.sel.showServiceDropdown; }
  set showServiceDropdown(v: boolean) { this.sel.showServiceDropdown = v; }
  get showEspecialidadDropdown() { return this.sel.showEspecialidadDropdown; }
  set showEspecialidadDropdown(v: boolean) { this.sel.showEspecialidadDropdown = v; }
  get showMedicoDropdown() { return this.sel.showMedicoDropdown; }
  set showMedicoDropdown(v: boolean) { this.sel.showMedicoDropdown = v; }
  get showAseguradoraDropdown() { return this.sel.showAseguradoraDropdown; }
  set showAseguradoraDropdown(v: boolean) { this.sel.showAseguradoraDropdown = v; }
  get pacienteExistenteCargado() { return this.pac.pacienteExistenteCargado; }
  set pacienteExistenteCargado(v: boolean) { this.pac.pacienteExistenteCargado = v; }
  get esRegistroDirecto() { return this.pac.esRegistroDirecto; }
  set esRegistroDirecto(v: boolean) { this.pac.esRegistroDirecto = v; }
  get acAseguradora() { return this.sel.acAseguradora; }
  get acEspecialidad() { return this.sel.acEspecialidad; }
  get acMedico() { return this.sel.acMedico; }
  get aseguradoraFiltro() { return this.sel.aseguradoraFiltro; }
  set aseguradoraFiltro(v: string) { this.sel.aseguradoraFiltro = v; }
  get especialidadFiltro() { return this.sel.especialidadFiltro; }
  set especialidadFiltro(v: string) { this.sel.especialidadFiltro = v; }
  get medicoFiltro() { return this.sel.medicoFiltro; }
  set medicoFiltro(v: string) { this.sel.medicoFiltro = v; }
  get aseguradoraIndex() { return this.sel.aseguradoraIndex; }
  set aseguradoraIndex(v: number) { this.sel.aseguradoraIndex = v; }
  get especialidadIndex() { return this.sel.especialidadIndex; }
  set especialidadIndex(v: number) { this.sel.especialidadIndex = v; }
  get medicoIndex() { return this.sel.medicoIndex; }
  set medicoIndex(v: number) { this.sel.medicoIndex = v; }
  get aseguradorasFiltradas() { return this.sel.aseguradorasFiltradas; }
  get especialidadesFiltradas() { return this.sel.especialidadesFiltradas; }
  get medicosConFiltro() { return this.sel.medicosConFiltro; }
  get showPreviewModal() { return this.asegs.showPreviewModal; }
  set showPreviewModal(v: boolean) { this.asegs.showPreviewModal = v; }
  get previewData() { return this.asegs.previewData; }
  get showExcelFormat() { return this.asegs.showExcelFormat; }
  set showExcelFormat(v: boolean) { this.asegs.showExcelFormat = v; }
  get isImporting() { return this.asegs.isImporting; }
  get fillersVacios() { return Array(this.pageSize).fill(0); }
  get medicosFiltrados() { return this.sel.getMedicosFiltrados(); }

  get admisionesFiltradas() {
    if (this.isAseguradorasView) {
      const q = (this.cedulaBusqueda || '').trim().toLowerCase();
      return this.aseguradoras.filter((a: any) => { if (!q) return true; const m = (a.aseguradora || '').toLowerCase().includes(q); return this.searchFilter === 'nombre' ? m : m || (a.tipo || '').toLowerCase().includes(q); });
    }
    return this.ultimasAdmisiones.filter((a: any) => {
      const q = (this.cedulaBusqueda || '').trim().toLowerCase();
      if (!q) return true;
      const mN = (a.nombre || '').toLowerCase().includes(q), mA = (a.apellido || '').toLowerCase().includes(q), mC = (a.cedula || '').toLowerCase().includes(q);
      return this.searchFilter === 'nombre' ? mN : this.searchFilter === 'apellido' ? mA : this.searchFilter === 'cedula' ? mC : mN || mA || mC;
    });
  }

  tienePermiso(p: string) { return this.auth.tienePermiso(p); }
  esCoordinador() { return this.auth.esCoordinador(); }
  getSedeNombre(id: any) { return this.sel.getSedeNombre(id); }
  getNombreAseguradoraSeleccionada(id: any) { return this.sel.getNombreAseguradoraSeleccionada(id); }
  getNombreResponsable(id: any) { return this.sel.getNombreResponsable(id); }
  getAseguradoraNombre(a: any) { return this.sel.getAseguradoraNombre(a); }
  getResponsableLabel(v: any) { return this.sel.getResponsableLabel(v); }
  getResponsableClass(v: any) { return this.sel.getResponsableClass(v); }
  getServicioCategoria(v: any) { return this.sel.getServicioCategoria(v); }
  getNombreMedicoLabel(id: any) { return this.sel.getNombreMedicoLabel(id); }
  getMedicoConsultorio() { return this.sel.getMedicoConsultorio(); }
  getNombreServicioLabel(id: any) { return this.sel.getNombreServicioLabel(id); }
  getEspecialidades() { return this.sel.getEspecialidades(); }
  getDocPlaceholder() { return this.pac.getDocPlaceholder(); }
  getDocTypeLabel() { return this.pac.getDocTypeLabel(); }
  getSearchFilterLabel() { return ({ todo: 'TODO', nombre: 'NOMBRES', apellido: 'APELLIDOS', cedula: 'Nº DOC' } as Record<string, string>)[this.searchFilter] || 'TODO'; }
  soloLetras(e: any) { this.pac.soloLetras(e); }
  trimCampo(e: Event) { this.pac.trimCampo(e); }
  soloNumeros(e: any) { this.pac.soloNumeros(e); }
  onDocKeyPress(e: any) { this.pac.onDocKeyPress(e, this.nuevoPaciente.tipo_documento); }
  onDocTypeChange() { this.pac.onDocTypeChange(); }
  onFechaNacimientoInput(event: Event) { const i = event.target as HTMLInputElement; const r = aplicarCambioFecha(this.nuevoPaciente.fecha_nacimiento || '', i.value, i.selectionStart || 0); this.nuevoPaciente.fecha_nacimiento = r.valor; i.value = r.valor; i.setSelectionRange(r.cursor, r.cursor); }

  ngOnInit() {
    const d = this.route.snapshot.data;
    this.pageTitle = d['pageTitle'] || this.pageTitle; this.pageSubtitle = d['pageSubtitle'] || this.pageSubtitle;
    this.isAseguradorasView = !!d['aseguradorasMode'];
    this.sel.cargarDatosMaestros(() => this.cargarAseguradoras());
    if (this.isAseguradorasView) { this.cargarAseguradoras(); } else { this.cargarUltimasAdmisiones(); }
    this.cambiosSub = this.api.cambios$.subscribe((ev: any) => {
      if (this.isAseguradorasView) { this.cargarAseguradoras(); return; }
      if (ev?.admision) {
        if (ev.tipo === 'retirado') { this.atencion.ultimasAdmisiones = this.atencion.ultimasAdmisiones.filter((a: any) => a.id_atencion !== ev.admision.id_atencion); }
        else if (ev.tipo === 'estado-cambiado') { if ([6, 9].includes(Number(ev.id_estado_nuevo))) { this.atencion.ultimasAdmisiones = this.atencion.ultimasAdmisiones.filter((a: any) => a.id_atencion !== ev.admision.id_atencion); } else if (Number(ev.id_estado_nuevo) === 3) { this.atencion.ultimasAdmisiones = [ev.admision, ...this.atencion.ultimasAdmisiones].slice(0, 50); } }
      } else if (ev.tipo === 'retirado' || ev.tipo === 'liberacion') {
        const id = Number(ev.id_atencion); if (!isNaN(id)) { this.atencion.ultimasAdmisiones = this.atencion.ultimasAdmisiones.filter((a: any) => a.id_atencion !== id); } else { this.cargarUltimasAdmisiones(); }
      } else if (ev.tipo === 'estado-cambiado') {
        if ([6, 9].includes(Number(ev.id_estado_nuevo))) { const id = Number(ev.id_atencion); if (!isNaN(id)) { this.atencion.ultimasAdmisiones = this.atencion.ultimasAdmisiones.filter((a: any) => a.id_atencion !== id); } else { this.cargarUltimasAdmisiones(); } }
      } else { this.cargarUltimasAdmisiones(); }
    });
    this.searchSubscription = this.searchSubject.pipe(debounceTime(80)).subscribe(v => {
      if (!v || v.trim().length < 1) { this.resetSearchOnly(); } else { this.ejecutarBusqueda(v); }
    });
  }

  ngOnDestroy() { this.cambiosSub?.unsubscribe(); this.searchSubscription?.unsubscribe(); this.busquedaSubscription?.unsubscribe(); }
  onTabChange(tab: string) { if (tab === 'dashboard') this.router.navigate(['/administrador']); if (tab === 'panel-medico') this.router.navigate(['/panel-medico']); }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) { this.showSearchFilterDropdown = false; this.showPayerDropdown = false; this.showServiceDropdown = false; this.showEspecialidadDropdown = false; this.showAseguradoraDropdown = false; this.mostrarResultadosBusqueda = false; }
    else { const t = event.target as HTMLElement; if (!t.closest('.search-filter-container')) this.showSearchFilterDropdown = false; if (!t.closest('.doc-type-container')) this.showDocTypeDropdown = false; if (!t.closest('.payer-dropdown-container')) this.showPayerDropdown = false; if (!t.closest('.service-dropdown-container')) this.showServiceDropdown = false; if (!t.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false; if (!t.closest('.medico-dropdown-container')) this.showMedicoDropdown = false; if (!t.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false; }
  }

  toggleSearchFilterDropdown() { this.showSearchFilterDropdown = !this.showSearchFilterDropdown; }
  selectSearchFilter(f: string) { this.searchFilter = f; this.showSearchFilterDropdown = false; if (this.cedulaBusqueda.trim()) this.onSearchChange(this.cedulaBusqueda); }
  toggleDocTypeDropdown() { this.showDocTypeDropdown = !this.showDocTypeDropdown; }
  selectDocType(t: string) { this.pac.seleccionarDocType(t); this.showDocTypeDropdown = false; }
  cargarUltimasAdmisiones() { this.cargando = true; this.atencion.cargarUltimasAdmisiones(() => this.cargando = false); }
  cargarAseguradoras() { this.cargando = true; this.asegs.cargarAseguradoras(this.cdr, () => this.cargando = false); this.sel.setAseguradorasRef(this.asegs.aseguradoras); }
  abrirModalRegistro(trigger?: EventTarget | null) { if (!this.isEditMode) this.pac.prepararNuevoPaciente(this.isAseguradorasView, this.cedulaBusqueda, this.searchFilter); this.modalTrigger = trigger instanceof HTMLElement ? trigger : null; this.mostrarRegistro = true; }
  cerrarModalRegistro() { this.mostrarRegistro = false; this.modalTrigger = null; this.isEditMode = false; this.showDocTypeDropdown = false; }
  onSearchChange(value: string) { if (!value || value.trim().length < 1) { this.resetSearchOnly(); } else { this.searchSubject.next(value); } }
  ejecutarBusqueda(value: string) { this.busquedaSubscription?.unsubscribe(); this.buscando = true; this.pacientesEncontrados = []; const f = this.searchFilter !== 'todo' ? `?filtro=${this.searchFilter}` : ''; this.busquedaSubscription = this.api.get<any[]>(`recepcion/pacientes/${value}${f}`).subscribe({ next: (d) => { if (!this.cedulaBusqueda?.trim()) return; this.pacientesEncontrados = d || []; this.mostrarResultadosBusqueda = !!(d && d.length); this.buscando = false; }, error: () => { this.buscando = false; this.pacientesEncontrados = []; this.mostrarResultadosBusqueda = false; } }); }
  resetSearchOnly() { this.busquedaSubscription?.unsubscribe(); this.busquedaSubscription = undefined; this.pacientesEncontrados = []; this.buscando = false; this.mostrarResultadosBusqueda = false; }
  onSearchFocus() { if (this.pacientesEncontrados.length > 0) this.mostrarResultadosBusqueda = true; }
  onSearchBlur() { setTimeout(() => { this.mostrarResultadosBusqueda = false; }, 200); }
  seleccionarPaciente(p: any) { this.mostrarResultadosBusqueda = false; this.pac.seleccionarPaciente(p, () => this.abrirModalRegistro()); }
  onCedulaFormChange(c: string) { this.pac.onCedulaFormChange(c, this.isEditMode); }

  private finalizarGuardado(accion?: () => void) { setTimeout(() => { accion?.(); this.isSaving = false; }, Math.max(0, this.MIN_GUARDADO - (Date.now() - this.inicioGuardado))); }

  registrarYContinuar() {
    if (this.isAseguradorasView) { this.asegs.procesarAseguradora(this.nuevoPaciente, this.isEditMode, this, () => { this.cargarAseguradoras(); this.sel.setAseguradorasRef(this.asegs.aseguradoras); }, (fn?) => this.finalizarGuardado(fn)); return; }
    const f = (this.nuevoPaciente.fecha_nacimiento || '').trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(f)) { this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)'); return; }
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) { this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio'); return; }
    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) { this.swal.warning('Debe seleccionar el nombre de la aseguradora'); return; }
    const dl = (this.nuevoPaciente.cedula || '').length;
    if (this.nuevoPaciente.tipo_documento === 'p' ? dl < 10 : dl < 7) { this.swal.warning(this.nuevoPaciente.tipo_documento === 'p' ? 'El pasaporte debe tener entre 10 y 12 caracteres' : 'La cedula debe tener entre 7 y 8 digitos'); return; }
    const tel = (this.nuevoPaciente.telefono || '').replace(/\D/g, '');
    if (tel.length > 0 && tel.length < 11) { this.swal.warning('El telefono debe tener entre 11 y 12 digitos'); return; }
    this.isSaving = true; this.inicioGuardado = Date.now();
    if (this.isEditMode) { this.atencion.actualizarPacienteExistente(this.nuevoPaciente.id_paciente!, true, this.nuevoPaciente, this, fn => this.finalizarGuardado(fn), () => this.cargarUltimasAdmisiones()); }
    else if (this.pacienteExistenteCargado && this.nuevoPaciente.id_paciente) { this.atencion.generarAtencionDirecta(this.nuevoPaciente.id_paciente, this, fn => this.finalizarGuardado(fn), () => this.cargarUltimasAdmisiones()); }
    else { this.api.get<any[]>(`recepcion/pacientes/${this.nuevoPaciente.cedula}`).subscribe({ next: (d) => { const p = d?.find((x: any) => x.cedula === this.nuevoPaciente.cedula && x.tipo_documento === this.nuevoPaciente.tipo_documento); if (p) { this.atencion.actualizarPacienteExistente(p.id_paciente || p.id, false, this.nuevoPaciente, this, fn => this.finalizarGuardado(fn), () => this.cargarUltimasAdmisiones()); } else { this.crearNuevoPaciente(); } }, error: () => this.crearNuevoPaciente() }); }
  }

  private crearNuevoPaciente() {
    const p = this.nuevoPaciente; const esN = p.tipo_documento !== 'p';
    import('./recepcion-fechas.util').then(({ fechaABackend }) => {
      this.api.post('recepcion/pacientes', { cedula: esN ? p.cedula.replace(/\D/g, '') : p.cedula.trim().toUpperCase(), tipo_documento: p.tipo_documento || 'v', primer_nombre: p.primer_nombre.toUpperCase().trim(), segundo_nombre: p.segundo_nombre.toUpperCase().trim(), primer_apellido: p.primer_apellido.toUpperCase().trim(), segundo_apellido: p.segundo_apellido.toUpperCase().trim(), fecha_nacimiento: fechaABackend(p.fecha_nacimiento), telefono: p.telefono.replace(/\D/g, ''), status: true }).subscribe({
        next: (pac: any) => this.atencion.generarAtencionDirecta(pac.id_paciente || pac.id, this, fn => this.finalizarGuardado(fn), () => this.cargarUltimasAdmisiones()),
        error: (e: any) => { console.error('Error registrando:', e); this.finalizarGuardado(() => { if (e.status === 409) { this.swal.error('El paciente con esta cedula ya esta registrado en esta sede.'); } else { this.swal.error('Error al registrar paciente'); } }); },
      });
    });
  }

  togglePayerDropdown() { this.showPayerDropdown = !this.showPayerDropdown; }
  selectPayer(id: number) { this.sel.selectPayer(id); }
  toggleAseguradoraDropdown() { this.showAseguradoraDropdown = !this.showAseguradoraDropdown; }
  selectAseguradora(id: number) { this.sel.selectAseguradora(id); }
  toggleServiceDropdown() { this.showServiceDropdown = !this.showServiceDropdown; }
  selectCategoria(c: string) { this.sel.selectCategoria(c); }
  toggleEspecialidadDropdown() { this.showEspecialidadDropdown = !this.showEspecialidadDropdown; }
  selectEspecialidad(item: any) { this.sel.selectEspecialidad(item); }
  toggleMedicoDropdown() { this.showMedicoDropdown = !this.showMedicoDropdown; }
  selectMedico(m: any) { this.sel.selectMedico(m); }
  onAseguradoraInput(e: Event) { this.ac.onInput(this.acAseguradora, (e.target as HTMLInputElement).value); this.showAseguradoraDropdown = this.acAseguradora.showDropdown; }
  onAseguradoraKeydown(e: KeyboardEvent) { const items: AutocompleteItem[] = this.aseguradorasFiltradas.map(a => ({ label: a.aseguradora, id: a.id_cliente })); this.ac.onKeydown(this.acAseguradora, e, items, i => this.selectAseguradora(i.id as number)); this.showAseguradoraDropdown = this.acAseguradora.showDropdown; }
  onEspecialidadInput(e: Event) { this.ac.onInput(this.acEspecialidad, (e.target as HTMLInputElement).value); this.showEspecialidadDropdown = this.acEspecialidad.showDropdown; }
  onEspecialidadKeydown(e: KeyboardEvent) { const items: AutocompleteItem[] = this.especialidadesFiltradas.map(s => ({ label: s.nombre || s.nombre_servicio, id: s.id_especialidad || s.id })); this.ac.onKeydown(this.acEspecialidad, e, items, i => this.selectEspecialidad({ id_especialidad: i.id, nombre: i.label })); this.showEspecialidadDropdown = this.acEspecialidad.showDropdown; }
  onMedicoInput(e: Event) { this.ac.onInput(this.acMedico, (e.target as HTMLInputElement).value); this.showMedicoDropdown = this.acMedico.showDropdown; }
  onMedicoKeydown(e: KeyboardEvent) { const items: AutocompleteItem[] = this.medicosConFiltro.map(m => ({ label: ((m.nombre || '') + ' ' + (m.apellido || '')).trim(), id: m.id_usuario || m.id })); this.ac.onKeydown(this.acMedico, e, items, i => this.selectMedico({ id_usuario: i.id, nombre: i.label.split(' ')[0], apellido: i.label.split(' ').slice(1).join(' ') })); this.showMedicoDropdown = this.acMedico.showDropdown; }

  editarFila(fila: any, trigger?: EventTarget | null) {
    this.filaEnEdicion = fila; this.isEditMode = true;
    if (this.isAseguradorasView) { this.isSaving = false; this.abrirModalRegistro(trigger); this.pacienteExistenteCargado = false; this.nuevoPaciente.id_cliente = fila.id_cliente; (this.nuevoPaciente as any).nombre = fila.aseguradora; }
    else { this.pacienteExistenteCargado = true; this.abrirModalRegistro(trigger); this.pac.editarPaciente(fila); }
  }
  async eliminarFila(fila: any) { if (this.isAseguradorasView) { this.asegs.eliminarAseguradora(fila, () => { this.cargarAseguradoras(); this.sel.setAseguradorasRef(this.asegs.aseguradoras); }); } else { this.atencion.eliminarAdmision(fila, () => this.cargarUltimasAdmisiones()); } }
  async marcarAusente(fila: any) { this.atencion.marcarAusente(fila, () => this.cargarUltimasAdmisiones()); }
  confirmarImportacion() { this.asegs.confirmarImportacion(this, () => { this.cargarAseguradoras(); this.sel.setAseguradorasRef(this.asegs.aseguradoras); }); }
  importarAseguradorasExcel(fileInput: HTMLInputElement) { this.asegs.importarAseguradorasExcel(fileInput); }
}
