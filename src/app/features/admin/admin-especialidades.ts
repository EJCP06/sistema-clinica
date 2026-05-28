import { Component, inject, Input, OnInit, HostListener, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { ConsultorioDTO, EspecialidadDTO, SedeDTO } from '@core/models/dto.models';
import {
  LucideAngularModule,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Search,
  Edit2,
  XCircle,
  CheckCircle2,
  Check,
  MapPin,
} from 'lucide-angular';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';

@Component({
  selector: 'app-admin-especialidades',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './admin-especialidades.html',
  styles: [],
})
export class AdminEspecialidades implements OnInit {
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Stethoscope = Stethoscope;
  readonly Search = Search;
  readonly Edit2 = Edit2;
  readonly XCircle = XCircle;
  readonly CheckCircle2 = CheckCircle2;
  readonly Check = Check;
  readonly MapPin = MapPin;

  pageSize = 7;
  currentPage = 1;

  private apiService = inject(ApiService);
  private destroyRef = inject(DestroyRef);

  consultorios: ConsultorioDTO[] = [];
  especialidades: EspecialidadDTO[] = [];
  sedes: SedeDTO[] = [];

  searchQuery = '';
  searchFilter = 'todo';
  showSearchFilterDropdown = false;
  showSedeDropdown = false;

  showModalEspecialidad = false;
  isEditing = false;
  editingId: number | null = null;
  isSaving = false;

  formEsp: {
    nombre: string;
    codigo: string;
    prefijo: string;
    piso: string;
    consultorios_ids: number[];
    descripcion: string;
    activo: boolean;
    id_sede: string | number;
    id_servicio: number;
  } = {
    nombre: '',
    codigo: '',
    prefijo: '',
    piso: '',
    consultorios_ids: [],
    descripcion: '',
    activo: true,
    id_sede: '',
    id_servicio: 1,
  };

  ngOnInit() {
    this.cargarEspecialidades();
    this.cargarConsultorios();
    this.cargarSedes();
  }

  cargarEspecialidades() {
    this.apiService.getEspecialidades().subscribe((esps) => { this.especialidades = esps; });
  }

  cargarConsultorios() {
    this.apiService.getConsultorios().subscribe((cons) => {
      this.consultorios = cons.sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
    });
  }

  cargarSedes() {
    this.apiService.getSedes().subscribe({
      next: (s) => { this.sedes = s.sort((a, b) => Number(a.id_sede) - Number(b.id_sede)); },
      error: () => {},
    });
  }

  get especialidadesFiltradas() {
    return this.especialidades.filter((e) => {
      const query = this.searchQuery.toLowerCase();
      if (!query) return true;
      const matchNombre = (e.nombre || '').toLowerCase().includes(query);
      const matchPrefijo = (e.prefijo || '').toLowerCase().includes(query);
      if (this.searchFilter === 'nombre') return matchNombre;
      if (this.searchFilter === 'prefijo') return matchPrefijo;
      return matchNombre || matchPrefijo;
    });
  }

  openModalEsp(esp?: EspecialidadDTO | null) {
    if (esp) {
      this.isEditing = true;
      this.editingId = esp.id ?? esp.id_especialidad ?? null;
      this.formEsp = {
        nombre: esp.nombre || '',
        codigo: esp.codigo || '',
        prefijo: esp.prefijo || '',
        piso: esp.piso || '',
        consultorios_ids: esp.consultorios_ids || [],
        descripcion: '',
        activo: esp.activo ?? true,
        id_sede: esp.id_sede || '',
        id_servicio: esp.id_servicio || 1,
      };
    } else {
      this.isEditing = false;
      this.editingId = null;
      this.formEsp = {
        nombre: '',
        codigo: '',
        prefijo: '',
        piso: '',
        consultorios_ids: [],
        descripcion: '',
        activo: true,
        id_sede: '',
        id_servicio: 1,
      };
    }
    this.showModalEspecialidad = true;
  }

  guardarEsp() {
    if (this.isSaving) return;
    this.isSaving = true;
    const body = {
      nombre: (this.formEsp.nombre || '').toUpperCase().trim(),
      prefijo: (this.formEsp.prefijo || '').toUpperCase().trim(),
      id_servicio: 1,
      consultorios_ids: this.formEsp.consultorios_ids,
      piso: (this.formEsp.piso || '').toString().replace(/\D/g, ''),
      activo: this.formEsp.activo,
      id_sede: this.formEsp.id_sede ? Number(this.formEsp.id_sede) : 1,
    };
    const call = this.isEditing && this.editingId !== null
      ? this.apiService.actualizarEspecialidad(this.editingId, body)
      : this.apiService.crearEspecialidad(body);
    call.subscribe({
      next: () => {
        this.showModalEspecialidad = false;
        this.isSaving = false;
        this.formEsp = { nombre: '', codigo: '', prefijo: '', piso: '', consultorios_ids: [], descripcion: '', activo: true, id_sede: '', id_servicio: 1 };
        this.cargarEspecialidades();
      },
      error: (err) => {
        console.error('Error al guardar especialidad:', err);
        this.showModalEspecialidad = false;
        this.isSaving = false;
        this.cargarEspecialidades();
      },
    });
  }

  eliminarEspecialidad(id: number) {
    if (confirm('¿Eliminar esta especialidad?')) {
      this.apiService.eliminarEspecialidad(id).subscribe(() => this.cargarEspecialidades());
    }
  }

  isConsultorioEspSelected(id: number): boolean {
    return this.formEsp.consultorios_ids.includes(id);
  }

  toggleConsultorioEsp(id: number) {
    const idx = this.formEsp.consultorios_ids.indexOf(id);
    if (idx >= 0) {
      this.formEsp.consultorios_ids.splice(idx, 1);
    } else {
      this.formEsp.consultorios_ids.push(id);
    }
  }

  toggleSedeDropdown() {
    this.showSedeDropdown = !this.showSedeDropdown;
  }

  selectSede(id: number) {
    this.formEsp.id_sede = id;
    this.showSedeDropdown = false;
  }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(val: string) {
    this.searchFilter = val;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(val: string): string {
    const map: Record<string, string> = { todo: 'Todo', nombre: 'Nombre', apellido: 'Apellido', cedula: 'Cédula', especialidad: 'Especialidad', prefijo: 'Prefijo' };
    return map[val] || 'Filtrar';
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

  getConsultoriosEspLabel(ids: number[] | undefined): string {
    if (!ids || ids.length === 0) return 'SIN ASIGNAR';
    return ids.map(id => {
      const con = this.consultorios.find(c => c.id == id);
      return con ? con.nombre.toUpperCase() : `#${id}`;
    }).join(', ');
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
    if (!target.closest('.sede-dropdown-container')) this.showSedeDropdown = false;
  }

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

  trackById = (index: number, item: EspecialidadDTO) => item?.id ?? item?.id_especialidad ?? index;
}
