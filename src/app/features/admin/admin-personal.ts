import { Component, inject, OnInit, HostListener, DestroyRef, ElementRef, ChangeDetectorRef, NgZone, ViewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { ServicioDTO, EspecialidadDTO, ConsultorioDTO, PersonalDTO, SedeDTO, RolDTO } from '@core/models/dto.models';
import {
  LucideAngularModule,
  LayoutDashboard,
  BarChart3,
  Settings,
  Users,
  XCircle,
  Clock,
  Activity,
  Download,
  LogOut,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  DoorOpen,
  UserCog,
  Search,
  Edit2,
  Eye,
  EyeOff,
  Menu,
  MapPin,
  Layers,
  CheckCircle2,
  Check,
  LayoutGrid,
  ShieldCheck,
  Calendar,
  Sun,
  Moon,
  Upload,
  Info,
  ClipboardList,
  Building2,
} from 'lucide-angular';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';


@Component({
  selector: 'app-admin-personal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './admin-personal.html',
  styles: [],
})
/**
 * Panel de administración del personal de la clínica.
 * Permite CRUD de usuarios, filtrado por rol/sede, e importación masiva desde Excel.
 */
export class AdminPersonal implements OnInit {
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Stethoscope = Stethoscope;
  readonly DoorOpen = DoorOpen;
  readonly UserCog = UserCog;
  readonly Search = Search;
  readonly Edit2 = Edit2;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Menu = Menu;
  readonly MapPin = MapPin;
  readonly Layers = Layers;
  readonly CheckCircle2 = CheckCircle2;
  readonly Check = Check;
  readonly LayoutGrid = LayoutGrid;
  readonly ShieldCheck = ShieldCheck;
  readonly Calendar = Calendar;
  readonly XCircle = XCircle;
  readonly Download = Download;
  readonly Clock = Clock;
  readonly Users = Users;
  readonly Activity = Activity;
  readonly LayoutDashboard = LayoutDashboard;
  readonly BarChart3 = BarChart3;
  readonly Settings = Settings;
  readonly LogOut = LogOut;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly ClipboardList = ClipboardList;
  readonly Building2 = Building2;
  readonly Upload = Upload;
  readonly Info = Info;

  private auth = inject(AuthService);
  private apiService = inject(ApiService);
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private cdr = inject(ChangeDetectorRef);
  private zone = inject(NgZone);

  pageSize = 9;
  currentPage = 1;
  cargando: boolean = true;

  servicios: ServicioDTO[] = [];
  especialidades: EspecialidadDTO[] = [];
  consultorios: ConsultorioDTO[] = [];
  sedes: SedeDTO[] = [];
  rolesLista: RolDTO[] = [];
  todoPersonal: PersonalDTO[] = [];

  searchQuery = '';
  searchFilter = 'todo';

  showRolDropdown = false;
  showMedicoEspDropdown = false;
  showSedeDropdown = false;
  showSearchFilterDropdown = false;
  /** Modal "Asignar consultorios" (consultorio de CADA especialidad del médico). */
  showEspConModal = false;
  /** Botón "Listo" del modal de consultorios mostrando "guardando...". */
  guardandoEspCon = false;

  /** Especialidades seleccionadas del médico (la primera es la principal). */
  especialidadesSel: number[] = [];
  /** Especialidades del médico que están INACTIVAS (no puede entrar con ellas). */
  especialidadesInactivas: number[] = [];
  /** Consultorio de CADA especialidad del médico: { [idEspecialidad]: idConsultorio }. */
  especialidadesConsultorios: Record<number, number | null> = {};

  // ---- Autocomplete de los selects del modal (escribir para filtrar) ----
  rolFiltro: string = '';
  espFiltro: string = '';
  rolIndex: number = -1;
  espIndex: number = -1;

  get rolesConFiltro(): RolDTO[] {
    const q = (this.rolFiltro || '').trim().toLowerCase();
    return this.rolesPorSede.filter(r => !q || (r.nombre || '').toLowerCase().includes(q) || (r.key || '').toLowerCase().includes(q));
  }

  /**
   * Texto visible del select de roles: las seleccionadas separadas
   * por comas (ej: "medico, administrador"). Mientras el dropdown está
   * abierto solo se muestra lo que se escribe para filtrar; al cerrarse
   * vuelven a verse las comas.
   */
  get rolDisplay(): string {
    if (this.showRolDropdown) {
      // Mientras el dropdown está abierto, mostrar lo que se escribe para filtrar
      return this.rolFiltro || '';
    }
    // Al cerrar el dropdown, mostrar los roles seleccionados por comas
    return this.formPersonal.roles
      .map(r => this.getRolLabel(r))
      .filter(Boolean)
      .join(', ');
  }

  get especialidadesConFiltro(): EspecialidadDTO[] {
    const q = (this.espFiltro || '').trim().toLowerCase();
    return this.especialidades.filter(e => !q || (e.nombre || '').toLowerCase().includes(q));
  }

  /**
   * Texto visible del select de especialidades: las seleccionadas separadas
   * por comas (ej: "cardiologia, alergologia"). Mientras el dropdown está
   * abierto solo se muestra lo que se escribe para filtrar; al cerrarse
   * (o al editar a un médico) vuelven a verse las comas.
   */
  get espDisplay(): string {
    if ((this.espFiltro || '').trim()) return this.espFiltro;
    if (this.showMedicoEspDropdown) return '';
    return this.especialidadesSel
      .map(id => {
        const nombre = this.especialidades.find(e => e.id === Number(id))?.nombre;
        return nombre ? nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase() : null;
      })
      .filter(Boolean)
      .join(', ');
  }

  /** Consultorios que pueden asignarse a UNA especialidad (los suyos, o todos si no tiene). */
  consultoriosDeEsp(esp: EspecialidadDTO): ConsultorioDTO[] {
    const ids = esp.consultorios_ids;
    if (!ids || ids.length === 0) return this.consultorios;
    return this.consultorios.filter(c => ids.includes(c.id));
  }

  // ---- Dropdowns de consultorio por especialidad (mini-modal) ----
  /** Dropdown abierto por especialidad: { [idEspecialidad]: boolean }. */
  espConDropdownAbiertos: Record<number, boolean> = {};
  /** Texto de filtro escrito en el consultorio de cada especialidad. */
  espConFiltros: Record<number, string> = {};

  espConId(esp: EspecialidadDTO): number {
    return Number(esp.id ?? esp.id_especialidad);
  }

  /** Valor actual del consultorio asignado a una especialidad. */
  espConValor(esp: EspecialidadDTO): number | null {
    const id = this.espConId(esp);
    const v = this.especialidadesConsultorios[id];
    return v == null ? null : v;
  }

  /** Nombre del consultorio asignado a una especialidad. */
  espConNombre(esp: EspecialidadDTO): string {
    const v = this.espConValor(esp);
    if (v == null) return '';
    const con = this.consultorios.find(c => c.id === Number(v));
    return con ? con.nombre : '';
  }

  /** Texto visible del input: lo que se escribe para filtrar, o el consultorio elegido. */
  espConDisplay(esp: EspecialidadDTO): string {
    const filtro = this.espConFiltros[this.espConId(esp)];
    if (filtro) return filtro;
    return this.espConNombre(esp);
  }

  /** Consultorios de la especialidad filtrados por el texto escrito. */
  espConFiltrados(esp: EspecialidadDTO): ConsultorioDTO[] {
    const q = (this.espConFiltros[this.espConId(esp)] || '').trim().toLowerCase();
    return this.consultoriosDeEsp(esp).filter(c => !q || (c.nombre || '').toLowerCase().includes(q));
  }

  onEspConInput(esp: EspecialidadDTO, event: Event) {
    this.espConFiltros[this.espConId(esp)] = (event.target as HTMLInputElement).value;
    this.espConDropdownAbiertos[this.espConId(esp)] = true;
  }

  /** Abre/cierra el dropdown de consultorio de una especialidad. */
  toggleEspConDropdown(esp: EspecialidadDTO) {
    const id = this.espConId(esp);
    this.espConDropdownAbiertos[id] = !this.espConDropdownAbiertos[id];
  }

  /** Selecciona el consultorio de una especialidad y cierra su dropdown. */
  selectEspConsultorio(esp: EspecialidadDTO, con: ConsultorioDTO) {
    const id = this.espConId(esp);
    this.especialidadesConsultorios[id] = con.id ?? null;
    this.espConDropdownAbiertos[id] = false;
    this.espConFiltros[id] = '';
  }

  /** Cierra el dropdown de una especialidad y limpia su filtro. */
  cerrarEspConDropdown(esp: EspecialidadDTO) {
    const id = this.espConId(esp);
    this.espConDropdownAbiertos[id] = false;
    this.espConFiltros[id] = '';
  }

  /** Especialidades seleccionadas con sus datos (para el modal de consultorios). */
  get especialidadesSeleccionadas(): EspecialidadDTO[] {
    return this.especialidades.filter((e) => {
      const id = Number(e.id ?? e.id_especialidad);
      return this.especialidadesSel.includes(id);
    });
  }

  abrirEspConModal() {
    this.showEspConModal = true;
    this.showMedicoEspDropdown = false;
    this.espConDropdownAbiertos = {};
    this.espConFiltros = {};
  }

  cerrarEspConModal() {
    this.showEspConModal = false;
    this.espConDropdownAbiertos = {};
    this.espConFiltros = {};
    this.guardandoEspCon = false;
  }

  /**
   * Botón "Listo": muestra "guardando..." (igual que el botón GUARDAR)
   * durante un momento y luego cierra el modal. Los consultorios ya quedaron
   * guardados en memoria; el cierre con animación es solo feedback visual.
   */
  finalizarEspConModal() {
    if (this.guardandoEspCon) return;
    this.guardandoEspCon = true;
    setTimeout(() => {
      this.cerrarEspConModal();
    }, 800);
  }

  onRolInput(event: Event) {
    this.rolFiltro = (event.target as HTMLInputElement).value;
    this.showRolDropdown = true;
    this.rolIndex = -1;
  }

  onRolKeydown(event: KeyboardEvent) {
    const list = this.rolesConFiltro;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showRolDropdown = true;
      if (list.length) this.rolIndex = (this.rolIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.rolIndex = (this.rolIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showRolDropdown && list[this.rolIndex]) {
        this.selectRol(list[this.rolIndex].key);
      }
    } else if (event.key === 'Escape') {
      this.showRolDropdown = false;
    }
  }

  onEspInput(event: Event) {
    this.espFiltro = (event.target as HTMLInputElement).value;
    this.showMedicoEspDropdown = true;
    this.espIndex = -1;
  }

  onEspKeydown(event: KeyboardEvent) {
    const list = this.especialidadesConFiltro;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showMedicoEspDropdown = true;
      if (list.length) this.espIndex = (this.espIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.espIndex = (this.espIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showMedicoEspDropdown && list[this.espIndex]) {
        this.toggleMedicoEsp(list[this.espIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showMedicoEspDropdown = false;
    }
  }

  showModalPersonal = false;
  private modalTrigger: HTMLElement | null = null;

  isEditing = false;
  editingId: number | null = null;
  isSaving = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;
  showPassword = false;

  showPreviewModal = false;
  previewData: any[] = [];

  showExcelFormat = false;
  isImporting = false;

  formPersonal: {
    rol: string;
    roles: string[];
    username: string;
    password: string;
    primer_nombre: string;
    segundo_nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    cedula: string;
    telefono: string;
    email: string;
    activo: boolean;
    servicio_id: string | number;
    especialidad_id: string | number;
    consultorio_id: string | number;
    id_sede: string | number;
  } = {
    rol: '',
    roles: [],
    username: '',
    password: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    cedula: '',
    telefono: '',
    email: '',
    activo: true,
    servicio_id: '',
    especialidad_id: '',
    consultorio_id: '',
    id_sede: '',
  };

  /** Inicializa cargando sedes, servicios, especialidades, consultorios y personal. */
  ngOnInit() {
    this.cargarSedes();
    this.cargarServicios();
    this.cargarEspecialidades();
    this.cargarConsultorios();
    this.cargarPersonal();
  }

  cargarSedes() {
    this.apiService.getSedes().subscribe({
      next: (s) => { this.sedes = s.sort((a, b) => Number(a.id_sede) - Number(b.id_sede)); },
      error: () => {},
    });
  }

  cargarServicios() {
    this.apiService.getServicios().subscribe((svs) => { this.servicios = svs; });
  }

  cargarEspecialidades() {
    this.apiService.getEspecialidades().subscribe((esps) => { this.especialidades = esps; });
  }

  cargarConsultorios() {
    this.apiService.getConsultorios().subscribe((cons) => {
      this.consultorios = cons.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
    });
  }

  cargarPersonal() {
    this.cargando = true;
    this.apiService.getRoles().subscribe((roles) => {
      this.rolesLista = roles.filter(r => r.activo);
    });
    this.apiService.getPersonal().subscribe((pers) => {
      this.todoPersonal = pers.map((p) => ({
        ...p,
        id: p.id || p.id_usuario,
        activo: p.activo !== undefined ? p.activo : p.status,
      }));
      this.cargando = false;
    });
  }

  openModalPersonal(user?: PersonalDTO | null, trigger?: EventTarget | null) {
    this.showPassword = false;
    this.isEditing = !!user;
    this.editingId = user?.id || user?.id_usuario || null;
    // Cerrar los dropdowns de los autocompletes y el mini-modal de consultorios:
    // al abrir el modal las especialidades seleccionadas deben verse como texto
    // (ej: "cardiologia, alergologia") y no con el dropdown abierto.
    this.showMedicoEspDropdown = false;
    this.showRolDropdown = false;
    this.showEspConModal = false;
    if (user) {
      const rolesUsuario: string[] = [];
      if (Array.isArray((user as any).roles) && (user as any).roles.length) {
        rolesUsuario.push(...(user as any).roles.map((r: any) => r.key || r));
      } else if (user.rol) {
        rolesUsuario.push(user.rol);
      }

      this.formPersonal = {
        rol: user.rol || 'medico',
        roles: rolesUsuario,
        username: user.username || user.cedula || '',
        password: '',
        primer_nombre: (user.primer_nombre || user.nombre || '').toUpperCase(),
        segundo_nombre: (user.segundo_nombre || '').toUpperCase(),
        primer_apellido: (user.primer_apellido || user.apellido || '').toUpperCase(),
        segundo_apellido: (user.segundo_apellido || '').toUpperCase(),
        cedula: user.cedula || '',
        telefono: user.telefono || '',
        email: user.email || '',
        activo: !!user.activo,
        servicio_id: user.id_servicio || '',
        especialidad_id: user.id_especialidad || '',
        consultorio_id: user.id_consultorio || '',
        id_sede: user.id_sede || '',
      };
    } else {
      this.formPersonal = {
        rol: '',
        roles: [],
        username: '',
        password: '',
        primer_nombre: '',
        segundo_nombre: '',
        primer_apellido: '',
        segundo_apellido: '',
        cedula: '',
        telefono: '',
        email: '',
        activo: true,
        servicio_id: '',
        especialidad_id: '',
        consultorio_id: '',
        id_sede: '',
      };
    }

    // Especialidades múltiples: se precargan desde el backend (especialidades)
    // o, si no vienen, desde la principal (id_especialidad).
    const espIds = user
      ? (Array.isArray((user as any).especialidades) && (user as any).especialidades.length
          ? (user as any).especialidades.map(Number)
          : (user.id_especialidad ? [Number(user.id_especialidad)] : []))
      : [];
    this.especialidadesSel = espIds;
    this.especialidadesInactivas = user
      ? (Array.isArray((user as any).especialidades_inactivas)
          ? (user as any).especialidades_inactivas.map(Number)
          : [])
      : [];
    // Consultorio POR especialidad (viene del backend como { idEsp: idConsultorio })
    this.especialidadesConsultorios = {};
    const consMap = (user as any)?.especialidades_consultorios;
    if (consMap && typeof consMap === 'object' && !Array.isArray(consMap)) {
      for (const [k, v] of Object.entries(consMap)) {
        if (v != null) this.especialidadesConsultorios[Number(k)] = Number(v);
      }
    }
    if (espIds.length && !this.formPersonal.especialidad_id) {
      this.formPersonal.especialidad_id = espIds[0];
    }

    // Prefill de los autocompletes según los valores cargados
    // (la especialidad ahora es multi-selección: se ven separadas por comas)
    this.espFiltro = '';
    this.rolFiltro = ''; // El getter rolDisplay muestra los roles seleccionados

    this.abrirModalPersonal(trigger);
  }

  abrirModalPersonal(trigger?: EventTarget | null) {
    this.modalTrigger = trigger instanceof HTMLElement ? trigger : null;
    this.showModalPersonal = true;
  }

  cerrarModalPersonal() {
    this.showModalPersonal = false;
    this.modalTrigger = null;
    this.isEditing = false;
    this.showPassword = false;
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => {
      if (accion) accion();
      this.isSaving = false;
    }, restante);
  }

  guardarPersonal() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.inicioGuardado = Date.now();
    const rol = this.formPersonal.rol;
    const cedulaFinal = (this.formPersonal.cedula || this.formPersonal.username || '')
      .toString().replace(/\D/g, '');

    const usuarioOriginal = this.isEditing && this.editingId !== null
      ? this.todoPersonal.find(p => (p.id || p.id_usuario) === this.editingId)
      : null;
    const sedeOriginal = usuarioOriginal?.id_sede;
    const activoOriginal = usuarioOriginal?.activo;
    const sedeNueva = this.formPersonal.id_sede ? Number(this.formPersonal.id_sede) : 1;
    const activoNuevo = !!this.formPersonal.activo;

    const body: Record<string, unknown> = {
      ...this.formPersonal,
      primer_nombre: (this.formPersonal.primer_nombre || '').toUpperCase().trim(),
      segundo_nombre: (this.formPersonal.segundo_nombre || '').toUpperCase().trim() || null,
      primer_apellido: (this.formPersonal.primer_apellido || '').toUpperCase().trim(),
      segundo_apellido: (this.formPersonal.segundo_apellido || '').toUpperCase().trim() || null,
      cedula: cedulaFinal,
      username: cedulaFinal,
      telefono: (this.formPersonal.telefono || '').toString().replace(/\D/g, ''),
      email: this.formPersonal.email ? this.formPersonal.email.toLowerCase().trim() : null,
      password: this.formPersonal.password ? this.formPersonal.password.replace(/\s/g, '') : null,
      id_sede: this.formPersonal.id_sede ? Number(this.formPersonal.id_sede) : 1,
      // El consultorio de Usuarios se mantiene sincronizado con el de la
      // especialidad PRINCIPAL (respaldo para módulos que aún lo leen).
      id_consultorio: rol === 'medico'
        ? (this.especialidadesConsultorios[Number(this.formPersonal.especialidad_id)]
            ? Number(this.especialidadesConsultorios[Number(this.formPersonal.especialidad_id)])
            : null) : null,
      id_servicio: rol === 'medico'
        ? (this.formPersonal.servicio_id ? Number(this.formPersonal.servicio_id) : null) : null,
      id_especialidad: rol === 'medico'
        ? (this.formPersonal.especialidad_id ? Number(this.formPersonal.especialidad_id) : null) : null,
      especialidades: rol === 'medico' ? this.especialidadesSel.map(Number) : [],
      especialidades_inactivas: rol === 'medico' ? this.especialidadesInactivas.map(Number) : [],
      // Consultorio de CADA especialidad: { idEsp: idConsultorio }
      especialidades_consultorios: rol === 'medico' ? this.especialidadesConsultorios : {},
      roles: this.formPersonal.roles.length > 0 ? this.formPersonal.roles : [rol],
      status: !!this.formPersonal.activo,
    };
    const call = this.isEditing && this.editingId !== null
      ? this.apiService.actualizarPersonal(this.editingId, body as Partial<PersonalDTO>)
      : this.apiService.crearPersonal(body as Partial<PersonalDTO>);
    call.subscribe({
      next: () => {
        const sedeCambio = this.isEditing && sedeOriginal !== undefined && Number(sedeOriginal) !== sedeNueva;
        const statusCambio = this.isEditing && activoOriginal !== undefined && activoOriginal && !activoNuevo;
        this.finalizarGuardado(() => {
          this.showModalPersonal = false;
          this.cargarPersonal();
          if (!sedeCambio && !statusCambio) {
            this.swal.success('Personal guardado correctamente');
          }
        });
      },
      error: (err) => {
        this.finalizarGuardado(() => {
          console.error('Error al guardar:', err);
          this.swal.error(err.error?.mensaje || 'Error al guardar personal');
        });
      },
    });
  }

  async eliminarPersonal(id: number) {
    const result = await this.swal.confirmDelete('¿Eliminar este usuario?');
    if (!result.isConfirmed) return;
    this.apiService.eliminarPersonal(id).subscribe({
      next: () => {
        this.cargarPersonal();
        this.swal.success('Personal eliminado correctamente');
      },
      error: () => {
        this.swal.error('Error al eliminar personal');
      },
    });
  }

  private normalize(str: string): string {
    return str.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }


  get personalFiltrados() {
    return this.todoPersonal.filter((p) => {
      const query = this.normalize(this.searchQuery || '');
      if (!query) return true;
      const matchNombre = this.normalize(((p.nombre || '') + ' ' + (p.segundo_nombre || '')).trim()).includes(query);
      const matchApellido = this.normalize(((p.apellido || '') + ' ' + (p.segundo_apellido || '')).trim()).includes(query);
      const matchCedula = (p.cedula || '').toLowerCase().includes(this.searchQuery.toLowerCase());
      const matchRol = this.normalize(this.getRolLabel(p.rol)).includes(query);
      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      if (this.searchFilter === 'rol') return matchRol;
      return matchNombre || matchApellido || matchCedula || matchRol;
    });
  }

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  toggleMedicoEspDropdown() {
    this.showMedicoEspDropdown = !this.showMedicoEspDropdown;
  }

  /**
   * Marca/desmarca una especialidad del médico (multi-selección). La primera
   * seleccionada es la PRINCIPAL (define servicio y consultorios sugeridos).
   * El listado queda abierto para seguir marcando más.
   */
  toggleMedicoEsp(esp: EspecialidadDTO) {
    const id = Number(esp.id ?? esp.id_especialidad);
    const idx = this.especialidadesSel.indexOf(id);
    const principalAnterior = this.especialidadesSel[0];
    if (idx >= 0) {
      this.especialidadesSel.splice(idx, 1);
      // Al desmarcar, también sale de la lista de inactivas y se descarta
      // su consultorio por especialidad
      const inaIdx = this.especialidadesInactivas.indexOf(id);
      if (inaIdx >= 0) this.especialidadesInactivas.splice(inaIdx, 1);
      delete this.especialidadesConsultorios[id];
    } else {
      this.especialidadesSel.push(id);
      // Nueva especialidad marcada: queda ACTIVA por defecto
      const inaIdx = this.especialidadesInactivas.indexOf(id);
      if (inaIdx >= 0) this.especialidadesInactivas.splice(inaIdx, 1);
    }
    const principal = this.especialidadesSel[0];
    this.formPersonal.especialidad_id = principal ?? '';
    if (principal !== principalAnterior) {
      // Cambió la principal: actualiza el servicio sugerido
      this.formPersonal.servicio_id = principal
        ? (esp.id_servicio ?? this.formPersonal.servicio_id)
        : '';
    }
    this.espIndex = -1;
    this.espFiltro = '';
  }

  esEspSel(esp: EspecialidadDTO): boolean {
    const id = Number(esp.id ?? esp.id_especialidad);
    return this.especialidadesSel.includes(id);
  }

  toggleSedeDropdown() {
    this.showSedeDropdown = !this.showSedeDropdown;
    this.showMedicoEspDropdown = false;
  }

  selectSede(id: number) {
    this.formPersonal.id_sede = id;
    this.showSedeDropdown = false;
  }

  toggleRolDropdown() {
    this.showRolDropdown = !this.showRolDropdown;
  }

  selectRol(rol: string) {
    // Toggle en el array de roles múltiples
    const idx = this.formPersonal.roles.indexOf(rol);
    if (idx >= 0) {
      this.formPersonal.roles.splice(idx, 1);
    } else {
      this.formPersonal.roles.push(rol);
    }
    // Mantener el rol principal sincronizado (el primero de la lista)
    this.formPersonal.rol = this.formPersonal.roles[0] || '';
    // Limpiar filtro para que el getter rolDisplay muestre los seleccionados
    this.rolFiltro = '';
  }

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(val: string) {
    this.searchFilter = val;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(val: string): string {
    const map: Record<string, string> = { todo: 'Todo', nombre: 'Nombres', apellido: 'Apellidos', cedula: 'Cédula', rol: 'Rol' };
    return map[val] || 'Filtrar';
  }

  getNombreEsp(id: string | number | undefined, forDropdown = false): string {
    const esp = this.especialidades.find((e) => e.id === id || e.id_especialidad == id);
    return esp ? esp.nombre : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getNombreServicio(id: string | number | undefined, forDropdown = false): string {
    const s = this.servicios.find((sv) => sv.id == id);
    return s ? s.nombre : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getNombreCon(id: number | string | null | undefined, forDropdown = false): string {
    if (id === null || id === undefined) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const con = this.consultorios.find((c) => c.id == id);
    return con ? con.nombre.toUpperCase() : forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  getConsultoriosEspLabel(ids: number[]): string {
    if (!ids || ids.length === 0) return 'SIN ASIGNAR';
    return ids.map(id => {
      const con = this.consultorios.find(c => c.id == id);
      return con ? con.nombre.toUpperCase() : `#${id}`;
    }).join(', ');
  }

  getSedeLabel(id: number | string | null | undefined, forDropdown = false): string {
    if (id === undefined || id === null || id === '') return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const finalId = Number(id);
    if (isNaN(finalId)) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    const sede = this.sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    if (!sede) return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
    return forDropdown ? this.toTitleCase(sede.nombre) : sede.nombre.toUpperCase();
  }

  getSedeNombre(id: number | string | null | undefined): string {
    if (id === undefined || id === null || id === '') return '';
    const finalId = Number(id);
    if (isNaN(finalId)) return '';
    const sede = this.sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    return sede ? sede.nombre : '';
  }

  getSedeIdByName(nombre: string): number | null {
    if (!nombre) return null;
    const normalized = nombre.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sede = this.sedes.find((s) => 
      (s.nombre || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
    );
    return sede ? Number(sede.id_sede || sede.id) : null;
  }

  toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  get rolesPorSede(): RolDTO[] {
    const sedeId = this.formPersonal.id_sede ? Number(this.formPersonal.id_sede) : null;
    if (!sedeId) return this.rolesLista;
    return this.rolesLista.filter(r => r.id_sede === sedeId);
  }

  getRolLabel(rol: string): string {
    const labels: { [key: string]: string } = { administrador: 'Administrador', medico: 'Medico', recepcionista: 'Recepcionista', laboratorio: 'Laboratorio', imagenes: 'Imagenes', coordinador: 'Coordinador', analista: 'Analista' };
    return labels[rol] || 'Seleccione...';
  }

  getRolBadgeClass(rol: string): string {
    const classes: { [key: string]: string } = {
      administrador: 'bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20',
      medico: 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
      recepcionista: 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
      laboratorio: 'bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-500/10 dark:text-orange-400 dark:border-orange-500/20',
      imagenes: 'bg-cyan-50 text-cyan-600 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20',
      
      coordinador: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
      analista: 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-500/10 dark:text-indigo-400 dark:border-indigo-500/20',
    };
    return classes[rol] || 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-500/10 dark:text-slate-400 dark:border-slate-500/20';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
    if (!target.closest('.medico-esp-container')) this.showMedicoEspDropdown = false;
    if (!target.closest('.rol-dropdown-container')) this.showRolDropdown = false;
    if (!target.closest('.sede-dropdown-container')) this.showSedeDropdown = false;
    if (!target.closest('.esp-con-dropdown')) {
      // Cerrar todos los dropdowns de consultorio del mini-modal
      this.espConDropdownAbiertos = {};
      this.espConFiltros = {};
    }
  }

  soloLetras(event: KeyboardEvent) {
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

  soloNumeros(event: KeyboardEvent) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault();
  }

  trimCampo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.trim();
    input.dispatchEvent(new Event('input'));
  }

  @ViewChild('excelInput') excelInputRef!: ElementRef<HTMLInputElement>;

  abrirSelectorExcel() {
    setTimeout(() => {
      const el = this.excelInputRef?.nativeElement;
      if (el) {
        el.value = '';
        el.click();
      }
    }, 50);
  }

  importExcel(fileInput: HTMLInputElement) {
    const file = fileInput?.files?.[0];
    if (!file) return;
    this.showExcelFormat = false;
    this.isImporting = true;

    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rowsRaw: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rowsRaw.length === 0) {
            this.zone.run(() => {
              this.isImporting = false;
              this.swal.error('El archivo Excel está vacío');
            });
            return;
          }

          const headerMap: Record<string, string[]> = {
            primer_nombre: ['primer nombre', 'primer_nombre', 'primernombre'],
            segundo_nombre: ['segundo nombre', 'segundo_nombre', 'segundonombre'],
            primer_apellido: ['primer apellido', 'primer_apellido', 'primerapellido'],
            segundo_apellido: ['segundo apellido', 'segundo_apellido', 'segundoapellido'],
            cedula: ['cedula', 'cédula', 'dni', 'identificación', 'documento'],
            rol: ['rol', 'cargo', 'puesto', 'rol usuario'],
            telefono: ['telefono', 'teléfono', 'tel', 'celular', 'contacto'],
            sede: ['sede', 'sucursalmacen', 'id_sede', 'sede id'],
            email: ['correo', 'email', 'e-mail', 'mail', 'correo electronico', 'correo electrónico']
          };

          const actualHeaders = Object.keys(rowsRaw[0]).map(h => 
            h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          );

          const normalizedRows: any[] = rowsRaw.map(row => {
            const normalizedRow: any = {};
            Object.entries(headerMap).forEach(([standardKey, synonyms]) => {
              const foundHeader = Object.keys(row).find(h => {
                const normalizedH = h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                return synonyms.includes(normalizedH);
              });
              normalizedRow[standardKey] = foundHeader ? row[foundHeader] : '';
            });
            return normalizedRow;
          });

          const missing = Object.keys(headerMap).filter(standardKey => {
            const synonyms = headerMap[standardKey];
            return !actualHeaders.some(h => synonyms.includes(h));
          });

          if (missing.length > 0) {
            this.zone.run(() => {
              this.isImporting = false;
              this.swal.error('Al archivo Excel le faltan columnas requeridas');
            });
            return;
          }

          this.zone.run(() => {
            this.previewData = normalizedRows;
            this.isImporting = false;
            this.showPreviewModal = true;
          });
        } catch (err) {
          this.zone.run(() => {
            this.isImporting = false;
            this.swal.error('Error al leer el archivo Excel');
          });
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    }).catch(() => {
      this.zone.run(() => {
        this.swal.error('Error al cargar el lector de Excel');
      });
    });

    fileInput.value = '';
  }

  confirmarImportacion() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.inicioGuardado = Date.now();

    const mappedData = this.previewData.map(row => {
      const mappedRow: Record<string, unknown> = { ...row };
      // username = cédula (igual que al crear manualmente)
      const cedulaLimpia = (row.cedula || '').toString().replace(/\D/g, '');
      mappedRow['username'] = cedulaLimpia;
      // password inicial = cédula (el usuario debería cambiarlo después)
      mappedRow['password'] = cedulaLimpia;
      // limpiar cédula
      mappedRow['cedula'] = cedulaLimpia;
      // nombres en mayúsculas
      if (mappedRow['primer_nombre']) mappedRow['primer_nombre'] = String(mappedRow['primer_nombre']).toUpperCase().trim();
      if (mappedRow['segundo_nombre']) mappedRow['segundo_nombre'] = String(mappedRow['segundo_nombre']).toUpperCase().trim();
      if (mappedRow['primer_apellido']) mappedRow['primer_apellido'] = String(mappedRow['primer_apellido']).toUpperCase().trim();
      if (mappedRow['segundo_apellido']) mappedRow['segundo_apellido'] = String(mappedRow['segundo_apellido']).toUpperCase().trim();
      // teléfono solo números
      if (mappedRow['telefono']) mappedRow['telefono'] = String(mappedRow['telefono']).replace(/\D/g, '');
      // sede
      if (row.sede !== undefined && row.sede !== null && row.sede !== '') {
        const sedeId = this.getSedeIdByName(row.sede);
        if (sedeId) mappedRow['id_sede'] = sedeId;
      }
      mappedRow['activo'] = true;
      return mappedRow;
    });

    // Usar el rol del Excel si existe, si no 'medico'
    const rol = (mappedData[0]?.['rol'] as string) || 'medico';
    const body = { rows: mappedData, rol };

    this.apiService.importarPersonal(body).subscribe({
      next: (res: any) => {
        this.finalizarGuardado(() => {
          this.cargarPersonal();
          if (res.importados === 0 && res.errores > 0) {
            this.swal.error(`No se pudo importar ningun registro. ${res.errores} error(es). Verifica que el Rol y la Sede del Excel coincidan con los del sistema.`);
          } else if (res.errores > 0) {
            this.swal.warning(`Importados: ${res.importados}, omitidos: ${res.omitidos}, errores: ${res.errores}.\n${res.mensaje || ''}`);
          } else {
            this.swal.success(res.mensaje || `Importacion exitosa: ${res.importados || this.previewData.length} registros`);
          }
          this.showPreviewModal = false;
          this.previewData = [];
        });
      },
      error: (err) => {
        this.finalizarGuardado(() => {
          this.swal.error(err.error?.mensaje || 'Error al importar datos');
        });
      },
    });
  }

  trackById = (index: number, item: PersonalDTO) => (item as any)?.id ?? (item as any)?.id_usuario ?? index;
}
