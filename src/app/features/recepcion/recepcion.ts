import {
  Component,
  OnInit,
  OnDestroy,
  HostListener,
  ElementRef,
  inject,
  ChangeDetectorRef,
  ApplicationRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  LucideAngularModule,
  Search,
  UserPlus,
  Plus,
  FileText,
  CheckCircle2,
  ChevronRight,
  User,
  Phone,
  CreditCard,
  Stethoscope,
  ChevronDown,
  XCircle,
  ShieldCheck,
  ClipboardList,
  Edit2,
  Trash2,
  Upload,
  Info,
} from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { EspecialidadesService } from '../../core/services/especialidades.service';
import { ScrollService } from '../../core/services/scroll.service';
import { Subject, Subscription, of } from 'rxjs';
import { debounceTime, catchError } from 'rxjs/operators';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';
import { SedeDTO } from '@core/models/dto.models';

@Component({
  selector: 'app-recepcion',
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
  ],
  templateUrl: './recepcion.html',
})
/**
 * Componente de admisión y recepción de pacientes.
 * Gestiona registro de pacientes, asignación de turnos,
 * búsqueda, edición y eliminación de admisiones activas,
 * así como la administración de aseguradoras.
 */
export class RecepcionComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly UserPlus = UserPlus;
  readonly Plus = Plus;
  readonly FileText = FileText;
  readonly CheckCircle2 = CheckCircle2;
  readonly ChevronRight = ChevronRight;
  readonly User = User;
  readonly Phone = Phone;
  readonly CreditCard = CreditCard;
  readonly Stethoscope = Stethoscope;
  readonly ChevronDown = ChevronDown;
  readonly XCircle = XCircle;
  readonly ShieldCheck = ShieldCheck;
  readonly ClipboardList = ClipboardList;
  readonly Edit2 = Edit2;
  readonly Trash2 = Trash2;
  readonly Upload = Upload;
  readonly Info = Info;

  pageSize: number = 9;
  currentPage: number = 1;

  sidebarOpen: boolean = false;
  cedulaBusqueda: string = '';
  buscando: boolean = false;
  cargando: boolean = true;
  filaEnEdicion: any = null;

  searchFilter: string = 'todo'; // 'todo', 'nombre', 'apellido', 'cedula'
  showSearchFilterDropdown: boolean = false;
  showPayerDropdown: boolean = false;
  showServiceDropdown: boolean = false;

  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private busquedaSubscription?: Subscription;
  mostrarResultadosBusqueda: boolean = false;

  pacientesEncontrados: any[] = [];
  pacienteEncontrado: any = null;
nuevoPaciente: any = {
    cedula: '',
    nombre: '',
    apellido: '',
    primer_nombre: '',
    segundo_nombre: '',
    primer_apellido: '',
    segundo_apellido: '',
    fecha_nacimiento: '',
    telefono: '',
    status: true,
  };

  get nombreCompleto(): string {
    const p = this.nuevoPaciente;
    const nombres = [p.primer_nombre, p.segundo_nombre].filter(Boolean).join(' ');
    const apellidos = [p.primer_apellido, p.segundo_apellido].filter(Boolean).join(' ');
    return [nombres, apellidos].filter(Boolean).join(' ').trim();
  }

  servicios: any[] = [];
  especialidades: any[] = [];
  responsables: any[] = [];
  ultimasAdmisiones: any[] = [];

  aseguradoras: any[] = [];
  medicos: any[] = [];
  consultorios: any[] = [];
  sedes: SedeDTO[] = [];

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  get admisionesFiltradas() {
    if (this.isAseguradorasView) {
      const query = (this.cedulaBusqueda || '').trim().toLowerCase();
      return this.aseguradoras.filter((a) => {
        if (!query) return true;
        const matchNombre = (a.aseguradora || '').toLowerCase().includes(query);
        const matchTipo = (a.tipo || '').toLowerCase().includes(query);
        if (this.searchFilter === 'nombre') return matchNombre;
        return matchNombre || matchTipo;
      });
    }

    const baseFiltered = this.ultimasAdmisiones.filter((a) => {
      const query = (this.cedulaBusqueda || '').trim().toLowerCase();
      if (!query) return true;

      const matchNombre = (a.nombre || '').toLowerCase().includes(query);
      const matchApellido = (a.apellido || '').toLowerCase().includes(query);
      const matchCedula = (a.cedula || '').toLowerCase().includes(query);

      if (this.searchFilter === 'nombre') {
        return matchNombre;
      } else if (this.searchFilter === 'apellido') {
        return matchApellido;
      } else if (this.searchFilter === 'cedula') {
        return matchCedula;
      } else {
        return matchNombre || matchApellido || matchCedula;
      }
    });

    return baseFiltered;
  }

  seleccion: any = {
    id_servicio: null,
    id_responsable: null,
    id_cliente: null,
    id_atencion: null,
    id_especialidad: null,
    id_medico: null,
    id_consultorio: null,
    nombre_servicio_label: '',
    nombre_medico_label: '',
  };

  categoriaServicio: string = ''; // 'Consulta', 'Laboratorio', 'Imágenes'
  showEspecialidadDropdown: boolean = false;
  showMedicoDropdown: boolean = false;
  showAseguradoraDropdown: boolean = false;

  // ---- Autocomplete de los selects del modal (escribir para filtrar) ----
  aseguradoraFiltro: string = '';
  especialidadFiltro: string = '';
  medicoFiltro: string = '';
  aseguradoraIndex: number = -1;
  especialidadIndex: number = -1;
  medicoIndex: number = -1;

  get aseguradorasFiltradas(): any[] {
    const q = (this.aseguradoraFiltro || '').trim().toLowerCase();
    return this.aseguradoras.filter((a: any) => !q || (a.aseguradora || '').toLowerCase().includes(q));
  }

  get especialidadesFiltradas(): any[] {
    const q = (this.especialidadFiltro || '').trim().toLowerCase();
    return this.getEspecialidades().filter((s: any) => !q || (s.nombre || s.nombre_servicio || '').toLowerCase().includes(q));
  }

  get medicosConFiltro(): any[] {
    const q = (this.medicoFiltro || '').trim().toLowerCase();
    return this.medicosFiltrados.filter((m: any) => !q || ((m.nombre || '') + ' ' + (m.apellido || '')).toLowerCase().includes(q));
  }

  onAseguradoraInput(event: Event) {
    this.aseguradoraFiltro = (event.target as HTMLInputElement).value;
    this.showAseguradoraDropdown = true;
    this.aseguradoraIndex = -1;
  }

  onAseguradoraKeydown(event: KeyboardEvent) {
    const list = this.aseguradorasFiltradas;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showAseguradoraDropdown = true;
      if (list.length) this.aseguradoraIndex = (this.aseguradoraIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.aseguradoraIndex = (this.aseguradoraIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showAseguradoraDropdown && list[this.aseguradoraIndex]) {
        this.selectAseguradora(list[this.aseguradoraIndex].id_cliente);
      }
    } else if (event.key === 'Escape') {
      this.showAseguradoraDropdown = false;
    }
  }

  onEspecialidadInput(event: Event) {
    this.especialidadFiltro = (event.target as HTMLInputElement).value;
    this.showEspecialidadDropdown = true;
    this.especialidadIndex = -1;
  }

  onEspecialidadKeydown(event: KeyboardEvent) {
    const list = this.especialidadesFiltradas;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showEspecialidadDropdown = true;
      if (list.length) this.especialidadIndex = (this.especialidadIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.especialidadIndex = (this.especialidadIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showEspecialidadDropdown && list[this.especialidadIndex]) {
        this.selectEspecialidad(list[this.especialidadIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showEspecialidadDropdown = false;
    }
  }

  onMedicoInput(event: Event) {
    this.medicoFiltro = (event.target as HTMLInputElement).value;
    this.showMedicoDropdown = true;
    this.medicoIndex = -1;
  }

  onMedicoKeydown(event: KeyboardEvent) {
    const list = this.medicosConFiltro;
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.showMedicoDropdown = true;
      if (list.length) this.medicoIndex = (this.medicoIndex + 1) % list.length;
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (list.length) this.medicoIndex = (this.medicoIndex - 1 + list.length) % list.length;
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (this.showMedicoDropdown && list[this.medicoIndex]) {
        this.selectMedico(list[this.medicoIndex]);
      }
    } else if (event.key === 'Escape') {
      this.showMedicoDropdown = false;
    }
  }

  isSaving: boolean = false;
  private inicioGuardado: number = 0;
  private readonly MIN_GUARDADO = 800;
  private _mostrarRegistro: boolean = false;
  isEditMode: boolean = false;

  esRegistroDirecto: boolean = false;
  pacienteExistenteCargado: boolean = false;

  pageTitle: string = 'Admisión de Pacientes';
  pageSubtitle: string = 'Gestión de entrada y asignación de turnos médicos';
  isAseguradorasView: boolean = false;

  private el = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private appRef = inject(ApplicationRef);
  private route = inject(ActivatedRoute);
  private espService = inject(EspecialidadesService);
  private swal = inject(SwalService);
  private scrollService = inject(ScrollService);
  private auth = inject(AuthService);

  tienePermiso(permiso: string): boolean {
    return this.auth.tienePermiso(permiso);
  }
  esCoordinador(): boolean {
    return this.auth.esCoordinador();
  }

  constructor(
    private api: ApiService,
    private router: Router,
  ) {}

  get mostrarRegistro() {
    return this._mostrarRegistro;
  }

  set mostrarRegistro(v: boolean) {
    const wasOpen = this._mostrarRegistro;
    this._mostrarRegistro = v;
    if (v) {
      this.scrollService.block();
    } else {
      this.scrollService.unblock();
    }
  }

  showPreviewModal = false;
  previewData: any[] = [];

  showExcelFormat = false;
  isImporting = false;

  /**
   * Retorna el nombre de la sede en mayúsculas o 'SIN ASIGNAR'.
   * @param id_sede - ID de la sede (acepta number, string, null, undefined)
   */
  getSedeNombre(id_sede: number | string | null | undefined): string {
    if (id_sede === undefined || id_sede === null || id_sede === '') return 'SIN ASIGNAR';
    const finalId = Number(id_sede);
    if (isNaN(finalId)) return 'SIN ASIGNAR';
    const sede = this.sedes.find(
      (s: SedeDTO) => Number(s.id_sede) === finalId || Number(s.id) === finalId,
    );
    if (!sede) return 'SIN ASIGNAR';
    return sede.nombre.toUpperCase();
  }

  confirmarImportacion() {
    if (this.isSaving) return;
    this.isSaving = true;
    const inicio = Date.now();

    this.api.importarAseguradoras({ rows: this.previewData }).subscribe({
      next: (res: any) => {
        const restante = Math.max(0, 800 - (Date.now() - inicio));
        setTimeout(() => {
          this.cargarAseguradoras();
          this.swal.success(
            res.mensaje ||
              `Importación exitosa: ${res.importados || this.previewData.length} registros`,
          );
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

  private modalTrigger: HTMLElement | null = null;

  abrirModalRegistro(trigger?: EventTarget | null) {
    if (!this.isEditMode) {
      this.prepararNuevoPaciente();
    }
    this.modalTrigger = trigger instanceof HTMLElement ? trigger : null;
    this.mostrarRegistro = true;
  }

  cerrarModalRegistro() {
    this.mostrarRegistro = false;
    this.modalTrigger = null;
    this.isEditMode = false;
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false;
      this.showPayerDropdown = false;
      this.showServiceDropdown = false;
      this.showEspecialidadDropdown = false;
      this.showAseguradoraDropdown = false;
      this.mostrarResultadosBusqueda = false; // Se oculta al hacer clic fuera
    } else {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!target.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!target.closest('.especialidad-dropdown-container'))
        this.showEspecialidadDropdown = false;
      if (!target.closest('.medico-dropdown-container')) this.showMedicoDropdown = false;
      if (!target.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false;
    }
  }

  private cambiosSub?: Subscription;

  /** Inicializa el componente: carga datos maestros, admisiones/aseguradoras y suscripciones. */
  ngOnInit() {
    const data = this.route.snapshot.data;
    this.pageTitle = data['pageTitle'] || this.pageTitle;
    this.pageSubtitle = data['pageSubtitle'] || this.pageSubtitle;
    this.isAseguradorasView = !!data['aseguradorasMode'];

    this.cargarDatosMaestros();
    if (this.isAseguradorasView) {
      this.cargarAseguradoras();
    } else {
      this.cargarUltimasAdmisiones();
    }

    this.cambiosSub = this.api.cambios$.subscribe((event: any) => {
      if (this.isAseguradorasView) {
        this.cargarAseguradoras();
      } else if (event?.admision) {
        if (event.tipo === 'retirado') {
          this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== event.admision.id_atencion);
        } else if (event.tipo === 'estado-cambiado') {
          if ([6, 9].includes(Number(event.id_estado_nuevo))) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== event.admision.id_atencion);
          } else if (Number(event.id_estado_nuevo) === 3) {
            this.ultimasAdmisiones = [event.admision, ...this.ultimasAdmisiones].slice(0, 50);
          }
        }
      } else if (event.tipo === 'retirado' || event.tipo === 'liberacion') {
        const id = Number(event.id_atencion);
        if (!isNaN(id)) {
          this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== id);
        } else {
          this.cargarUltimasAdmisiones();
        }
      } else if (event.tipo === 'estado-cambiado') {
        if ([6, 9].includes(Number(event.id_estado_nuevo))) {
          const id = Number(event.id_atencion);
          if (!isNaN(id)) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== id);
          } else {
            this.cargarUltimasAdmisiones();
          }
        }
      } else {
        this.cargarUltimasAdmisiones();
      }
    });

    this.searchSubscription = this.searchSubject.pipe(debounceTime(80)).subscribe((value) => {
      if (!value || value.trim().length < 1) {
        this.resetSearchOnly();
      } else {
        this.ejecutarBusqueda(value);
      }
    });
  }

  ngOnDestroy() {
    this.cambiosSub?.unsubscribe();
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
    }
  }

  onTabChange(tab: string) {
    if (tab === 'dashboard') this.router.navigate(['/administrador']);
    if (tab === 'panel-medico') this.router.navigate(['/panel-medico']);
  }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(filter: string) {
    this.searchFilter = filter;
    this.showSearchFilterDropdown = false;
    if (this.cedulaBusqueda.trim().length > 0) {
      this.onSearchChange(this.cedulaBusqueda);
    }
  }

  getSearchFilterLabel(): string {
    const labels: Record<string, string> = {
      todo: 'TODO',
      nombre: 'NOMBRES',
      apellido: 'APELLIDOS',
      cedula: 'CÉDULA',
    };
    return labels[this.searchFilter] || 'TODO';
  }

  /** Carga servicios, especialidades, aseguradoras, responsables, médicos y consultorios. */
  cargarDatosMaestros() {
    this.api.getServicios().subscribe({
      next: (data: any) => {
        this.servicios = data;
      },
      error: (err: any) => console.error('Error cargando servicios:', err),
    });

    this.espService.getAllEspecialidades().subscribe({
      next: (data: any) => {
        this.especialidades = data;
        if (this.especialidades.length === 0) {
          console.warn('¡ADVERTENCIA: No se cargaron especialidades!');
        }
      },
      error: (err: any) => {
        console.error('Error cargando especialidades:', err);
      },
    });

    this.cargarAseguradoras();

    this.api.get('recepcion/responsables-pago').subscribe({
      next: (data: any) => (this.responsables = data),
      error: (err: any) => console.error('Error cargando responsables:', err),
    });

    this.api.getPersonal('medico').subscribe({
      next: (data: any) => {
        this.medicos = data;
      },
      error: (err: any) => console.error('Error cargando médicos:', err),
    });

    this.api.getConsultorios().subscribe({
      next: (data: any) => {
        this.consultorios = data;
      },
      error: (err: any) => console.error('Error cargando consultorios:', err),
    });
  }

  /** Obtiene las últimas admisiones activas (excluye estados finales como ATENDIDO, AUSENTE). */
  cargarUltimasAdmisiones() {
    this.cargando = true;
    this.api.get<any[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => {
        const ahora = new Date();
        const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

        this.ultimasAdmisiones = (data || []).filter((admision: any) => {
          const estadoActual = admision.id_estado_actual;
          return (
            estadoActual !== 5 && estadoActual !== 6 && estadoActual !== 7 && estadoActual !== 9
          );
        });
        this.cargando = false;

        this.appRef.tick();
      },
      error: (err: any) => {
        this.cargando = false;
        console.error('Error cargando ultimas admisiones:', err);
      },
    });
  }

  cargarAseguradoras() {
    this.cargando = true;
    this.api.getAseguradoras().subscribe({
      next: (data: any[]) => {
        this.aseguradoras = data;
        this.cargando = false;
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;
        console.error('Error cargando aseguradoras:', err);
      },
    });
  }

  importarAseguradorasExcel(fileInput: HTMLInputElement) {
    const file = fileInput?.files?.[0];
    if (!file) return;
    this.showExcelFormat = false;
    this.isImporting = true;

    import('xlsx')
      .then((XLSX) => {
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

            const headerMap: Record<string, string[]> = {
              nombre: ['nombre de la aseguradora', 'nombre de aseguradora', 'nombre aseguradora', 'nombre', 'aseguradora'],
              tipo: ['tipo', 'type'],
            };

            const actualHeaders = Object.keys(rowsRaw[0]).map(h =>
              h.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            );

            const missing = Object.keys(headerMap).filter(standardKey => {
              const synonyms = headerMap[standardKey];
              return !actualHeaders.some(h => synonyms.includes(h));
            });

            if (missing.length > 0) {
              this.isImporting = false;
              this.swal.error('Al archivo Excel le faltan columnas requeridas');
              return;
            }

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
      })
      .catch(() => {
        this.isImporting = false;
        this.swal.error('Error al cargar el lector de Excel');
      });

    fileInput.value = '';
  }

  onSearchChange(value: string) {
    if (!value || value.trim().length < 1) {
      this.resetSearchOnly();
    } else {
      this.searchSubject.next(value);
    }
  }

  ejecutarBusqueda(value: string) {
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
    }

    this.buscando = true;
    this.pacientesEncontrados = [];

    const filtro = this.searchFilter !== 'todo' ? `?filtro=${this.searchFilter}` : '';
    this.busquedaSubscription = this.api
      .get<any[]>(`recepcion/pacientes/${value}${filtro}`)
      .subscribe({
        next: (data) => {
          if (!this.cedulaBusqueda || this.cedulaBusqueda.trim().length < 1) {
            return;
          }
          this.pacientesEncontrados = data || [];
          this.mostrarResultadosBusqueda = data && data.length > 0;
          this.buscando = false;
        },
        error: (err: any) => {
          this.buscando = false;
          this.pacientesEncontrados = [];
          this.mostrarResultadosBusqueda = false;
        },
      });
  }

  resetSearchOnly() {
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
      this.busquedaSubscription = undefined;
    }
    this.pacientesEncontrados = [];
    this.buscando = false;
    this.mostrarResultadosBusqueda = false;
  }

  onSearchFocus() {
    if (this.pacientesEncontrados.length > 0) {
      this.mostrarResultadosBusqueda = true;
    }
  }

  onSearchBlur() {
    setTimeout(() => {
      this.mostrarResultadosBusqueda = false;
    }, 200);
  }

  prepararNuevoPaciente() {
    this.filaEnEdicion = null;
    this.pacienteExistenteCargado = false;
    this.esRegistroDirecto = true;
    this.isEditMode = false;
    this.nuevoPaciente = {
      id_paciente: null,
      cedula: '',
      nombre: '',
      apellido: '',
      telefono: '',
      fecha_nacimiento: '',
      status: true,
    };
    this.seleccion = {
      id_servicio: null,
      id_responsable: this.isAseguradorasView ? 2 : null,
      id_cliente: null,
      id_atencion: null,
      id_especialidad: null,
      id_medico: null,
      id_consultorio: null,
      nombre_servicio_label: '',
      nombre_medico_label: '',
    };
    this.categoriaServicio = '';
    this.aseguradoraFiltro = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';

    if (this.cedulaBusqueda && this.cedulaBusqueda.trim().length > 0) {
      const val = this.cedulaBusqueda.trim();
      if (this.searchFilter === 'cedula' || (!isNaN(Number(val)) && this.searchFilter === 'todo')) {
        this.nuevoPaciente.cedula = val;
        this.onCedulaFormChange(val);
      } else if (this.searchFilter === 'nombre') {
        this.nuevoPaciente.primer_nombre = val.toUpperCase();
      } else if (this.searchFilter === 'apellido') {
        this.nuevoPaciente.primer_apellido = val.toUpperCase();
      }
    }
  }

  onCedulaFormChange(cedula: string) {
    if (this.isEditMode) return;
    if (!cedula || cedula.trim().length < 2) {
      this.pacienteExistenteCargado = false;
      this.nuevoPaciente.id_paciente = null;
      return;
    }
    this.api.get<any[]>(`recepcion/pacientes/${cedula}`).subscribe({
      next: (data) => {
        const p = data ? data.find((paciente: any) => paciente.cedula === cedula) : null;

        if (p) {
          this.pacienteExistenteCargado = true;
          this.nuevoPaciente.id_paciente = p.id_paciente || p.id;
          this.nuevoPaciente.cedula = p.cedula;
          this.nuevoPaciente.primer_nombre = p.primer_nombre || p.nombre || '';
          this.nuevoPaciente.segundo_nombre = p.segundo_nombre || '';
          this.nuevoPaciente.primer_apellido = p.primer_apellido || p.apellido || '';
          this.nuevoPaciente.segundo_apellido = p.segundo_apellido || '';
          this.nuevoPaciente.fecha_nacimiento = this.fechaADisplay(p.fecha_nacimiento);
          this.nuevoPaciente.telefono = p.telefono;
        } else {
          if (this.nuevoPaciente.id_paciente) {
            this.nuevoPaciente.primer_nombre = '';
            this.nuevoPaciente.segundo_nombre = '';
            this.nuevoPaciente.primer_apellido = '';
            this.nuevoPaciente.segundo_apellido = '';
            this.nuevoPaciente.fecha_nacimiento = '';
            this.nuevoPaciente.telefono = '';
          }
          this.pacienteExistenteCargado = false;
          this.nuevoPaciente.id_paciente = null;
        }
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.pacienteExistenteCargado = false;
        this.nuevoPaciente.id_paciente = null;
      },
    });
  }

  seleccionarPaciente(paciente: any) {
    this.mostrarResultadosBusqueda = false;
    this.pacienteExistenteCargado = true;
    this.isEditMode = false;
    this.abrirModalRegistro();
    this.nuevoPaciente = {
      id_paciente: paciente.id_paciente || paciente.id,
      cedula: paciente.cedula,
      primer_nombre: paciente.primer_nombre || paciente.nombre || '',
      segundo_nombre: paciente.segundo_nombre || '',
      primer_apellido: paciente.primer_apellido || paciente.apellido || '',
      segundo_apellido: paciente.segundo_apellido || '',
      fecha_nacimiento: this.fechaADisplay(paciente.fecha_nacimiento),
      telefono: paciente.telefono,
      status: true,
    };
    this.seleccion = {
      id_servicio: null,
      id_responsable: null,
      id_cliente: null,
      id_atencion: null,
      id_especialidad: null,
      id_medico: null,
      id_consultorio: null,
      nombre_servicio_label: '',
      nombre_medico_label: '',
    };
    this.aseguradoraFiltro = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';
  }

  private finalizarGuardado(accion?: () => void) {
    const transcurrido = Date.now() - this.inicioGuardado;
    const restante = Math.max(0, this.MIN_GUARDADO - transcurrido);
    setTimeout(() => {
      if (accion) accion();
      this.isSaving = false;
    }, restante);
  }

  registrarYContinuar() {
    if (this.isAseguradorasView) {
      this.procesarAseguradora();
      return;
    }

    const fechaNacimiento = (this.nuevoPaciente.fecha_nacimiento || '').toString().trim();
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fechaNacimiento)) {
      this.swal.warning('La fecha de nacimiento es obligatoria (formato DD/MM/YYYY)');
      return;
    }

    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) {
      this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio');
      return;
    }

    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      this.swal.warning('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    this.isSaving = true;
    this.inicioGuardado = Date.now();

    if (this.isEditMode) {
      this.actualizarPacienteExistente(this.nuevoPaciente.id_paciente, true);
    } else if (this.pacienteExistenteCargado && this.nuevoPaciente.id_paciente) {
      this.generarAtencionDirecta(this.nuevoPaciente.id_paciente);
    } else {
      this.api.get<any[]>(`recepcion/pacientes/${this.nuevoPaciente.cedula}`).subscribe({
        next: (data) => {
          const p = data
            ? data.find((paciente: any) => paciente.cedula === this.nuevoPaciente.cedula)
            : null;
          if (p) {
            this.actualizarPacienteExistente(p.id_paciente || p.id, false);
          } else {
            this.crearNuevoPaciente();
          }
        },
        error: () => this.crearNuevoPaciente(),
      });
    }
  }

  /** Crea un nuevo paciente en el sistema y luego genera la atención. */
  private crearNuevoPaciente() {
    const datosPaciente = {
      cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, ''),
      primer_nombre: (this.nuevoPaciente.primer_nombre || '').toUpperCase().trim(),
      segundo_nombre: (this.nuevoPaciente.segundo_nombre || '').toUpperCase().trim(),
      primer_apellido: (this.nuevoPaciente.primer_apellido || '').toUpperCase().trim(),
      segundo_apellido: (this.nuevoPaciente.segundo_apellido || '').toUpperCase().trim(),
      fecha_nacimiento: this.fechaABackend(this.nuevoPaciente.fecha_nacimiento),
      telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, ''),
      status: true,
    };

    this.api.post('recepcion/pacientes', datosPaciente).subscribe({
      next: (paciente: any) => {
        this.generarAtencionDirecta(paciente.id_paciente || paciente.id);
      },
      error: (err: any) => {
        console.error('Error registrando:', err);
        this.finalizarGuardado(() => {
          if (err.status === 409) {
            this.swal.error('El paciente con esta cédula ya está registrado en esta sede.');
          } else {
            this.swal.error('Error al registrar paciente');
          }
        });
      },
    });
  }

  private actualizarPacienteExistente(id_paciente: number, esEdicionTotal: boolean) {
    const datosPaciente = {
      cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim(),
      primer_nombre: (this.nuevoPaciente.primer_nombre || '').toString().toUpperCase().trim(),
      segundo_nombre: (this.nuevoPaciente.segundo_nombre || '').toString().toUpperCase().trim(),
      primer_apellido: (this.nuevoPaciente.primer_apellido || '').toString().toUpperCase().trim(),
      segundo_apellido: (this.nuevoPaciente.segundo_apellido || '').toString().toUpperCase().trim(),
      fecha_nacimiento: this.fechaABackend(this.nuevoPaciente.fecha_nacimiento),
      telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim(),
    };

    this.api.put(`recepcion/pacientes/${id_paciente}`, datosPaciente).subscribe({
      next: () => {
        if (esEdicionTotal) {
          const bodyAtencion = {
            id_servicio: this.seleccion.id_servicio,
            id_responsable: this.seleccion.id_responsable,
            id_cliente: this.seleccion.id_cliente,
            id_especialidad: this.seleccion.id_especialidad || null,
            id_medico: this.seleccion.id_medico || null,
            id_consultorio: this.seleccion.id_consultorio || null,
          };
          this.api.put(`recepcion/atencion/${this.seleccion.id_atencion}`, bodyAtencion).subscribe({
            next: () => {
              this.finalizarGuardado(() => {
                this.mostrarRegistro = false;
                this.swal.success('Cambios guardados con éxito');
                this.cargarUltimasAdmisiones();
                this.api.cambios$.next({ tipo: 'atencion-actualizada', id_atencion: this.seleccion.id_atencion });
              });
            },
            error: () =>
              this.finalizarGuardado(() => this.swal.error('Error al actualizar la atención')),
          });
        } else {
          this.generarAtencionDirecta(id_paciente);
        }
      },
      error: () =>
        this.finalizarGuardado(() => this.swal.error('Error al actualizar datos del paciente')),
    });
  }

  private procesarAseguradora() {
    const nombreAseguradora = (this.nuevoPaciente.nombre || '').toString().trim();
    if (!nombreAseguradora) {
      this.swal.warning('Debe ingresar el nombre de la aseguradora');
      return;
    }
    this.isSaving = true;
    this.inicioGuardado = Date.now();

    if (this.isEditMode && this.nuevoPaciente.id_cliente) {
      this.api
        .put(`admin/aseguradoras/${this.nuevoPaciente.id_cliente}`, { nombre: nombreAseguradora })
        .subscribe({
          next: () => {
            this.finalizarGuardado(() => {
              this.cargarAseguradoras();
              this.mostrarRegistro = false;
              this.swal.success('Aseguradora actualizada correctamente');
            });
          },
          error: () =>
            this.finalizarGuardado(() => this.swal.error('Error al actualizar aseguradora')),
        });
    } else {
      this.api.crearAseguradora({ nombre: nombreAseguradora }).subscribe({
        next: () => {
          this.finalizarGuardado(() => {
            this.cargarAseguradoras();
            this.mostrarRegistro = false;
            this.swal.success('Aseguradora registrada correctamente');
          });
        },
        error: () =>
          this.finalizarGuardado(() => this.swal.error('Error al registrar aseguradora')),
      });
    }
  }

  /** Genera un turno de atención para un paciente ya registrado. */
  generarAtencionDirecta(id_paciente: number) {
    const bodyTurno = {
      id_paciente: id_paciente,
      id_servicio: this.seleccion.id_servicio,
      id_responsable: this.seleccion.id_responsable,
      id_cliente: this.seleccion.id_cliente,
      id_especialidad: this.seleccion.id_especialidad || null,
      id_medico: this.seleccion.id_medico || null,
      id_consultorio: this.seleccion.id_consultorio || null,
    };

    this.api.post('recepcion/generar-turno', bodyTurno).subscribe({
      next: (res: any) => {
        this.finalizarGuardado(() => {
          this.mostrarRegistro = false;
          this.pacienteEncontrado = null;
          this.cedulaBusqueda = '';
          this.cdr.detectChanges();
          this.swal.success('Generado con éxito: ' + (res.numero || 'Listo'));
          this.cargarUltimasAdmisiones();
          this.api.cambios$.next({ tipo: 'nuevo-turno', id_atencion: res.id_atencion });
        });
      },
      error: (err: any) => {
        console.error('Error al generar turno directo:', err);
        this.finalizarGuardado(() => {
          this.swal.error('Error al asignar el servicio / generar turno.');
          this.cdr.detectChanges();
        });
      },
    });
  }

  generarAtencion() {
    if (!this.seleccion.id_servicio || !this.seleccion.id_responsable) {
      this.swal.warning('Debe seleccionar Especialidad y Responsable de Pago');
      return;
    }

    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      this.swal.warning('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    this.isSaving = true;
    this.inicioGuardado = Date.now();
    const bodyTurno = {
      id_paciente: this.pacienteEncontrado.id_paciente || this.pacienteEncontrado.id,
      id_servicio: this.seleccion.id_servicio,
      id_responsable: this.seleccion.id_responsable,
      id_cliente: this.seleccion.id_cliente,
      id_especialidad: this.seleccion.id_especialidad || null,
      id_medico: this.seleccion.id_medico || null,
      id_consultorio: this.seleccion.id_consultorio || null,
    };

    this.api.post('recepcion/generar-turno', bodyTurno).subscribe({
      next: (res: any) => {
        this.finalizarGuardado(() => {
          this.pacienteEncontrado = null;
          this.mostrarRegistro = false;
          this.cedulaBusqueda = '';
          this.cdr.detectChanges();
          this.swal.success('Turno / Servicio asignado con éxito: ' + (res.numero || 'Listo'));
          this.cargarUltimasAdmisiones();
          this.api.cambios$.next({ tipo: 'nuevo-turno', id_atencion: res.id_atencion });
        });
      },
      error: (err: any) => {
        console.error('Error al asignar servicio:', err);
        this.finalizarGuardado(() => {
          this.swal.error('Error al asignar el servicio');
          this.cdr.detectChanges();
        });
      },
    });
  }

  togglePayerDropdown() {
    this.showPayerDropdown = !this.showPayerDropdown;
  }

  selectPayer(id: number) {
    if (this.seleccion.id_responsable === id) {
      this.showPayerDropdown = false;
      return;
    }
    this.seleccion.id_responsable = id;
    this.showPayerDropdown = false;
    if (id !== 2) {
      this.seleccion.id_cliente = null;
    }
    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';
    this.categoriaServicio = '';
    this.aseguradoraFiltro = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';
  }

  toggleAseguradoraDropdown() {
    this.showAseguradoraDropdown = !this.showAseguradoraDropdown;
  }

  selectAseguradora(id: number) {
    this.seleccion.id_cliente = id;
    this.showAseguradoraDropdown = false;
    this.aseguradoraIndex = -1;
    const asig = this.aseguradoras.find((a) => a.id_cliente === id);
    this.aseguradoraFiltro = asig ? asig.aseguradora : '';
  }

  getNombreAseguradoraSeleccionada(id: any): string {
    if (!id) return 'Seleccione...';
    const asig = this.aseguradoras.find((a) => a.id_cliente === id);
    return asig ? asig.aseguradora : 'Seleccione...';
  }

  getNombreResponsable(id: any): string {
    if (!id) return 'Seleccione...';
    const rp = this.responsables.find((r) => r.id === id);
    const nombre = rp?.nombre || (id === 1 ? 'Particular' : id === 2 ? 'Seguro' : 'Seleccione...');
    return this.getResponsableLabel(nombre);
  }

  getAseguradoraNombre(admision: any): string {
    if (!admision || !admision.modalidad_pago) return 'SIN NOMBRE';
    return admision.modalidad_pago;
  }

  getResponsableLabel(value: any): string {
    if (!value || value === 'PENDIENTE') return 'SIN ASIGNAR';
    const val = value.toString().toUpperCase();
    if (val.includes('PARTICULAR')) return 'PARTICULAR';
    return 'ASEGURADORA';
  }

  getResponsableClass(value: any): string {
    const modalidad = (value || '').toString().trim().toLowerCase();
    if (modalidad.includes('particular')) return 'text-blue-600';
    if (modalidad.includes('seguro') || modalidad.includes('asegur')) return 'text-green-600';
    return 'text-slate-600 dark:text-slate-400';
  }

  getServicioCategoria(value: any): string {
    const servicio = (value || '').toString().trim().toLowerCase();
    if (servicio.includes('laboratorio')) return 'Laboratorio';
    if (
      servicio.includes('imágenes') ||
      servicio.includes('imagenes') ||
      servicio.includes('imagen')
    )
      return 'Imágenes';
    return 'Consulta';
  }

  toggleServiceDropdown() {
    this.showServiceDropdown = !this.showServiceDropdown;
  }

  private normalizeString(str: string): string {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }


  selectCategoria(categoria: string) {
    if (this.categoriaServicio === categoria) {
      this.showServiceDropdown = false;
      return;
    }
    this.categoriaServicio = categoria;
    this.showServiceDropdown = false;

    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';
    this.especialidadFiltro = '';
    this.medicoFiltro = '';

    if (categoria !== 'Consulta') {
      const normalizedSearch = this.normalizeString(categoria);
      const s = this.servicios.find((serv) => {
        const nombre = this.normalizeString(serv.nombre || serv.nombre_servicio || '');
        return nombre.includes(normalizedSearch);
      });

      if (s) {
        this.seleccion.id_servicio = s.id || s.id_servicio;
      } else {
        this.swal.warning(
          `El servicio de ${categoria} no está configurado para esta sede. Por favor, pida al administrador que lo cree.`,
        );
        this.categoriaServicio = '';
      }
    }
  }

  toggleEspecialidadDropdown() {
    this.showEspecialidadDropdown = !this.showEspecialidadDropdown;
  }

  selectEspecialidad(item: any) {
    if (this.categoriaServicio === 'Consulta') {
      this.seleccion.id_servicio = item.id_servicio;
      this.seleccion.id_especialidad = item.id_especialidad || item.id;
      this.seleccion.nombre_servicio_label = item.nombre || '';
      this.seleccion.id_medico = null;
      this.seleccion.id_consultorio = null;
      this.seleccion.nombre_medico_label = '';
    } else {
      this.seleccion.id_servicio = item.id || item.id_servicio;
      this.seleccion.id_especialidad = null;
      this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || '';
    }
    this.especialidadFiltro = item.nombre || item.nombre_servicio || '';
    this.especialidadIndex = -1;
      this.showEspecialidadDropdown = false;
    }

  getEspecialidades() {
    if (!this.categoriaServicio) {
      return this.especialidades.filter((e: any) => e.activo !== false);
    }

    if (this.categoriaServicio === 'Consulta') {
      return this.especialidades.filter((e: any) => e.activo !== false);
    }
    if (this.categoriaServicio === 'Laboratorio') {
      return this.servicios.filter((s) => {
        const n = (s.nombre || s.nombre_servicio || '').toLowerCase();
        return n.includes('laboratorio');
      });
    }
    if (this.categoriaServicio === 'Imágenes') {
      return this.servicios.filter((s) => {
        const n = (s.nombre || s.nombre_servicio || '').toLowerCase();
        return n.includes('imagen');
      });
    }
    return [];
  }

  get medicosFiltrados(): any[] {
    if (!this.seleccion.id_especialidad) return [];
    const target = Number(this.seleccion.id_especialidad);
    return this.medicos.filter((m: any) => {
      // Especialidad inactiva para este médico: no aparece en esa especialidad
      const inactivas = Array.isArray(m.especialidades_inactivas) ? m.especialidades_inactivas.map(Number) : [];
      if (inactivas.includes(target)) return false;
      const espId = Number(m.id_especialidad || m.especialidad_id);
      if (espId === target) return true;
      const extra = m.especialidades;
      return Array.isArray(extra) && extra.some((e: any) => Number(e) === target);
    });
  }

  toggleMedicoDropdown() {
    this.showMedicoDropdown = !this.showMedicoDropdown;
  }

  selectMedico(m: any) {
    this.seleccion.id_medico = m.id_usuario || m.id;
    this.seleccion.id_consultorio = m.id_consultorio || m.consultorio_id || null;
    this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim();
    this.medicoFiltro = this.seleccion.nombre_medico_label;
    this.medicoIndex = -1;
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
    const s = this.servicios.find((serv) => (serv.id || serv.id_servicio) === id);
    if (s) return s.nombre || s.nombre_servicio || 'Seleccione...';
    return 'Seleccione...';
  }

  editarFila(fila: any, trigger?: EventTarget | null) {
    this.filaEnEdicion = fila;
    this.isEditMode = true;
    if (this.isAseguradorasView) {
      this.isSaving = false;
      this.abrirModalRegistro(trigger);
      this.pacienteExistenteCargado = false;
      this.nuevoPaciente = {
        id_cliente: fila.id_cliente,
        nombre: fila.aseguradora,
        status: true,
      };
    } else {
      this.pacienteExistenteCargado = true;
      this.abrirModalRegistro(trigger);
      this.nuevoPaciente = {
        id_paciente: fila.id_paciente,
        cedula: fila.cedula,
        primer_nombre: fila.nombre,
        segundo_nombre: fila.segundo_nombre,
        primer_apellido: fila.apellido,
        segundo_apellido: fila.segundo_apellido,
        fecha_nacimiento: this.fechaADisplay(fila.fecha_nacimiento),
        telefono: fila.telefono,
      };

      this.seleccion = {
        id_servicio: fila.id_servicio,
        id_responsable: fila.id_responsable,
        id_cliente: fila.id_cliente,
        id_atencion: fila.id_atencion,
        id_especialidad: fila.id_especialidad,
        id_medico: fila.id_medico || null,
        id_consultorio: fila.id_consultorio || null,
        nombre_medico_label: fila.nombre_medico || '',
        nombre_servicio_label: '',
        nombre_especialidad_label: '',
      };

      this.categoriaServicio = this.getServicioCategoria(fila.nombre_servicio);

      const asig = this.aseguradoras.find((a) => a.id_cliente === fila.id_cliente);
      this.aseguradoraFiltro = asig ? asig.aseguradora : '';

      if (fila.id_especialidad) {
        const esp = this.especialidades.find(
          (e) => (e.id_especialidad || e.id) === fila.id_especialidad,
        );
        if (esp) {
          this.seleccion.nombre_especialidad_label = esp.nombre;
          this.especialidadFiltro = esp.nombre;
        }
      }

      this.medicoFiltro = fila.nombre_medico || (fila.id_medico ? this.getNombreMedicoLabel(fila.id_medico) : '');
    }
  }

  async eliminarFila(fila: any) {
    const msg = this.isAseguradorasView
      ? `¿Eliminar aseguradora ${fila.aseguradora}?`
      : `¿Eliminar admisión de ${fila.nombre} ${fila.apellido}?`;

    const result = await this.swal.confirmDelete(msg);
    if (!result.isConfirmed) return;
    if (this.isAseguradorasView) {
      this.api.delete(`admin/aseguradoras/${fila.id_cliente}`).subscribe({
        next: () => {
          this.cargarAseguradoras();
          this.swal.success('Aseguradora eliminada correctamente');
        },
        error: () => {
          this.swal.error('Error al eliminar');
        },
      });
    } else {
      if (fila.id_atencion) {
        this.api.delete(`recepcion/atencion/${fila.id_atencion}`).subscribe({
          next: () => {
            this.cargarUltimasAdmisiones();
            this.swal.success('Atención eliminada correctamente');
          },
          error: () => {
            this.swal.error('Error al eliminar atención');
          },
        });
      } else {
        this.api.delete(`recepcion/pacientes/${fila.id_paciente}`).subscribe({
          next: () => {
            this.cargarUltimasAdmisiones();
            this.swal.success('Paciente eliminado correctamente');
          },
          error: () => {
            this.swal.error('Error al eliminar paciente');
          },
        });
      }
    }
  }

  async marcarAusente(fila: any) {
    const result = await this.swal.confirm(
      '¿Marcar como ausente?',
      'Esta acción no se puede deshacer.',
    );
    if (!result.isConfirmed) return;

    this.api.put(`recepcion/atencion/${fila.id_atencion}/marcar_ausente`, {}).subscribe({
      next: () => {
        this.cargarUltimasAdmisiones();
        this.swal.success('Paciente marcado como ausente correctamente');
      },
      error: () => {
        this.swal.error('Error al marcar como ausente');
      },
    });
  }

  soloLetras(event: any) {
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

  trimCampo(event: Event) {
    const input = event.target as HTMLInputElement;
    input.value = input.value.trim();
    input.dispatchEvent(new Event('input'));
  }

  soloNumeros(event: any) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  onFechaNacimientoInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const cursorPos = input.selectionStart || 0;
    const resultado = this.aplicarCambioFecha(this.nuevoPaciente.fecha_nacimiento || '', input.value, cursorPos);
    this.nuevoPaciente.fecha_nacimiento = resultado.valor;
    input.value = resultado.valor;
    input.setSelectionRange(resultado.cursor, resultado.cursor);
  }

  private fechaADisplay(fecha: string): string {
    if (!fecha || fecha.length < 10) return fecha || '';
    const partes = fecha.substring(0, 10).split('-');
    if (partes.length !== 3) return fecha;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }

  private aplicarCambioFecha(displayAnterior: string, nuevoValor: string, cursorPos: number): { valor: string; cursor: number } {
    const viejo = this.obtenerSlots(displayAnterior);
    const nuevoDigitos = nuevoValor.replace(/\D/g, '').substring(0, 8);
    const viejoDigitos = viejo.filter(ch => /\d/.test(ch)).join('');

    if (nuevoDigitos.length === 0) {
      return { valor: '', cursor: 0 };
    }

    if (nuevoDigitos.length < viejoDigitos.length) {
      const cuantos = viejoDigitos.length - nuevoDigitos.length;
      const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
      const slots = viejo.slice();
      for (let i = cursorDigitos; i < cursorDigitos + cuantos && i < 8; i++) slots[i] = ' ';
      return { valor: this.reconstruir(slots), cursor: this.posicionDeSlot(cursorDigitos) };
    }

    if (nuevoDigitos.length === viejoDigitos.length) {
      const slots = viejo.map((ch, i) => /\d/.test(ch) ? nuevoDigitos[this.runIndex(i, viejo)] : ch);
      return { valor: this.reconstruir(slots), cursor: Math.min(cursorPos, 10) };
    }

    const added = nuevoDigitos.length - viejoDigitos.length;
    const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
    const insertSlot = Math.max(0, cursorDigitos - added);
    const slots = viejo.slice();
    let pos = insertSlot;
    let ultimoRellenado = -1;
    for (let k = insertSlot; k < insertSlot + added && k < 8; k++) {
      while (pos < 8 && /\d/.test(slots[pos])) pos++;
      if (pos >= 8) break;
      slots[pos] = nuevoDigitos[k];
      ultimoRellenado = pos;
      pos++;
    }
    const cursor = ultimoRellenado >= 0 ? this.posicionDeSlot(ultimoRellenado) + 1 : this.posicionDeSlot(insertSlot);
    return { valor: this.reconstruir(slots), cursor };
  }

  private obtenerSlots(display: string): string[] {
    if (!display) return Array(8).fill(' ');
    return [0, 1, 3, 4, 6, 7, 8, 9].map(i => display[i] ?? ' ');
  }

  private reconstruir(slots: string[]): string {
    return slots[0] + slots[1] + '/' + slots[2] + slots[3] + '/' + slots[4] + slots[5] + slots[6] + slots[7];
  }

  private posicionDeSlot(slotIndex: number): number {
    const posiciones = [0, 1, 3, 4, 6, 7, 8, 9];
    return posiciones[slotIndex] ?? 10;
  }

  private runIndex(slotIndex: number, viejo: string[]): number {
    let count = 0;
    for (let i = 0; i < slotIndex; i++) {
      if (/\d/.test(viejo[i])) count++;
    }
    return count;
  }

  private fechaABackend(fecha: string): string | null {
    if (!fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return null;
    const partes = fecha.split('/');
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
  }
}
