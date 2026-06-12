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
} from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { EspecialidadesService } from '../../core/services/especialidades.service';
import { ScrollService } from '../../core/services/scroll.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';


@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './recepcion.html',
})
export class RecepcionComponent implements OnInit, OnDestroy {
  // Iconos
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

  pageSize: number = 6;
  currentPage: number = 1;

  // Estados
  sidebarOpen: boolean = false;
  cedulaBusqueda: string = '';
  buscando: boolean = false;
  filaEnEdicion: any = null;

  // Filtro de Búsqueda
  searchFilter: string = 'todo'; // 'todo', 'nombre', 'apellido', 'cedula'
  showSearchFilterDropdown: boolean = false;
  showPayerDropdown: boolean = false;
  showServiceDropdown: boolean = false;

  // Live Search
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;
  private busquedaSubscription?: Subscription;
  mostrarResultadosBusqueda: boolean = false;

  // Datos
  pacientesEncontrados: any[] = [];
  pacienteEncontrado: any = null;
  nuevoPaciente: any = {
    cedula: '',
    nombre: '',
    apellido: '',
    telefono: '',
    status: true,
  };

  servicios: any[] = [];
  especialidades: any[] = [];
  responsables: any[] = [];
  ultimasAdmisiones: any[] = [];

  aseguradoras: any[] = [];
  medicos: any[] = [];
  consultorios: any[] = [];

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

  // Lógica de Categorías
  categoriaServicio: string = ''; // 'Consulta', 'Laboratorio', 'Imágenes'
  showEspecialidadDropdown: boolean = false;
  showMedicoDropdown: boolean = false;
  showAseguradoraDropdown: boolean = false;

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

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

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
      setTimeout(() => this.focusFirstInput(), 0);
    } else {
      this.scrollService.unblock();
      if (wasOpen) this.returnFocusToTrigger();
    }
  }

  private modalTrigger: HTMLElement | null = null;

  abrirModalRegistro(trigger?: EventTarget | null) {
    this.modalTrigger = trigger instanceof HTMLElement ? trigger : null;
    this.mostrarRegistro = true;
  }

  cerrarModalRegistro() {
    this.mostrarRegistro = false;
  }

  private focusFirstInput() {
    const modal = this.el.nativeElement.querySelector('[role="dialog"]');
    if (!modal) return;
    const firstInput = modal.querySelector(
      'input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
    ) as HTMLElement | null;
    if (firstInput) {
      firstInput.focus();
    }
  }

  private returnFocusToTrigger() {
    if (this.modalTrigger instanceof HTMLElement) {
      this.modalTrigger.focus();
      this.modalTrigger = null;
    }
  }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false;
      this.showPayerDropdown = false;
      this.showServiceDropdown = false;
      this.showEspecialidadDropdown = false;
      this.showAseguradoraDropdown = false;
    } else {
      // Si el click fue dentro, pero fuera de los contenedores específicos
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!target.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!target.closest('.especialidad-dropdown-container'))
        this.showEspecialidadDropdown = false;
      if (!target.closest('.medico-dropdown-container'))
        this.showMedicoDropdown = false;
      if (!target.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false;
    }
  }

  private cambiosSub?: Subscription;

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

    // Real-time updates via socket
    this.cambiosSub = this.api.cambios$.subscribe(() => {
      if (this.isAseguradorasView) {
        this.cargarAseguradoras();
      } else {
        this.cargarUltimasAdmisiones();
      }
    });

    // Setup live search
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(80))
      .subscribe((value) => {
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

  // --- FILTROS DE BÚSQUEDA ---
  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(filter: string) {
    this.searchFilter = filter;
    this.showSearchFilterDropdown = false;
    // Si ya hay algo escrito, rebuscar
    if (this.cedulaBusqueda.trim().length > 0) {
      this.onSearchChange(this.cedulaBusqueda);
    }
  }

  getSearchFilterLabel(): string {
    const labels: Record<string, string> = {
      todo: 'TODO',
      nombre: 'NOMBRE',
      apellido: 'APELLIDO',
      cedula: 'CÉDULA',
    };
    return labels[this.searchFilter] || 'TODO';
  }

  // --- LOGICA DE NEGOCIO ---

  cargarDatosMaestros() {
    this.api.getServicios().subscribe({
      next: (data: any) => {
        this.servicios = data;
        console.log('Servicios cargados:', this.servicios.length);
      },
      error: (err: any) => console.error('Error cargando servicios:', err)
    });
    
    this.espService.getAllEspecialidades().subscribe({
      next: (data: any) => {
        this.especialidades = data;
        console.log('Especialidades cargadas:', this.especialidades.length);
        if (this.especialidades.length === 0) {
          console.warn('¡ADVERTENCIA: No se cargaron especialidades!');
        }
      },
      error: (err: any) => {
        console.error('Error cargando especialidades:', err);
      }
    });
    
    this.cargarAseguradoras();

    this.api.get('recepcion/responsables-pago').subscribe({
      next: (data: any) => (this.responsables = data),
      error: (err: any) => console.error('Error cargando responsables:', err),
    });

    this.api.getPersonal('medico').subscribe({
      next: (data: any) => {
        this.medicos = data;
        console.log('Médicos cargados:', this.medicos.length);
      },
      error: (err: any) => console.error('Error cargando médicos:', err),
    });

    this.api.getConsultorios().subscribe({
      next: (data: any) => {
        this.consultorios = data;
        console.log('Consultorios cargados:', this.consultorios.length);
      },
      error: (err: any) => console.error('Error cargando consultorios:', err),
    });
  }

   cargarUltimasAdmisiones() {
     this.api.get<any[]>('recepcion/ultimas-admisiones').subscribe({
       next: (data) => {
         const ahora = new Date();
         const inicioDeHoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate());

          this.ultimasAdmisiones = (data || []).filter((admision: any) => {
             const estadoActual = admision.id_estado_actual;
             return estadoActual !== 5 && estadoActual !== 6 && estadoActual !== 7;
           });

         this.appRef.tick();
       },
       error: (err: any) => console.error('Error cargando ultimas admisiones:', err),
     });
   }

  cargarAseguradoras() {
    this.api.getAseguradoras().subscribe({
      next: (data: any[]) => {
        this.aseguradoras = data;
        this.cdr.detectChanges();
      },
      error: (err: any) => console.error('Error cargando aseguradoras:', err),
    });
  }

  importarAseguradorasExcel(fileInput: HTMLInputElement) {
    const file = fileInput?.files?.[0];
    if (!file) return;

    import('xlsx').then(XLSX => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });

          if (rows.length === 0) {
            this.swal.error('El archivo Excel está vacío');
            return;
          }

          this.api.importarAseguradoras({ rows }).subscribe({
            next: (res: any) => {
              this.cargarAseguradoras();
              this.swal.success(res.mensaje || `Importación exitosa: ${res.importados || rows.length} registros`);
            },
            error: (err) => {
              this.swal.error(err.error?.mensaje || 'Error al importar datos');
            },
          });
        } catch (err) {
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

  onSearchChange(value: string) {
    if (!value || value.trim().length < 1) {
      this.resetSearchOnly();
    }
    this.searchSubject.next(value);
  }

  ejecutarBusqueda(value: string) {
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
    }

    this.buscando = true;
    this.pacientesEncontrados = [];

    const filtro = this.searchFilter !== 'todo' ? `?filtro=${this.searchFilter}` : '';
    this.busquedaSubscription = this.api.get<any[]>(`recepcion/pacientes/${value}${filtro}`).subscribe({
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
    this.filaEnEdicion = null; // Reset edit state to avoid locked fields
    this.pacienteExistenteCargado = false;
    this.esRegistroDirecto = true;
    this.isEditMode = false;
    this.nuevoPaciente = {
      id_paciente: null,
      cedula: '',
      nombre: '',
      apellido: '',
      telefono: '',
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

    // Precargar datos del buscador si existen
    if (this.cedulaBusqueda && this.cedulaBusqueda.trim().length > 0) {
      const val = this.cedulaBusqueda.trim();
      if (this.searchFilter === 'cedula' || (!isNaN(Number(val)) && this.searchFilter === 'todo')) {
        this.nuevoPaciente.cedula = val;
        // Hacer la consulta automática a la BD
        this.onCedulaFormChange(val);
      } else if (this.searchFilter === 'nombre') {
        this.nuevoPaciente.nombre = val.toUpperCase();
      } else if (this.searchFilter === 'apellido') {
        this.nuevoPaciente.apellido = val.toUpperCase();
      }
    }
  }

  onCedulaFormChange(cedula: string) {
    if (this.isEditMode) return; // No buscar si estamos editando
    if (!cedula || cedula.trim().length < 2) {
      this.pacienteExistenteCargado = false;
      this.nuevoPaciente.id_paciente = null;
      return;
    }
    // Buscamos si existe la cédula de forma exacta
    this.api.get<any[]>(`recepcion/pacientes/${cedula}`).subscribe({
      next: (data) => {
        // Encontrar coincidencia exacta de cédula, ya que el backend usa ILIKE %cedula%
        const p = data ? data.find((paciente: any) => paciente.cedula === cedula) : null;

        if (p) {
          this.pacienteExistenteCargado = true;
          this.nuevoPaciente.id_paciente = p.id_paciente || p.id;
          this.nuevoPaciente.cedula = p.cedula;
          this.nuevoPaciente.nombre = p.nombre;
          this.nuevoPaciente.apellido = p.apellido;
          this.nuevoPaciente.telefono = p.telefono;
        } else {
          // Si ya no existe, limpiar los datos autocompletados
          if (this.nuevoPaciente.id_paciente) {
            this.nuevoPaciente.nombre = '';
            this.nuevoPaciente.apellido = '';
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
    this.pacienteExistenteCargado = true;
    this.isEditMode = false;
    this.abrirModalRegistro();
    this.nuevoPaciente = {
      id_paciente: paciente.id_paciente || paciente.id,
      cedula: paciente.cedula,
      nombre: paciente.nombre,
      apellido: paciente.apellido,
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
    this.categoriaServicio = '';
    this.pacientesEncontrados = [];
    this.mostrarResultadosBusqueda = false;
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
            error: (err: any) => {
              this.finalizarGuardado(() => {
                this.swal.error('Error al actualizar aseguradora');
              });
            },
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
          error: (err: any) => {
            this.finalizarGuardado(() => {
              this.swal.error('Error al registrar aseguradora');
            });
          },
        });
      }
      return;
    }

    // Validación estricta para asegurar que se cree la atención (ticket)
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) {
      this.swal.warning('Debe seleccionar Responsable de Pago y el Servicio (Especialidad/Lab/Imagen)');
      return;
    }

    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      this.swal.warning('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    this.isSaving = true;
    this.inicioGuardado = Date.now();

    if (this.isEditMode) {
      const id_paciente = this.nuevoPaciente.id_paciente;
      const id_atencion = this.seleccion.id_atencion;

      const datosPaciente = {
        cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim(),
        nombre: (this.nuevoPaciente.nombre || '').toString().toUpperCase().trim(),
        apellido: (this.nuevoPaciente.apellido || '').toString().toUpperCase().trim(),
        telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim(),
      };

      this.api.put(`recepcion/pacientes/${id_paciente}`, datosPaciente).subscribe({
        next: () => {
          const bodyAtencion = {
            id_servicio: this.seleccion.id_servicio,
            id_responsable: this.seleccion.id_responsable,
            id_cliente: this.seleccion.id_cliente,
            id_especialidad: this.seleccion.id_especialidad || null,
            id_medico: this.seleccion.id_medico || null,
            id_consultorio: this.seleccion.id_consultorio || null,
          };
          this.api.put(`recepcion/atencion/${id_atencion}`, bodyAtencion).subscribe({
            next: () => {
              this.finalizarGuardado(() => {
                this.mostrarRegistro = false;
                this.swal.success('Cambios guardados con éxito');
                this.cargarUltimasAdmisiones();
              });
            },
            error: (err: any) => {
              this.finalizarGuardado(() => {
                this.swal.error('Error al actualizar la atención');
              });
            },
          });
        },
        error: (err: any) => {
          this.finalizarGuardado(() => {
            this.swal.error('Error al actualizar datos del paciente');
          });
        },
      });
      return;
    }

    // MODO CREACIÓN (Original)
    if (this.pacienteExistenteCargado && this.nuevoPaciente.id_paciente) {
      // Generar atención directamente para paciente existente
      this.generarAtencionDirecta(this.nuevoPaciente.id_paciente);
    } else {
      // Crear nuevo paciente y luego generar atención
      const datosPaciente = {
        cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, ''),
        nombre: (this.nuevoPaciente.nombre || '').toUpperCase().trim(),
        apellido: (this.nuevoPaciente.apellido || '').toUpperCase().trim(),
        telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, ''),
        status: true,
      };

      this.api.post('recepcion/pacientes', datosPaciente).subscribe({
        next: (paciente: any) => {
          const id_paciente = paciente.id_paciente || paciente.id;
          this.generarAtencionDirecta(id_paciente);
        },
        error: (err: any) => {
          console.error('Error registrando:', err);
          this.finalizarGuardado(() => {
            this.swal.error('Error al registrar paciente');
          });
        },
      });
    }
  }

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

  // --- DROPDOWN RESPONSABLE ---
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
    // Reset selections on payer change
    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';
    this.categoriaServicio = '';
  }

  // --- DROPDOWN ASEGURADORAS ---
  toggleAseguradoraDropdown() {
    this.showAseguradoraDropdown = !this.showAseguradoraDropdown;
  }

  selectAseguradora(id: number) {
    this.seleccion.id_cliente = id;
    this.showAseguradoraDropdown = false;
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

  // --- DROPDOWN SERVICIOS (CATEGORÍAS) ---
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

    // Reset dependent fields
    this.seleccion.id_servicio = null;
    this.seleccion.id_especialidad = null;
    this.seleccion.id_medico = null;
    this.seleccion.id_consultorio = null;
    this.seleccion.nombre_medico_label = '';
    this.seleccion.nombre_servicio_label = '';

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

  // --- DROPDOWN ESPECIALIDADES ---
  toggleEspecialidadDropdown() {
    this.showEspecialidadDropdown = !this.showEspecialidadDropdown;
  }

  selectEspecialidad(item: any) {
    if (this.categoriaServicio === 'Consulta') {
      // item es una especialidad
      this.seleccion.id_servicio = item.id_servicio; // El ID del servicio 'CONSULTA'
      this.seleccion.id_especialidad = item.id_especialidad || item.id;
      this.seleccion.nombre_servicio_label = item.nombre || '';
      // Reset médico al cambiar especialidad
      this.seleccion.id_medico = null;
      this.seleccion.id_consultorio = null;
      this.seleccion.nombre_medico_label = '';
    } else {
      // item es un servicio (Laboratorio/Imagen)
      this.seleccion.id_servicio = item.id || item.id_servicio;
      this.seleccion.id_especialidad = null;
      this.seleccion.nombre_servicio_label = item.nombre || item.nombre_servicio || '';
    }
    this.showEspecialidadDropdown = false;
  }

  getEspecialidades() {
    // Si no hay categoría seleccionada, mostrar todas las especialidades por defecto
    if (!this.categoriaServicio) {
      return this.especialidades;
    }
    
    if (this.categoriaServicio === 'Consulta') {
      return this.especialidades;
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
    return this.medicos.filter((m: any) => {
      const espId = m.id_especialidad || m.especialidad_id;
      return espId == this.seleccion.id_especialidad;
    });
  }

  toggleMedicoDropdown() {
    this.showMedicoDropdown = !this.showMedicoDropdown;
  }

  selectMedico(m: any) {
    this.seleccion.id_medico = m.id_usuario || m.id;
    this.seleccion.id_consultorio = m.id_consultorio || m.consultorio_id || null;
    this.seleccion.nombre_medico_label = ((m.nombre || '') + ' ' + (m.apellido || '')).trim();
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

  // --- ACCIONES DE TABLA ---
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
         nombre: fila.nombre,
         apellido: fila.apellido,
         telefono: fila.telefono,
       };

       // Cargar selección de servicio y responsable
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
       
       // Intentar encontrar el nombre de la especialidad para el label
       if (fila.id_especialidad) {
         const esp = this.especialidades.find(e => (e.id_especialidad || e.id) === fila.id_especialidad);
         if (esp) {
           this.seleccion.nombre_especialidad_label = esp.nombre;
         }
       }
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

  // --- VALIDACIONES DE INPUT ---
  soloLetras(event: any) {
    const pattern = /[a-zA-ZáéíóúÁÉÍÓÚñÑ ]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }

  soloNumeros(event: any) {
    const pattern = /[0-9]/;
    const inputChar = String.fromCharCode(event.charCode);
    if (event.charCode !== 0 && !pattern.test(inputChar)) {
      event.preventDefault();
    }
  }
}
