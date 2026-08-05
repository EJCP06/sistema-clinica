import { Component, inject, OnInit, ElementRef, OnDestroy, HostListener } from '@angular/core';
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
  Edit2,
  Search,
  ShieldCheck,
  XCircle,
  CheckCircle2,
  Check,
} from 'lucide-angular';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';
import { RolDTO, RecursoMatrizDTO, MatrizPermisosDTO } from '@core/models/dto.models';

@Component({
  selector: 'app-admin-permisologia',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './admin-permisologia.html',
})
/**
 * Panel de administración de roles y permisos.
 * Permite gestionar roles, asignar permisos por recurso/acción,
 * y visualizar la matriz completa de permisos del sistema.
 */
export class AdminPermisologia implements OnInit, OnDestroy {
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronDown = ChevronDown;
  readonly Edit2 = Edit2;
  readonly Search = Search;
  readonly ShieldCheck = ShieldCheck;
  readonly XCircle = XCircle;
  readonly CheckCircle2 = CheckCircle2;
  readonly Check = Check;

  private api = inject(ApiService);
  private auth = inject(AuthService);
  private swal = inject(SwalService);
  private el = inject(ElementRef);

  roles: RolDTO[] = [];
  sedes: any[] = [];
  recursos: RecursoMatrizDTO[] = [];
  permisosTemp: string[] = [];
  cargando: boolean = true;

  private recursosPermitidos = ['admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'personal', 'roles', 'especialidades', 'permisologia', 'llamado', 'sedes', 'servicios'];
  private recursosSoloVer = new Set(['laboratorio', 'imagenes', 'atencion_medica']);

  getAccionesRecurso(key: string): string[] {
    if (this.recursosSoloVer.has(key)) return ['ver'];
    return ['ver', 'crear', 'editar', 'eliminar'];
  }

  searchQuery = '';
  searchFilter = 'todo';
  showSearchFilterDropdown = false;

  currentPage = 1;
  pageSize = 7;

  showModal = false;
  showRolDropdown = false;
  showSedeDropdown = false;
  showModuloDropdown = false;
  isEditing = false;
  isSaving = false;
  selectedRoleId: number | null = null;
  selectedSedeId: number | null = null;
  selectedModuloKey: string | null = null;
  selectedRolNombre = '';
  private modalTrigger: HTMLElement | null = null;

  get rolesFiltrados(): RolDTO[] {
    if (!this.searchQuery) return this.roles;
    const q = this.searchQuery.toLowerCase();
    return this.roles.filter(r => {
      if (this.searchFilter === 'rol') {
        return (r.nombre || '').toLowerCase().includes(q);
      }
      return (r.nombre || '').toLowerCase().includes(q) ||
             (r.sede_nombre || '').toLowerCase().includes(q) ||
             (r.key || '').toLowerCase().includes(q);
    });
  }

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  get searchFilterLabel(): string {
    const labels: Record<string, string> = { todo: 'Todo', rol: 'Roles' };
    return labels[this.searchFilter] || 'Todo';
  }

  get modalTitulo(): string {
    return this.isEditing ? 'Editar Permisos' : 'Nuevo Permiso';
  }

  get modalSubtitulo(): string {
    return this.isEditing
      ? `Configurando accesos para ${this.toTitleCase(this.selectedRolNombre)}`
      : 'Seleccione un rol y configure sus accesos';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;

    if (this.showSearchFilterDropdown && !target.closest('.search-filter-container')) {
      this.showSearchFilterDropdown = false;
    }

    if (this.showRolDropdown && !target.closest('.rol-dropdown-container')) {
      this.showRolDropdown = false;
    }

    if (this.showSedeDropdown && !target.closest('.sede-dropdown-container')) {
      this.showSedeDropdown = false;
    }

    if (this.showModuloDropdown && !target.closest('.modulo-dropdown-container')) {
      this.showModuloDropdown = false;
    }
  }

  /** Inicializa cargando roles, sedes y matriz de recursos. */
  ngOnInit() {
    this.cargarRoles();
    this.cargarSedes();
    this.cargarRecursos();
  }

  ngOnDestroy() {}

  cargarRoles() {
    this.cargando = true;
    this.api.getRoles().subscribe({
      next: (r) => { this.roles = r; this.cargando = false; },
      error: () => { this.cargando = false; this.swal.error('Error al cargar roles'); },
    });
  }

  cargarSedes() {
    this.api.getSedes().subscribe({
      next: (s) => this.sedes = s,
      error: () => {},
    });
  }

  cargarRecursos() {
    this.api.getMatrizPermisos().subscribe({
      next: (matriz: MatrizPermisosDTO) => {
        this.recursos = matriz.recursos.filter(r => r.key !== '*' && this.recursosPermitidos.includes(r.key));
      },
      error: () => this.swal.error('Error al cargar matriz de permisos'),
    });
  }

  setSearchFilter(val: string) {
    this.searchFilter = val;
    this.showSearchFilterDropdown = false;
  }

  toTitleCase(text: string): string {
    if (!text) return '';
    return text.replace(/_/g, ' ').charAt(0).toUpperCase() + text.replace(/_/g, ' ').slice(1).toLowerCase();
  }

  getSedeLabel(id: number | null | undefined): string {
    if (id === null || id === undefined) return 'Ninguna';
    const rol = this.roles.find(r => r.id_sede === id);
    return rol?.sede_nombre?.toUpperCase() || 'Ninguna';
  }

  getRolNombre(id: number): string {
    const rol = this.roles.find(r => r.id === id);
    return rol?.nombre || '';
  }

  esRolAdministrador(): boolean {
    if (!this.selectedRoleId) return false;
    const rol = this.roles.find(r => r.id === this.selectedRoleId);
    return rol?.key === 'administrador';
  }

  selectRol(id: number) {
    this.selectedRoleId = id;
    this.showRolDropdown = false;
  }

  selectSede(id: number | null) {
    this.selectedSedeId = id;
    this.showSedeDropdown = false;
  }

  getSedeNombre(id: number | null | undefined): string {
    if (id === null || id === undefined) return '';
    const sede = this.sedes.find((s: any) => Number(s.id_sede) === Number(id));
    return sede ? sede.nombre : '';
  }

  selectModulo(key: string) {
    this.selectedModuloKey = key;
    this.showModuloDropdown = false;
  }

  getModuloNombre(key: string): string {
    const rec = this.recursos.find(r => r.key === key);
    return rec?.nombre || key;
  }

  abrirModalNuevo(trigger?: HTMLElement) {
    this.isEditing = false;
    this.selectedRoleId = null;
    this.selectedSedeId = null;
    this.selectedModuloKey = null;
    this.selectedRolNombre = '';
    this.permisosTemp = [];
    this.showRolDropdown = false;
    this.showSedeDropdown = false;
    this.showModuloDropdown = false;
    this.modalTrigger = trigger || null;
    this.showModal = true;
  }

  abrirModalEditar(rol: RolDTO, trigger?: HTMLElement) {
    this.isEditing = true;
    this.selectedRoleId = rol.id;
    this.selectedRolNombre = rol.nombre;
    this.selectedSedeId = rol.id_sede;
    this.selectedModuloKey = null;
    this.permisosTemp = [];
    this.showRolDropdown = false;
    this.showSedeDropdown = false;
    this.showModuloDropdown = false;
    this.modalTrigger = trigger || null;
    this.showModal = true;

    this.api.getPermisosByRol(rol.id).subscribe({
      next: (permisos: any) => {
        if (Array.isArray(permisos)) {
          if (permisos.length > 0 && typeof permisos[0] === 'string') {
            this.permisosTemp = permisos;
          } else {
            this.permisosTemp = permisos.map((p: { key: string }) => p.key);
          }
        }
        this.expandWildcards();
        this.limpiarAccionesInvalidas();
      },
      error: () => this.swal.error('Error al cargar permisos del rol'),
    });
  }

  cerrarModal() {
    this.showModal = false;
    this.showRolDropdown = false;
    this.showSedeDropdown = false;
    this.showModuloDropdown = false;
    this.modalTrigger = null;
  }

  isChecked(recurso: string, accion: string): boolean {
    return this.permisosTemp.includes(`${recurso}:${accion}`);
  }

  private expandWildcards() {
    const expanded: string[] = [];
    for (const key of this.permisosTemp) {
      const [recurso, accion] = key.split(':');
      if (accion === '*') {
        for (const a of this.getAccionesRecurso(recurso)) {
          expanded.push(`${recurso}:${a}`);
        }
      } else {
        expanded.push(key);
      }
    }
    this.permisosTemp = expanded;
  }

  private limpiarAccionesInvalidas() {
    this.permisosTemp = this.permisosTemp.filter(key => {
      const [recurso, accion] = key.split(':');
      return this.getAccionesRecurso(recurso).includes(accion);
    });
  }

  togglePermiso(recurso: string, accion: string) {
    const key = `${recurso}:${accion}`;
    const idx = this.permisosTemp.indexOf(key);
    if (idx === -1) {
      this.permisosTemp.push(key);
    } else {
      this.permisosTemp.splice(idx, 1);
    }
  }

  guardarPermisos() {
    if (this.isSaving) return;
    const rolId = this.selectedRoleId;
    if (!rolId) {
      this.swal.warning('Seleccione un rol');
      return;
    }
    if (!this.isEditing && !this.selectedSedeId) {
      this.swal.warning('Seleccione una sede');
      return;
    }
    this.isSaving = true;

    const permisosAGuardar = [...this.permisosTemp];
    if (this.esRolAdministrador() && !permisosAGuardar.includes('permisologia:gestionar_permisos')) {
      permisosAGuardar.push('permisologia:gestionar_permisos');
    }

    this.api.asignarPermisos(rolId, permisosAGuardar).subscribe({
      next: () => {
        this.isSaving = false;
        this.cerrarModal();
        this.auth.refrescarPermisos().subscribe({
          error: () => {},
        });
        this.swal.success('Permisos actualizados exitosamente');
      },
      error: (err) => {
        this.isSaving = false;
        this.swal.error(err.error?.mensaje || 'Error al asignar permisos');
      },
    });
  }

  async eliminarPermisos(rolId: number, rolNombre: string) {
    const result = await this.swal.confirmDelete(`¿Eliminar el rol "${this.toTitleCase(rolNombre)}"?`);
    if (!result.isConfirmed) return;

    this.api.eliminarRol(rolId).subscribe({
      next: () => {
        this.auth.refrescarPermisos().subscribe({
          error: () => {},
        });
        this.swal.success(`Rol "${this.toTitleCase(rolNombre)}" eliminado correctamente`);
        this.cargarRoles();
      },
      error: (err) => {
        if (err.status === 409) {
          this.swal.error(
            err.error?.mensaje || 'No se puede eliminar el rol porque está asignado a uno o más usuarios'
          );
        } else {
          this.swal.error(err.error?.mensaje || 'Error al eliminar el rol');
        }
      },
    });
  }
}