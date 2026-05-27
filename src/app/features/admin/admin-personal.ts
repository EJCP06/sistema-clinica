import { Component, inject, Input, OnInit, HostListener, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ServicioDTO, EspecialidadDTO, ConsultorioDTO, PersonalDTO, SedeDTO } from '@core/models/dto.models';
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
} from 'lucide-angular';

@Component({
  selector: 'app-admin-personal',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
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

  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  @Input() activeTab: string = 'medicos';

  servicios: ServicioDTO[] = [];
  especialidades: EspecialidadDTO[] = [];
  consultorios: ConsultorioDTO[] = [];
  sedes: SedeDTO[] = [];
  medicos: PersonalDTO[] = [];
  recepcionistas: PersonalDTO[] = [];
  administradores: PersonalDTO[] = [];

  searchQuery = '';
  searchFilter = 'todo';

  showRolDropdown = false;
  showMedicoEspDropdown = false;
  showMedicoConDropdown = false;
  showMedicoPisoDropdown = false;
  showSedeDropdown = false;
  showSearchFilterDropdown = false;

  showModalPersonal = false;
  isEditing = false;
  editingId: number | null = null;
  isSaving = false;
  showPassword = false;

  formPersonal: {
    rol: string;
    username: string;
    password: string;
    nombre: string;
    apellido: string;
    cedula: string;
    telefono: string;
    activo: boolean;
    servicio_id: string | number;
    especialidad_id: string | number;
    consultorio_id: string | number;
    piso: string;
    id_sede: string | number;
  } = {
    rol: 'medico',
    username: '',
    password: '',
    nombre: '',
    apellido: '',
    cedula: '',
    telefono: '',
    activo: true,
    servicio_id: '',
    especialidad_id: '',
    consultorio_id: '',
    piso: '',
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
    this.apiService.getPersonal().subscribe((pers) => {
      const personalMapeado = pers.map((p) => ({
        ...p,
        id: p.id || p.id_usuario,
        activo: p.activo !== undefined ? p.activo : p.status,
      }));
      this.medicos = personalMapeado.filter((p) => p.rol === 'medico');
      this.recepcionistas = personalMapeado.filter((p) => p.rol === 'recepcionista');
      this.administradores = personalMapeado.filter((p) => p.rol === 'admin');
    });
  }

  // --- Modal Logic ---
  openModalPersonal(user?: PersonalDTO | null, rol?: string) {
    this.showPassword = false;
    this.isEditing = !!user;
    this.editingId = user?.id || user?.id_usuario || null;
    if (user) {
      this.formPersonal = {
        rol: user.rol || 'medico',
        username: user.username || user.cedula || '',
        password: '',
        nombre: user.nombre,
        apellido: user.apellido || '',
        cedula: user.cedula || '',
        telefono: user.telefono || '',
        activo: !!user.activo,
        servicio_id: user.servicio_id || '',
        especialidad_id: user.id_especialidad || '',
        consultorio_id: user.consultorio_id || '',
        piso: user.piso || '',
        id_sede: user.id_sede || '',
      };
    } else {
      this.formPersonal = {
        rol: rol || 'medico',
        username: '',
        password: '',
        nombre: '',
        apellido: '',
        cedula: '',
        telefono: '',
        activo: true,
        servicio_id: '',
        especialidad_id: '',
        consultorio_id: '',
        piso: '',
        id_sede: '',
      };
    }
    this.showModalPersonal = true;
  }

  // --- CRUD PERSONAL ---
  guardarPersonal() {
    if (this.isSaving) return;
    this.isSaving = true;
    const rol = this.formPersonal.rol;
    const cedulaFinal = (this.formPersonal.cedula || this.formPersonal.username || '')
      .toString().replace(/\D/g, '');
    const body: Record<string, unknown> = {
      ...this.formPersonal,
      nombre: (this.formPersonal.nombre || '').toUpperCase().trim(),
      apellido: (this.formPersonal.apellido || '').toUpperCase().trim(),
      cedula: cedulaFinal,
      username: cedulaFinal,
      telefono: (this.formPersonal.telefono || '').toString().replace(/\D/g, ''),
      password: this.formPersonal.password ? this.formPersonal.password.replace(/\s/g, '') : null,
      piso: (rol === 'medico' || rol === 'recepcionista') && this.formPersonal.piso
        ? this.formPersonal.piso.toString().replace(/\D/g, '') : null,
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
        this.showModalPersonal = false;
        this.isSaving = false;
        this.cargarPersonal();
      },
      error: (err) => {
        this.isSaving = false;
        console.error('Error al guardar:', err);
        alert(err.error?.mensaje || 'Error al guardar personal');
      },
    });
  }

  eliminarPersonal(id: number) {
    if (confirm('¿Eliminar este usuario del personal?')) {
      this.apiService.eliminarPersonal(id).subscribe(() => this.cargarPersonal());
    }
  }

  // --- Filtered Getters ---
  get medicosFiltrados() {
    return this.medicos.filter((m) => {
      const query = this.searchQuery.toLowerCase();
      if (!query) return true;
      const matchNombre = (m.nombre || '').toLowerCase().includes(query);
      const matchApellido = (m.apellido || '').toLowerCase().includes(query);
      const matchCedula = (m.cedula || '').toLowerCase().includes(query);
      const matchEsp = this.getNombreEsp(m.servicio_id).toLowerCase().includes(query);
      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      if (this.searchFilter === 'especialidad') return matchEsp;
      return matchNombre || matchApellido || matchCedula || matchEsp;
    });
  }

  get recepcionistasFiltradas() {
    return this.recepcionistas.filter((r) => {
      const query = this.searchQuery.toLowerCase();
      if (!query) return true;
      const matchNombre = (r.nombre || '').toLowerCase().includes(query);
      const matchApellido = (r.apellido || '').toLowerCase().includes(query);
      const matchCedula = (r.cedula || '').toLowerCase().includes(query);
      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'apellido') return matchApellido;
      if (this.searchFilter === 'cedula') return matchCedula;
      return matchNombre || matchApellido || matchCedula;
    });
  }

  get administradoresFiltrados() {
    return this.administradores.filter((a) => {
      const query = this.searchQuery.toLowerCase();
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

  // --- Dropdown Helpers ---
  toggleMedicoEspDropdown() {
    this.showMedicoEspDropdown = !this.showMedicoEspDropdown;
    this.showMedicoConDropdown = false;
  }

  toggleMedicoConDropdown() {
    this.showMedicoConDropdown = !this.showMedicoConDropdown;
    this.showMedicoEspDropdown = false;
    this.showMedicoPisoDropdown = false;
  }

  toggleMedicoPisoDropdown() {
    this.showMedicoPisoDropdown = !this.showMedicoPisoDropdown;
    this.showMedicoEspDropdown = false;
    this.showMedicoConDropdown = false;
  }

  selectMedicoEsp(esp: EspecialidadDTO) {
    this.formPersonal.especialidad_id = esp.id ?? '';
    this.formPersonal.servicio_id = esp.id_servicio ?? '';
    this.formPersonal.piso = esp.piso ?? '';
    this.formPersonal.consultorio_id = '';
    this.showMedicoEspDropdown = false;
  }

  get consultoriosDelServicio() {
    if (!this.formPersonal.especialidad_id) return this.consultorios;
    const esp = this.especialidades.find(e => e.id === Number(this.formPersonal.especialidad_id));
    if (!esp || !esp.consultorios_ids || esp.consultorios_ids.length === 0) return this.consultorios;
    return this.consultorios.filter((c) => esp.consultorios_ids!.includes(c.id_consultorio));
  }

  selectMedicoCon(con: ConsultorioDTO) {
    this.formPersonal.consultorio_id = con.id_consultorio ?? '';
    this.showMedicoConDropdown = false;
  }

  selectMedicoPiso(piso: string) {
    this.formPersonal.piso = piso;
    this.showMedicoPisoDropdown = false;
  }

  getPisosDisponibles(): string[] {
    const pisos = this.especialidades.map((e) => String(e.piso)).filter((p) => p);
    return [...new Set(pisos)].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }

  toggleSedeDropdown() {
    this.showSedeDropdown = !this.showSedeDropdown;
    this.showMedicoEspDropdown = false;
    this.showMedicoConDropdown = false;
    this.showMedicoPisoDropdown = false;
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

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(val: string) {
    this.searchFilter = val;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(val: string): string {
    const map: Record<string, string> = { todo: 'Todo', nombre: 'Nombre', apellido: 'Apellido', cedula: 'Cédula', especialidad: 'Especialidad', prefijo: 'Prefijo', servicio: 'Servicio' };
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
    const con = this.consultorios.find((c) => c.id_consultorio == id);
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

  toTitleCase(str: string): string {
    if (!str) return '';
    return str.toLowerCase().split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  }

  getRolLabel(rol: string): string {
    const labels: { [key: string]: string } = { admin: 'Administrador', medico: 'Médico', recepcionista: 'Recepcionista' };
    return labels[rol] || 'Seleccione...';
  }

  // --- Click Outside Handler ---
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
    if (!target.closest('.medico-esp-container')) this.showMedicoEspDropdown = false;
    if (!target.closest('.medico-con-container')) this.showMedicoConDropdown = false;
    if (!target.closest('.medico-piso-container')) this.showMedicoPisoDropdown = false;
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

  trackById = (index: number, item: PersonalDTO) => (item as any)?.id ?? (item as any)?.id_usuario ?? index;
}
