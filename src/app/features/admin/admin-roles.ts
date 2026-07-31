import { Component, inject, OnInit, DestroyRef, ElementRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import {
  LucideAngularModule,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Edit2,
  Search,
  LayoutGrid,
  ShieldCheck,
  XCircle,
  UserCog,
  Users,
  MapPin,
  CheckCircle2,
  Check,
  LayoutDashboard,
  BarChart3,
  Settings,
  LogOut,
  Sun,
  Moon,
  Upload,
  Eye,
  EyeOff,
  Menu,
  Layers,
  Calendar,
  Download,
  Clock,
  Activity,
  FlaskConical,
  Image,
  Megaphone,
  Ticket,
  DoorOpen,
  Stethoscope,
} from 'lucide-angular';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';
import { RolDTO, CrearRolRequest } from '@core/models/dto.models';

@Component({
  selector: 'app-admin-roles',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './admin-roles.html',
  styles: [],
})
/** Panel de administración de roles de usuario. CRUD y filtro por sede. */
export class AdminRoles implements OnInit {
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Edit2 = Edit2;
  readonly Search = Search;
  readonly LayoutGrid = LayoutGrid;
  readonly ShieldCheck = ShieldCheck;
  readonly XCircle = XCircle;
  readonly UserCog = UserCog;
  readonly Users = Users;
  readonly MapPin = MapPin;
  readonly CheckCircle2 = CheckCircle2;
  readonly Check = Check;
  readonly LayoutDashboard = LayoutDashboard;
  readonly BarChart3 = BarChart3;
  readonly Settings = Settings;
  readonly LogOut = LogOut;
  readonly Sun = Sun;
  readonly Moon = Moon;
  readonly Upload = Upload;
  readonly Eye = Eye;
  readonly EyeOff = EyeOff;
  readonly Menu = Menu;
  readonly Layers = Layers;
  readonly Calendar = Calendar;
  readonly Download = Download;
  readonly Clock = Clock;
  readonly Activity = Activity;
  readonly FlaskConical = FlaskConical;
  readonly Image = Image;
  readonly Megaphone = Megaphone;
  readonly Ticket = Ticket;
  readonly DoorOpen = DoorOpen;
  readonly Stethoscope = Stethoscope;

  private auth = inject(AuthService);
  private apiService = inject(ApiService);
  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);

  roles: RolDTO[] = [];
  sedes: any[] = [];
  cargando: boolean = true;

  currentPageRoles = 1;
  pageSize = 7;

  searchQuery = '';
  searchFilter = 'todo';
  showSearchFilterDropdown = false;
  
  showModalRol = false;
  private modalTrigger: HTMLElement | null = null;

  isEditing = false;
  editingId: number | null = null;
  isSaving = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;
  showSedeDropdown = false;

  formRol: CrearRolRequest = {
    nombre: '',
    id_sede: null,
    activo: true,
  };

  ngOnInit(): void {
    this.cargarRoles();
    this.cargarSedes();
  }

  cargarRoles(): void {
    this.cargando = true;
    this.apiService.getRoles().subscribe({
      next: (roles) => {
        this.roles = roles;
        this.cargando = false;
      },
      error: (err) => {
        this.cargando = false;
        console.error('Error al cargar roles:', err);
        this.swal.error('Error al cargar los roles');
      },
    });
  }

  cargarSedes(): void {
    this.apiService.getSedes().subscribe({
      next: (s) => {
        this.sedes = s.sort((a, b) => Number(a.id_sede) - Number(b.id_sede));
      },
      error: () => {},
    });
  }

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

  getRolesFiltrados(): RolDTO[] {
    if (!this.searchQuery) return this.roles;
    const query = this.searchQuery.toLowerCase();
    return this.roles.filter((r) => {
      const matchNombre = (r.nombre || '').toLowerCase().includes(query);
      const matchKey = (r.key || '').toLowerCase().includes(query);
      const matchSede = (r.sede_nombre || '').toLowerCase().includes(query);
      if (this.searchFilter === 'nombre') return matchNombre;
      return matchNombre || matchKey || matchSede;
    });
  }

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  toggleSearchFilterDropdown(): void {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(val: string): void {
    this.searchFilter = val;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(val: string): string {
    const labels: { [key: string]: string } = { todo: 'Todo', nombre: 'Nombres' };
    return labels[val] || 'Todo';
  }

  soloLetras(event: KeyboardEvent) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    if (event.key.length === 1 && !pattern.test(event.key)) {
      event.preventDefault();
      return;
    }
    const input = event.target as HTMLInputElement;
    if (event.key === ' ' && input.value.length === 0) {
      event.preventDefault();
    }
  }

  trimCampo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.trim();
    input.dispatchEvent(new Event('input'));
  }

  openModalRol(rol?: RolDTO | null, trigger?: HTMLElement | null): void {
    this.isEditing = !!rol;
    this.editingId = rol?.id ?? null;
    if (rol) {
      this.formRol = {
        nombre: rol.nombre,
        id_sede: rol.id_sede,
        activo: rol.activo,
      };
    } else {
      this.formRol = {
        nombre: '',
        id_sede: null,
        activo: true,
      };
    }
    this.abrirModalRol(trigger);
  }

  abrirModalRol(trigger?: HTMLElement | null) {
    this.modalTrigger = trigger || null;
    this.showModalRol = true;
  }

  cerrarModalRol() {
    this.showModalRol = false;
    this.modalTrigger = null;
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => {
      if (accion) accion();
      this.isSaving = false;
    }, restante);
  }

  guardarRol(): void {
    if (this.isSaving) return;

    if (!this.formRol.nombre?.trim()) {
      this.swal.error('El nombre del rol es obligatorio');
      return;
    }

    this.isSaving = true;
    this.inicioGuardado = Date.now();
    const body = { ...this.formRol };

    const call = this.isEditing && this.editingId !== null
      ? this.apiService.actualizarRol(this.editingId, body)
      : this.apiService.crearRol(body);

    call.subscribe({
      next: () => {
        this.finalizarGuardado(() => {
          this.cerrarModalRol();
          this.cargarRoles();
          this.swal.success(
            this.isEditing ? 'Rol actualizado correctamente' : 'Rol creado correctamente'
          );
        });
      },
      error: (err) => {
        this.finalizarGuardado(() => {
          console.error('Error al guardar rol:', err);
          this.swal.error(err.error?.mensaje || 'Error al guardar el rol');
        });
      },
    });
  }

  async eliminarRol(id: number): Promise<void> {
    const result = await this.swal.confirmDelete('¿Eliminar este rol?');
    if (!result.isConfirmed) return;

    this.apiService.eliminarRol(id).subscribe({
      next: () => {
        this.cargarRoles();
        this.swal.success('Rol eliminado correctamente');
      },
      error: (err) => {
        console.error('Error al eliminar rol:', err);
        if (err.status === 409) {
          this.swal.error(
            err.error?.mensaje || 'No se puede eliminar el rol porque está asignado a uno o más usuarios'
          );
        } else {
          this.swal.error('Error al eliminar el rol');
        }
      },
    });
  }

  getSedeLabel(id: number | null | undefined): string {
    if (id === null || id === undefined || !this.sedes.length) return 'Ninguna';
    const sede = this.sedes.find((s) => Number(s.id_sede) === Number(id));
    return sede ? sede.nombre.toUpperCase() : 'Ninguna';
  }

  getSedeNombre(id: number | null | undefined): string {
    if (id === null || id === undefined) return '';
    const sede = this.sedes.find((s) => Number(s.id_sede) === Number(id));
    return sede ? sede.nombre : '';
  }

  toggleSedeDropdown(): void {
    this.showSedeDropdown = !this.showSedeDropdown;
  }

  selectSede(id: number | null): void {
    this.formRol.id_sede = id;
    this.showSedeDropdown = false;
  }
}