import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, UserPlus, Plus, FileText, CheckCircle2, ChevronRight, User, Phone, CreditCard, Stethoscope, ChevronDown, XCircle, ShieldCheck, ClipboardList, Edit2, Trash2 } from 'lucide-angular';
import { EspecialidadesService } from '../../core/services/especialidades.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';

@Component({
  selector: 'app-recepcion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header],
  templateUrl: './recepcion.html'
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

  // Estados
  sidebarOpen: boolean = false;
  cedulaBusqueda: string = '';
  buscando: boolean = false;
  
  // Filtro de Búsqueda
  searchFilter: string = 'todo'; // 'todo', 'nombre', 'apellido', 'cedula'
  showSearchFilterDropdown: boolean = false;
  showPayerDropdown: boolean = false;
  showServiceDropdown: boolean = false;

  // Live Search
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Datos
  pacientesEncontrados: any[] = [];
  pacienteEncontrado: any = null;
  nuevoPaciente: any = {
    cedula: '',
    nombre: '',
    apellido: '',
    telefono: '',
    status: true,
    notificaciones_sms: true
  };
  
  servicios: any[] = [];
  especialidades: any[] = [];
  responsables: any[] = [];
  ultimasAdmisiones: any[] = [];

  aseguradoras: any[] = [];

  get admisionesFiltradas() {
    if (this.isAseguradorasView) {
      const query = (this.cedulaBusqueda || '').trim().toLowerCase();
      return this.aseguradoras.filter(a => {
        if (!query) return true;
        return (a.aseguradora || '').toLowerCase().includes(query);
      });
    }

    const baseFiltered = this.ultimasAdmisiones.filter(a => {
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
    id_atencion: null // Para saber si estamos editando una atención existente
  };

  // Lógica de Categorías
  categoriaServicio: string = ''; // 'Consulta', 'Laboratorio', 'Imágenes'
  showEspecialidadDropdown: boolean = false;
  showAseguradoraDropdown: boolean = false;

  isSaving: boolean = false;
  mostrarRegistro: boolean = false;
  isEditMode: boolean = false;

  esRegistroDirecto: boolean = false;
  pacienteExistenteCargado: boolean = false;

  pageTitle: string = 'Admisión de Pacientes';
  pageSubtitle: string = 'Gestión de entrada y asignación de turnos médicos';
  isAseguradorasView: boolean = false;

  private el = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  
  constructor(private api: ApiService, private router: Router) {}

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
      if (!target.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false;
      if (!target.closest('.aseguradora-dropdown-container')) this.showAseguradoraDropdown = false;
    }
  }

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

    // Setup live search
    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged()
    ).subscribe(value => {
      this.ejecutarBusqueda(value);
    });
  }

  ngOnDestroy() {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  onTabChange(tab: string) {
    if (tab === 'dashboard') this.router.navigate(['/admin']);
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
      'todo': 'TODO',
      'nombre': 'NOMBRE',
      'apellido': 'APELLIDO',
      'cedula': 'CÉDULA'
    };
    return labels[this.searchFilter] || 'TODO';
  }

  // --- LOGICA DE NEGOCIO ---

  cargarDatosMaestros() {
    this.api.getServicios().subscribe(data => {
      this.servicios = data;
    });
    this.cargarAseguradoras();
    
    this.api.get('recepcion/responsables-pago').subscribe({
      next: (data) => this.responsables = data,
      error: (err) => console.error('Error cargando responsables:', err)
    });
  }

  cargarUltimasAdmisiones() {
    this.api.get('recepcion/ultimas-admisiones').subscribe({
      next: (data: any[]) => {
        this.ultimasAdmisiones = data;
        this.cdr.detectChanges(); // Forzar refresco de la tabla
      },
      error: (err) => console.error('Error cargando ultimas admisiones:', err)
    });
  }

  cargarAseguradoras() {
    this.api.getAseguradoras().subscribe({
      next: (data: any[]) => {
        this.aseguradoras = data;
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando aseguradoras:', err)
    });
  }

  onSearchChange(value: string) {
    if (!value || !value.trim()) {
      this.resetSearchOnly();
    } else {
      this.searchSubject.next(value);
    }
    this.cdr.detectChanges();
  }

  ejecutarBusqueda(value: string) {
    if (!value.trim()) {
      this.resetSearchOnly();
      return;
    }
    
    if (value.trim().length < 2) {
      this.resetSearchOnly();
      return;
    }

    this.buscando = true;
    this.pacientesEncontrados = [];

    this.api.get(`recepcion/pacientes/${value}?filtro=${this.searchFilter}`).subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          if (data.length === 1) {
            this.seleccionarPaciente(data[0]);
          } else {
            this.pacientesEncontrados = data;
          }
        } else {
          this.pacientesEncontrados = [];
        }
        this.buscando = false;
      },
      error: (err) => {
        this.buscando = false;
        this.pacientesEncontrados = [];
      }
    });
  }

  resetSearchOnly() {
    this.pacientesEncontrados = [];
    this.buscando = false;
  }

  prepararNuevoPaciente() {
    this.pacienteExistenteCargado = false;
    this.esRegistroDirecto = true;
    this.mostrarRegistro = true;
    this.isEditMode = false;
    this.nuevoPaciente = {
      id_paciente: null,
      cedula: '',
      nombre: '',
      apellido: '',
      telefono: '',
      status: true,
      notificaciones_sms: true
    };
    this.seleccion = {
      id_servicio: null,
      id_responsable: this.isAseguradorasView ? 2 : null,
      id_cliente: null,
      id_atencion: null
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
    this.api.get(`recepcion/pacientes/${cedula}?filtro=cedula`).subscribe({
      next: (data: any[]) => {
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
      error: () => {
        this.pacienteExistenteCargado = false;
        this.nuevoPaciente.id_paciente = null;
      }
    });
  }

  seleccionarPaciente(paciente: any) {
    this.pacienteExistenteCargado = true;
    this.mostrarRegistro = true;
    this.isEditMode = false;
    this.nuevoPaciente = {
      id_paciente: paciente.id_paciente || paciente.id,
      cedula: paciente.cedula,
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      telefono: paciente.telefono,
      status: true,
      notificaciones_sms: paciente.notificaciones_sms ?? true
    };
    this.seleccion = { id_servicio: null, id_responsable: null, id_cliente: null, id_atencion: null };
    this.categoriaServicio = '';
    this.pacientesEncontrados = []; // Ocultar la lista
  }

  registrarYContinuar() {
    if (this.isAseguradorasView) {
      const nombreAseguradora = (this.nuevoPaciente.nombre || '').toString().trim();
      if (!nombreAseguradora) {
        alert('Debe ingresar el nombre de la aseguradora');
        return;
      }
      this.isSaving = true;

      if (this.isEditMode && this.nuevoPaciente.id_cliente) {
        // Editar aseguradora (si se implementara en el backend, por ahora solo crear)
        this.api.put(`admin/aseguradoras/${this.nuevoPaciente.id_cliente}`, { nombre: nombreAseguradora }).subscribe({
          next: () => {
            this.cargarAseguradoras();
            this.mostrarRegistro = false;
            this.isSaving = false;
          },
          error: () => {
            alert('Error al actualizar aseguradora');
            this.isSaving = false;
          }
        });
      } else {
        this.api.crearAseguradora({ nombre: nombreAseguradora }).subscribe({
          next: () => {
            this.cargarAseguradoras();
            this.mostrarRegistro = false;
            this.isSaving = false;
          },
          error: () => {
            alert('Error al registrar aseguradora');
            this.isSaving = false;
          }
        });
      }
      return;
    }

    // Validación estricta para asegurar que se cree la atención (ticket)
    if (!this.seleccion.id_responsable || !this.seleccion.id_servicio) {
      alert('Debe seleccionar Responsable de Pago y el Servicio (Especialidad/Lab/Imagen)');
      return;
    }

    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      alert('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    this.isSaving = true;

    if (this.isEditMode) {
      // MODO EDICIÓN
      const id_paciente = this.nuevoPaciente.id_paciente;
      const id_atencion = this.seleccion.id_atencion;

      // 1. Actualizar Paciente
      const datosPaciente = {
        cedula: (this.nuevoPaciente.cedula || '').toString().replace(/\D/g, '').trim(),
        nombre: (this.nuevoPaciente.nombre || '').toString().toUpperCase().trim(),
        apellido: (this.nuevoPaciente.apellido || '').toString().toUpperCase().trim(),
        telefono: (this.nuevoPaciente.telefono || '').toString().replace(/\D/g, '').trim(),
        notificaciones_sms: this.nuevoPaciente.notificaciones_sms
      };

      this.api.put(`recepcion/pacientes/${id_paciente}`, datosPaciente).subscribe({
        next: () => {
          // 2. Actualizar Atención
          const bodyAtencion = {
            id_servicio: this.seleccion.id_servicio,
            id_responsable: this.seleccion.id_responsable,
            id_cliente: this.seleccion.id_cliente
          };
          this.api.put(`recepcion/atencion/${id_atencion}`, bodyAtencion).subscribe({
            next: () => {
              this.isSaving = false;
              this.mostrarRegistro = false;
              alert('Cambios guardados con éxito');
              this.cargarUltimasAdmisiones();
            },
            error: () => {
              alert('Error al actualizar la atención');
              this.isSaving = false;
            }
          });
        },
        error: () => {
          alert('Error al actualizar datos del paciente');
          this.isSaving = false;
        }
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
        notificaciones_sms: this.nuevoPaciente.notificaciones_sms
      };

      this.api.post('recepcion/pacientes', datosPaciente).subscribe({
        next: (paciente) => {
          const id_paciente = paciente.id_paciente || paciente.id;
          this.generarAtencionDirecta(id_paciente);
        },
        error: (err) => {
          console.error('Error registrando:', err);
          this.isSaving = false;
          alert('Error al registrar paciente');
        }
      });
    }
  }

  generarAtencionDirecta(id_paciente: number) {
    const bodyTurno = {
      id_paciente: id_paciente,
      id_servicio: this.seleccion.id_servicio,
      id_responsable: this.seleccion.id_responsable,
      id_cliente: this.seleccion.id_cliente
    };

    this.api.post('recepcion/generar-turno', bodyTurno).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.mostrarRegistro = false;
        this.pacienteEncontrado = null;
        this.cedulaBusqueda = ''; 
        this.cdr.detectChanges();
        
        alert('Ticket generado con éxito: ' + (res.numero || 'Listo'));
        this.cargarUltimasAdmisiones(); 
      },
      error: (err) => {
        console.error('Error al generar turno directo:', err);
        alert('Error al asignar el servicio / generar turno.');
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  generarAtencion() {
    if (!this.seleccion.id_servicio || !this.seleccion.id_responsable) {
      alert('Debe seleccionar Especialidad y Responsable de Pago');
      return;
    }

    if (this.seleccion.id_responsable === 2 && !this.seleccion.id_cliente) {
      alert('Debe seleccionar el nombre de la aseguradora');
      return;
    }

    this.isSaving = true;
    const bodyTurno = {
      id_paciente: this.pacienteEncontrado.id_paciente || this.pacienteEncontrado.id,
      id_servicio: this.seleccion.id_servicio,
      id_responsable: this.seleccion.id_responsable,
      id_cliente: this.seleccion.id_cliente
    };

    this.api.post('recepcion/generar-turno', bodyTurno).subscribe({
      next: (res: any) => {
        this.isSaving = false;
        this.pacienteEncontrado = null; // Cerrar modal al instante
        this.mostrarRegistro = false;
        this.cedulaBusqueda = ''; 
        this.cdr.detectChanges();
        
        // El alert viene después de cerrar visualmente
        alert('Turno / Servicio asignado con éxito: ' + (res.numero || 'Listo'));
        this.cargarUltimasAdmisiones(); 
      },
      error: (err) => {
        console.error('Error al asignar servicio:', err);
        alert('Error al asignar el servicio');
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  // --- DROPDOWN RESPONSABLE ---
  togglePayerDropdown() {
    this.showPayerDropdown = !this.showPayerDropdown;
  }

  selectPayer(id: number) {
    this.seleccion.id_responsable = id;
    this.showPayerDropdown = false;
    if (id !== 2) {
      this.seleccion.id_cliente = null;
    }
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
    if (!id) return 'Seleccione aseguradora...';
    const asig = this.aseguradoras.find(a => a.id_cliente === id);
    return asig ? asig.aseguradora : 'Seleccione aseguradora...';
  }

  getNombreResponsable(id: any): string {
    if (!id) return 'Seleccione...';
    const rp = this.responsables.find(r => r.id === id);
    const nombre = rp?.nombre || (id === 1 ? 'Particular' : (id === 2 ? 'Seguro' : 'Seleccione...'));
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
    if (servicio.includes('imágenes') || servicio.includes('imagenes') || servicio.includes('imagen')) return 'Imágenes';
    return 'Consulta';
  }

  // --- DROPDOWN SERVICIOS (CATEGORÍAS) ---
  toggleServiceDropdown() {
    this.showServiceDropdown = !this.showServiceDropdown;
  }

  private normalizeString(str: string): string {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  selectCategoria(categoria: string) {
    this.categoriaServicio = categoria;
    this.showServiceDropdown = false;
    this.seleccion.id_servicio = null;

    if (categoria !== 'Consulta') {
      const normalizedSearch = this.normalizeString(categoria);
      const s = this.servicios.find(serv => {
        const nombre = this.normalizeString(serv.nombre || serv.nombre_servicio || '');
        return nombre.includes(normalizedSearch);
      });
      
      if (s) {
        this.seleccion.id_servicio = s.id || s.id_servicio;
      } else {
        alert(`Atención: El servicio de ${categoria} no está configurado para esta sede. Por favor, pida al administrador que lo cree.`);
        this.categoriaServicio = '';
      }
    }
  }


  // --- DROPDOWN ESPECIALIDADES ---
  toggleEspecialidadDropdown() {
    this.showEspecialidadDropdown = !this.showEspecialidadDropdown;
  }

  selectEspecialidad(id: number) {
    this.seleccion.id_servicio = id;
    this.showEspecialidadDropdown = false;
  }

  getEspecialidades() {
    return this.servicios.filter(s => {
      const nombre = s.nombre || s.nombre_servicio || '';
      return !nombre.toLowerCase().includes('laboratorio') && 
             !nombre.toLowerCase().includes('imágenes') &&
             !nombre.toLowerCase().includes('imagenes');
    });
  }

  getNombreServicioLabel(id: any): string {
    if (!id) return 'Seleccione...';
    const s = this.servicios.find(serv => (serv.id || serv.id_servicio) === id);
    if (!s) return 'Seleccione...';
    return s.nombre || s.nombre_servicio || 'Seleccione...';
  }

  // --- ACCIONES DE TABLA ---
  editarFila(fila: any) {
    this.isEditMode = true;
    if (this.isAseguradorasView) {
      this.isSaving = false;
      this.mostrarRegistro = true;
      this.pacienteExistenteCargado = false;
      this.nuevoPaciente = {
        id_cliente: fila.id_cliente,
        nombre: fila.aseguradora,
        status: true
      };
    } else {
      this.pacienteExistenteCargado = true;
      this.mostrarRegistro = true;
      this.nuevoPaciente = {
        id_paciente: fila.id_paciente,
        cedula: fila.cedula,
        nombre: fila.nombre,
        apellido: fila.apellido,
        telefono: fila.telefono,
        notificaciones_sms: fila.mensaje
      };
      
      // Cargar selección de servicio y responsable
      this.seleccion = {
        id_servicio: fila.id_servicio,
        id_responsable: fila.id_responsable,
        id_cliente: fila.id_cliente,
        id_atencion: fila.id_atencion
      };
      
      this.categoriaServicio = this.getServicioCategoria(fila.nombre_servicio);
    }
  }

  eliminarFila(fila: any) {
    const msg = this.isAseguradorasView 
      ? `¿Eliminar aseguradora ${fila.aseguradora}?` 
      : `¿Eliminar admisión de ${fila.nombre} ${fila.apellido}?`;
    
    if (confirm(msg)) {
      if (this.isAseguradorasView) {
        this.api.delete(`admin/aseguradoras/${fila.id_cliente}`).subscribe({
          next: () => this.cargarAseguradoras(),
          error: () => alert('Error al eliminar')
        });
      } else {
        if (fila.id_atencion) {
          this.api.delete(`recepcion/atencion/${fila.id_atencion}`).subscribe({
            next: () => this.cargarUltimasAdmisiones(),
            error: () => alert('Error al eliminar atención')
          });
        } else {
          // Si no tiene atención, solo es un paciente registrado hoy
          this.api.delete(`recepcion/pacientes/${fila.id_paciente}`).subscribe({
            next: () => this.cargarUltimasAdmisiones(),
            error: () => alert('Error al eliminar paciente')
          });
        }
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
