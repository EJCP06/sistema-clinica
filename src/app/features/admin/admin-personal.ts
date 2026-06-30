import { Component, inject, OnInit, HostListener, DestroyRef, ElementRef, ChangeDetectorRef } from '@angular/core';
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
  readonly Upload = Upload;
  readonly Info = Info;

  private auth = inject(AuthService);
  private apiService = inject(ApiService);
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private cdr = inject(ChangeDetectorRef);

  pageSize = 6;
  currentPage = 1;

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
  showMedicoConDropdown = false;
  showSedeDropdown = false;
  showSearchFilterDropdown = false;

  showModalPersonal = false;
  private modalTrigger: HTMLElement | null = null;

  isEditing = false;
  editingId: number | null = null;
  isSaving = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;
  showPassword = false;

  // --- Preview Modal ---
  showPreviewModal = false;
  previewData: any[] = [];

  showExcelFormat = false;
  isImporting = false;

  formPersonal: {
    rol: string;
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
    this.apiService.getRoles().subscribe((roles) => {
      this.rolesLista = roles.filter(r => r.activo);
    });
    this.apiService.getPersonal().subscribe((pers) => {
      this.todoPersonal = pers.map((p) => ({
        ...p,
        id: p.id || p.id_usuario,
        activo: p.activo !== undefined ? p.activo : p.status,
      }));
    });
  }

  // --- Modal Logic ---
  openModalPersonal(user?: PersonalDTO | null, trigger?: EventTarget | null) {
    this.showPassword = false;
    this.isEditing = !!user;
    this.editingId = user?.id || user?.id_usuario || null;
    if (user) {
      this.formPersonal = {
        rol: user.rol || 'medico',
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
        servicio_id: user.servicio_id || '',
        especialidad_id: user.id_especialidad || '',
        consultorio_id: user.consultorio_id || '',
        id_sede: user.id_sede || '',
      };
    } else {
      this.formPersonal = {
        rol: '',
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

  // --- CRUD PERSONAL ---
  guardarPersonal() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.inicioGuardado = Date.now();
    const rol = this.formPersonal.rol;
    const cedulaFinal = (this.formPersonal.cedula || this.formPersonal.username || '')
      .toString().replace(/\D/g, '');
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
      id_consultorio: rol === 'medico'
        ? (this.formPersonal.consultorio_id ? Number(this.formPersonal.consultorio_id) : null) : null,
      id_servicio: rol === 'medico'
        ? (this.formPersonal.servicio_id ? Number(this.formPersonal.servicio_id) : null) : null,
      id_especialidad: rol === 'medico'
        ? (this.formPersonal.especialidad_id ? Number(this.formPersonal.especialidad_id) : null) : null,
      status: !!this.formPersonal.activo,
    };
    const call = this.isEditing && this.editingId !== null
      ? this.apiService.actualizarPersonal(this.editingId, body as Partial<PersonalDTO>)
      : this.apiService.crearPersonal(body as Partial<PersonalDTO>);
    call.subscribe({
      next: () => {
        this.finalizarGuardado(() => {
          this.showModalPersonal = false;
          this.cargarPersonal();
          this.swal.success('Personal guardado correctamente');
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

  // --- Filtered Getters ---
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

  // --- Dropdown Helpers ---
  toggleMedicoEspDropdown() {
    this.showMedicoEspDropdown = !this.showMedicoEspDropdown;
    this.showMedicoConDropdown = false;
  }

  toggleMedicoConDropdown() {
    this.showMedicoConDropdown = !this.showMedicoConDropdown;
    this.showMedicoEspDropdown = false;
  }

  selectMedicoEsp(esp: EspecialidadDTO) {
    this.formPersonal.especialidad_id = esp.id ?? '';
    this.formPersonal.servicio_id = esp.id_servicio ?? '';
    this.formPersonal.consultorio_id = '';
    this.showMedicoEspDropdown = false;
  }

  get consultoriosDelServicio() {
    if (!this.formPersonal.especialidad_id) return this.consultorios;
    const esp = this.especialidades.find(e => e.id === Number(this.formPersonal.especialidad_id));
    if (!esp || !esp.consultorios_ids || esp.consultorios_ids.length === 0) return this.consultorios;
    return this.consultorios.filter((c) => esp.consultorios_ids!.includes(c.id));
  }

  selectMedicoCon(con: ConsultorioDTO) {
    this.formPersonal.consultorio_id = con.id ?? '';
    this.showMedicoConDropdown = false;
  }

  toggleSedeDropdown() {
    this.showSedeDropdown = !this.showSedeDropdown;
    this.showMedicoEspDropdown = false;
    this.showMedicoConDropdown = false;
  }

  selectSede(id: number) {
    this.formPersonal.id_sede = id;
    this.showSedeDropdown = false;
  }

  toggleRolDropdown() {
    this.showRolDropdown = !this.showRolDropdown;
  }

  selectRol(rol: string) {
    this.formPersonal.rol = rol;
    this.showRolDropdown = false;
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
    const map: Record<string, string> = { todo: 'Todo', nombre: 'Nombre', apellido: 'Apellido', cedula: 'Cédula', rol: 'Rol' };
    return map[val] || 'Filtrar';
  }

  // --- Label Helpers ---
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

  // --- Click Outside Handler ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
    if (!target.closest('.medico-esp-container')) this.showMedicoEspDropdown = false;
    if (!target.closest('.medico-con-container')) this.showMedicoConDropdown = false;
    if (!target.closest('.rol-dropdown-container')) this.showRolDropdown = false;
    if (!target.closest('.sede-dropdown-container')) this.showSedeDropdown = false;
  }

  // --- Input Validation ---
  soloLetras(event: KeyboardEvent) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault();
  }

  soloNumeros(event: KeyboardEvent) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) event.preventDefault();
  }

  sinEspacios(event: KeyboardEvent) {
    if (event.charCode === 32) event.preventDefault();
  }

  // --- Excel Import ---
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
            this.isImporting = false;
            this.swal.error('El archivo Excel está vacío');
            return;
          }

          // Mapa de sinónimos para normalizar cabeceras
          const headerMap: Record<string, string[]> = {
            primer_nombre: ['primer nombre', 'primer_nombre', 'primernombre'],
            segundo_nombre: ['segundo nombre', 'segundo_nombre', 'segundonombre'],
            primer_apellido: ['primer apellido', 'primer_apellido', 'primerapellido'],
            segundo_apellido: ['segundo apellido', 'segundo_apellido', 'segundoapellido'],
            cedula: ['cedula', 'cédula', 'dni', 'identificación', 'documento'],
            rol: ['rol', 'cargo', 'puesto', 'rol usuario'],
            telefono: ['telefono', 'teléfono', 'tel', 'celular', 'contacto'],
            sede: ['sede', 'sucursalmacen', 'id_sede', 'sede id']
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

          // Verificar si faltan columnas esenciales basándonos en el mapeo
          const missing = Object.keys(headerMap).filter(standardKey => {
            const synonyms = headerMap[standardKey];
            return !actualHeaders.some(h => synonyms.includes(h));
          });

          if (missing.length > 0) {
            this.isImporting = false;
            this.swal.error('Al archivo Excel le faltan columnas requeridas');
            return;
          }

          this.previewData = normalizedRows;
          this.isImporting = false;
          this.showPreviewModal = true;
        } catch (err) {
          this.isImporting = false;
          this.swal.error('Error al leer el archivo Excel');
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    }).catch(() => {
      this.swal.error('Error al cargar el lector de Excel');
    });

    fileInput.value = '';
  }

  confirmarImportacion() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.inicioGuardado = Date.now();

    // Apply sede mapping to preview data
    const mappedData = this.previewData.map(row => {
      const mappedRow = { ...row };
      if (row.sede !== undefined && row.sede !== null && row.sede !== '') {
        const sedeId = this.getSedeIdByName(row.sede);
        if (sedeId) mappedRow.id_sede = sedeId;
      }
      mappedRow.activo = true;
      return mappedRow;
    });

    const rol = this.formPersonal.rol || 'medico';
    const body = { rows: mappedData, rol };

    this.apiService.importarPersonal(body).subscribe({
      next: (res: any) => {
        this.finalizarGuardado(() => {
          this.cargarPersonal();
          this.swal.success(res.mensaje || `Importación exitosa: ${res.importados || this.previewData.length} registros`);
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
