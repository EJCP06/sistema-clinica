import { Component, inject, OnInit, HostListener, DestroyRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
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
  CircleX,
  CircleCheck,
  Check,
  MapPin,
  Upload,
  Info,
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
/**
 * Panel de administración de especialidades médicas.
 * Gestiona el catálogo de especialidades, su relación con consultorios
 * y la importación masiva desde archivo Excel.
 */
export class AdminEspecialidades implements OnInit {
  readonly Plus = Plus;
  readonly Trash2 = Trash2;
  readonly ChevronDown = ChevronDown;
  readonly ChevronUp = ChevronUp;
  readonly Stethoscope = Stethoscope;
  readonly Search = Search;
  readonly Edit2 = Edit2;
  readonly XCircle = CircleX;
  readonly CheckCircle2 = CircleCheck;
  readonly Check = Check;
  readonly MapPin = MapPin;
  readonly Upload = Upload;
  readonly Info = Info;

  pageSize = 6;
  currentPage = 1;

  private readonly auth = inject(AuthService);
  private readonly apiService = inject(ApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly swal = inject(SwalService);
  private readonly zone = inject(NgZone);

  consultorios: ConsultorioDTO[] = [];
  especialidades: EspecialidadDTO[] = [];
  sedes: SedeDTO[] = [];
  cargando: boolean = true;

  searchQuery = '';
  searchFilter = 'todo';
  showSearchFilterDropdown = false;
  showSedeDropdown = false;

  getSedeNombre(id_sede: number | string | null | undefined, forDropdown = false): string {
    if (id_sede === undefined || id_sede === null || id_sede === '') return this.etiquetaSede(forDropdown);
    const finalId = Number(id_sede);
    if (Number.isNaN(finalId)) return this.etiquetaSede(forDropdown);
    const sede = this.sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    if (!sede) return this.etiquetaSede(forDropdown);
    return forDropdown ? this.formatearSedeNombreDropdown(sede.nombre) : this.formatearSedeNombreValor(sede.nombre);
  }

  getSedeIdByName(nombre: string): number | null {
    if (!nombre) return null;
    const normalized = nombre.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const sede = this.sedes.find((s) => 
      (s.nombre || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '') === normalized
    );
    return sede ? Number(sede.id_sede || sede.id) : null;
  }

  showModalEspecialidad = false;
  showPreviewModal = false;
  previewData: any[] = [];

  showExcelFormat = false;
  isImporting = false;
  isEditing = false;
  editingId: number | null = null;
  isSaving = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;

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

  /** Inicializa cargando especialidades, consultorios y sedes. */
  ngOnInit() {
    this.cargarEspecialidades();
    this.cargarConsultorios();
    this.cargarSedes();
  }

  cargarEspecialidades() {
    this.cargando = true;
    this.apiService.getEspecialidades().subscribe((esps) => { this.especialidades = esps; this.cargando = false; });
  }

  cargarConsultorios() {
    this.apiService.getConsultorios().subscribe((cons) => {
      this.consultorios = [...cons].sort((a, b) => a.nombre.localeCompare(b.nombre, undefined, { numeric: true }));
    });
  }

  cargarSedes() {
    this.apiService.getSedes().subscribe({
      next: (s) => { this.sedes = [...s].sort((a, b) => Number(a.id_sede) - Number(b.id_sede)); },
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
        consultorios_ids: [...(esp.consultorios_ids || [])],
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
      id_servicio: this.formEsp.id_servicio,
      };
    }
    this.showModalEspecialidad = true;
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => {
      if (accion) accion();
      this.isSaving = false;
    }, restante);
  }

  guardarEsp() {
    if (this.isSaving) return;
    this.isSaving = true;
    this.inicioGuardado = Date.now();
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
        this.finalizarGuardado(() => {
          this.showModalEspecialidad = false;
          this.formEsp = { nombre: '', codigo: '', prefijo: '', piso: '', consultorios_ids: [], descripcion: '', activo: true, id_sede: '', id_servicio: 1 };
          this.cargarEspecialidades();
          this.swal.success('Especialidad guardada correctamente');
        });
      },
      error: (err) => {
        this.finalizarGuardado(() => {
          console.error('Error al guardar especialidad:', err);
          this.swal.error(err.error?.mensaje || 'Error al guardar especialidad');
        });
      },
    });
  }

  async eliminarEspecialidad(id: number) {
    const result = await this.swal.confirmDelete('¿Eliminar esta especialidad?');
    if (!result.isConfirmed) return;
    this.apiService.eliminarEspecialidad(id).subscribe({
      next: () => {
        this.cargarEspecialidades();
        this.swal.success('Especialidad eliminada correctamente');
      },
      error: () => {
        this.swal.error('Error al eliminar especialidad');
      },
    });
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

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

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
    if (id === undefined || id === null || id === '') return this.etiquetaSede(forDropdown);
    const finalId = Number(id);
    if (Number.isNaN(finalId)) return this.etiquetaSede(forDropdown);
    const sede = this.sedes.find((s) => Number(s.id_sede) === finalId || Number(s.id) === finalId);
    if (!sede) return this.etiquetaSede(forDropdown);
    return forDropdown ? this.formatearSedeNombreDropdown(sede.nombre) : this.formatearSedeNombreValor(sede.nombre);
  }

  private etiquetaSede(forDropdown: boolean): string {
    return forDropdown ? 'Seleccione...' : 'SIN ASIGNAR';
  }

  private formatearSedeNombreDropdown(nombre: string): string {
    return this.toTitleCase(nombre);
  }

  private formatearSedeNombreValor(nombre: string): string {
    return nombre.toUpperCase();
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
    if (event.key.length === 1 && !pattern.test(event.key)) event.preventDefault();
  }

  soloNumeros(event: KeyboardEvent) {
    const pattern = /\d/;
    if (event.key.length === 1 && !pattern.test(event.key)) event.preventDefault();
  }

  importExcel(fileInput: HTMLInputElement) {
    const file = fileInput?.files?.[0];
    if (!file) return;

    this.showExcelFormat = false;
    this.isImporting = true;

    void this.procesarExcelEspecialidades(file);

    fileInput.value = '';
  }

  private readonly consultorioMap: Map<string, number> = new Map();

  private async procesarExcelEspecialidades(file: File) {
    try {
      const XLSX = await import('xlsx');
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(new Uint8Array(data), { type: 'array' });
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
        nombre: ['nombre de la especialidad', 'nombre especialidad', 'nombre', 'especialidad'],
        prefijo: ['prefijo', 'prefix', 'codigo', 'código'],
        piso: ['piso', 'floor'],
        consultorio: ['consultorio', 'consultorios', 'consultorio(s)'],
        sede: ['sede', 'sucursal', 'id_sede'],
      };

      const actualHeaders = Object.keys(rowsRaw[0]).map((header) => this.normalizarClave(header));
      const missing: string[] = [];
      for (const standardKey of Object.keys(headerMap)) {
        const synonyms = headerMap[standardKey];
        let found = false;
        for (const header of actualHeaders) {
          if (synonyms.includes(header)) {
            found = true;
            break;
          }
        }
        if (!found) missing.push(standardKey);
      }

      if (missing.length > 0) {
        this.zone.run(() => {
          this.isImporting = false;
          this.swal.error('Al archivo Excel le faltan columnas requeridas');
        });
        return;
      }

      this.zone.run(() => {
        this.previewData = rowsRaw.map((row) => this.normalizarFilaEspecialidad(row, headerMap));
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
  }

  private normalizarFilaEspecialidad(row: Record<string, unknown>, headerMap: Record<string, string[]>): Record<string, unknown> {
    const normalizedRow: Record<string, unknown> = {};
    for (const [standardKey, synonyms] of Object.entries(headerMap)) {
      let foundHeader: string | undefined;
      for (const header of Object.keys(row)) {
        if (synonyms.includes(this.normalizarClave(header))) {
          foundHeader = header;
          break;
        }
      }
      normalizedRow[standardKey] = foundHeader ? row[foundHeader] : '';
    }
    return normalizedRow;
  }

  private normalizarClave(value: string): string {
    return value.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  private buildConsultorioMap() {
    this.consultorioMap.clear();
    for (const c of this.consultorios) {
      const nombreNorm = (c.nombre || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      this.consultorioMap.set(nombreNorm, c.id);
    }
  }

  private parseConsultorios(val: string): number[] {
    if (!val?.toString().trim()) return [];
    const parts = val.toString().split(',').map((s) => s.trim()).filter(Boolean);
    const ids: number[] = [];
    for (const part of parts) {
      const nombreNorm = part.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const mappedId = this.consultorioMap.get(nombreNorm);
      if (mappedId) {
        ids.push(mappedId);
      }
    }
    return ids;
  }

  confirmarImportacion() {
    if (this.isSaving) return;
    this.isSaving = true;
    const inicio = Date.now();
    this.buildConsultorioMap();

    const mappedData = this.previewData.map(row => {
      const consultoriosIds = this.parseConsultorios(row.consultorio);
      const sedeId = row.sede ? this.getSedeIdByName(row.sede) : 1;
      return {
        nombre: row.nombre,
        prefijo: row.prefijo || '',
        piso: row.piso || '',
        consultorios_ids: consultoriosIds,
        id_sede: sedeId || 1,
        activo: true,
      };
    });

    this.apiService.importarEspecialidades({ rows: mappedData }).subscribe({
      next: (res: any) => {
        const restante = Math.max(0, 800 - (Date.now() - inicio));
        setTimeout(() => {
          this.cargarEspecialidades();
          this.swal.success(res.mensaje || `Importación exitosa: ${res.importados || this.previewData.length} registros`);
          this.showPreviewModal = false;
          this.previewData = [];
          this.isSaving = false;
        }, restante);
      },
      error: (err) => {
        const restante = Math.max(0, 800 - (Date.now() - inicio));
        setTimeout(() => {
          this.swal.error(err.error?.mensaje || 'Error al importar datos');
          this.isSaving = false;
        }, restante);
      },
    });
  }

  trackById = (index: number, item: EspecialidadDTO) => item?.id ?? item?.id_especialidad ?? index;
}
