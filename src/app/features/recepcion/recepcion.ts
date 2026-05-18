import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, UserPlus, Plus, FileText, CheckCircle2, ChevronRight, User, Phone, CreditCard, Stethoscope, ChevronDown, XCircle, ShieldCheck, ClipboardList } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
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
  responsables: any[] = [];
  ultimasAdmisiones: any[] = [];

  get admisionesFiltradas() {
    return this.ultimasAdmisiones.filter(a => {
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
  }

  seleccion: any = {
    id_servicio: null,
    id_responsable: null
  };

  // Lógica de Categorías
  categoriaServicio: string = ''; // 'Consulta', 'Laboratorio', 'Imágenes'
  showEspecialidadDropdown: boolean = false;

  isSaving: boolean = false;
  mostrarRegistro: boolean = false;

  esRegistroDirecto: boolean = false;
  pacienteExistenteCargado: boolean = false;

  private el = inject(ElementRef);
  private cdr = inject(ChangeDetectorRef);
  
  constructor(private api: ApiService, private router: Router) {}

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false;
      this.showPayerDropdown = false;
      this.showServiceDropdown = false;
      this.showEspecialidadDropdown = false;
    } else {
      // Si el click fue dentro, pero fuera de los contenedores específicos
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!target.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!target.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false;
    }
  }

  ngOnInit() {
    this.cargarDatosMaestros();
    this.cargarUltimasAdmisiones();

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
    this.api.getServicios().subscribe(data => this.servicios = data);
    
    this.api.get('admin/responsables').subscribe({
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

  onSearchChange(value: string) {
    if (!value || !value.trim()) {
      this.resetSearchOnly();
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
    this.nuevoPaciente = {
      id_paciente: null,
      cedula: '',
      nombre: '',
      apellido: '',
      telefono: '',
      status: true,
      notificaciones_sms: true
    };
    this.seleccion = { id_servicio: null, id_responsable: null };
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
    this.nuevoPaciente = {
      id_paciente: paciente.id_paciente || paciente.id,
      cedula: paciente.cedula,
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      telefono: paciente.telefono,
      status: true,
      notificaciones_sms: paciente.notificaciones_sms ?? true
    };
    this.seleccion = { id_servicio: null, id_responsable: null };
    this.categoriaServicio = '';
    this.pacientesEncontrados = []; // Ocultar la lista
  }

  registrarYContinuar() {
    if (!this.seleccion.id_servicio || !this.seleccion.id_responsable) {
      alert('Debe seleccionar Especialidad y Responsable de Pago');
      return;
    }

    this.isSaving = true;

    if (this.pacienteExistenteCargado && this.nuevoPaciente.id_paciente) {
      // Si el paciente ya existe, pasamos directo a generar la atención
      this.generarAtencionDirecta(this.nuevoPaciente.id_paciente);
    } else {
      // Convertir a mayúsculas y limpiar antes de enviar
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
      id_responsable: this.seleccion.id_responsable
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

    this.isSaving = true;
    const bodyTurno = {
      id_paciente: this.pacienteEncontrado.id_paciente || this.pacienteEncontrado.id,
      id_servicio: this.seleccion.id_servicio,
      id_responsable: this.seleccion.id_responsable
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
  }

  getNombreResponsable(id: any): string {
    if (!id) return 'Seleccione...';
    const rp = this.responsables.find(r => r.id === id);
    if (!rp) return id === 1 ? 'Particular' : (id === 2 ? 'Seguro' : 'Seleccione...');
    return rp.nombre;
  }

  // --- DROPDOWN SERVICIOS (CATEGORÍAS) ---
  toggleServiceDropdown() {
    this.showServiceDropdown = !this.showServiceDropdown;
  }

  selectCategoria(categoria: string) {
    this.categoriaServicio = categoria;
    this.showServiceDropdown = false;
    this.seleccion.id_servicio = null; // Resetear servicio final

    // Si es Lab o Imágenes, buscar el ID automáticamente
    if (categoria !== 'Consulta') {
      const s = this.servicios.find(serv => {
        const nombre = serv.nombre || serv.nombre_servicio || '';
        return nombre.toLowerCase().includes(categoria.toLowerCase());
      });
      if (s) this.seleccion.id_servicio = s.id || s.id_servicio;
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
