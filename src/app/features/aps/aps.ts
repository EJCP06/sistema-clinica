import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, UserPlus, Plus, FileText, CheckCircle2, ChevronRight, User, Phone, CreditCard, Stethoscope, ChevronDown, XCircle, ShieldCheck, ClipboardList, Edit2, ArrowRightLeft } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { Subject, Subscription } from 'rxjs';
import { debounceTime } from 'rxjs/operators';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';

@Component({
  selector: 'app-aps',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header],
  templateUrl: './aps.html'
})
export class ApsComponent implements OnInit, OnDestroy {
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
  readonly ArrowRightLeft = ArrowRightLeft;

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
  private busquedaSubscription?: Subscription;
  mostrarResultadosBusqueda: boolean = false;

  // Datos
  pacientesEncontrados: any[] = [];
  pacienteEncontrado: any = null;
  
  servicios: any[] = [];
  responsables: any[] = [];
  ultimasAdmisiones: any[] = [];
  searchQueryTabla: string = '';

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
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
      if (!target.closest('.payer-dropdown-container')) this.showPayerDropdown = false;
      if (!target.closest('.service-dropdown-container')) this.showServiceDropdown = false;
      if (!target.closest('.especialidad-dropdown-container')) this.showEspecialidadDropdown = false;
    }
  }

  private cambiosSub?: Subscription;

  ngOnInit() {
    this.cargarDatosMaestros();
    this.cargarUltimasAdmisiones();

    // Real-time updates via socket
    this.cambiosSub = this.api.cambios$.subscribe(() => {
      this.cargarUltimasAdmisiones();
    });

    this.searchSubscription = this.searchSubject.pipe(
      debounceTime(150)
    ).subscribe(value => {
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

  // --- FILTROS DE BÚSQUEDA ---
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
        this.ultimasAdmisiones = (data || []).filter(a => {
          const servicioLower = (a.nombre_servicio || '').toLowerCase();
          const esLaboratorio = servicioLower.includes('laboratorio');
          const esImagenes = servicioLower.includes('imágenes') || servicioLower.includes('imagenes');
          const esConsulta = !esLaboratorio && !esImagenes && a.nombre_servicio !== 'SIN ASIGNAR';

          const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
          const esSeguro = modalidadPagoLower === 'seguro';
          const esParticular = modalidadPagoLower === 'particular';

          // Regla solicitada:
          // 1. Laboratorios o Imágenes: SOLO Seguro
          // 2. Consulta: Seguro y también Particular
          if (esLaboratorio || esImagenes) {
            return esSeguro;
          } else if (esConsulta) {
            return esSeguro || esParticular;
          }

          return false;
        });
        this.cdr.detectChanges();
      },
      error: (err) => console.error('Error cargando ultimas admisiones:', err)
    });
  }

  onSearchChange(value: string) {
    if (!value || value.trim().length < 1) {
      this.resetSearchOnly();
    }
    this.searchSubject.next(value);
    this.cdr.detectChanges();
  }

  ejecutarBusqueda(value: string) {
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
    }

    this.buscando = true;
    this.pacientesEncontrados = [];

    const filtro = this.searchFilter !== 'todo' ? `?filtro=${this.searchFilter}` : '';
    this.busquedaSubscription = this.api.get(`recepcion/pacientes/${value}${filtro}`).subscribe({
      next: (data: any[]) => {
        if (!this.cedulaBusqueda || this.cedulaBusqueda.trim().length < 1) {
          return;
        }
        this.pacientesEncontrados = data || [];
        this.mostrarResultadosBusqueda = data && data.length > 0;
        this.buscando = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.buscando = false;
        this.pacientesEncontrados = [];
        this.mostrarResultadosBusqueda = false;
        this.cdr.detectChanges();
      }
    });
  }

  resetSearchOnly() {
    if (this.busquedaSubscription) {
      this.busquedaSubscription.unsubscribe();
      this.busquedaSubscription = undefined;
    }
    this.pacientesEncontrados = [];
    this.pacienteEncontrado = null;
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

  seleccionarPaciente(paciente: any) {
    this.pacienteEncontrado = paciente;
    this.seleccion = { id_servicio: null, id_responsable: null };
    this.categoriaServicio = '';
    this.pacientesEncontrados = [];
    this.mostrarResultadosBusqueda = false;
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
        this.pacienteEncontrado = null;
        this.cedulaBusqueda = ''; 
        this.cdr.detectChanges();
        
        alert('Cita/Servicio cargado en APS con éxito. Turno generado: ' + (res.numero || 'Listo'));
        this.cargarUltimasAdmisiones(); 
      },
      error: (err) => {
        console.error('Error al generar turno APS:', err);
        alert('Error al asignar el servicio en APS');
        this.isSaving = false;
        this.cdr.detectChanges();
      }
    });
  }

  enviarAPresupuesto(id_atencion: number) {
    if (!confirm('¿Deseas enviar este paciente a Presupuesto/Caja?')) return;
    this.api.actualizarEstadoAtencion(id_atencion, 2).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err: any) => alert(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  enviarASalaEspera(id_atencion: number) {
    if (!confirm('¿Deseas enviar este paciente a la Sala de Espera (Ya pagó)?')) return;
    this.api.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err: any) => alert(err.error?.mensaje || 'Error al cambiar estado')
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
    const nombre = rp?.nombre || (id === 1 ? 'Particular' : (id === 2 ? 'Seguro' : 'Seleccione...'));
    return this.getResponsableLabel(nombre);
  }

  getResponsableLabel(value: any): string {
    const modalidad = (value || '').toString().trim().toLowerCase();
    if (modalidad.includes('particular')) return 'Particular';
    if (modalidad.includes('seguro') || modalidad.includes('asegur')) return 'Aseguradora';
    return 'SIN ASIGNAR';
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

  selectCategoria(categoria: string) {
    this.categoriaServicio = categoria;
    this.showServiceDropdown = false;
    this.seleccion.id_servicio = null; // reset especialidad
    
    // Si no es consulta, asignar automáticamente el servicio correspondiente
    if (categoria === 'Laboratorio') {
      const servLab = this.servicios.find(s => s.nombre.toLowerCase().includes('laboratorio'));
      if (servLab) this.seleccion.id_servicio = servLab.id;
    } else if (categoria === 'Imágenes') {
      const servImg = this.servicios.find(s => s.nombre.toLowerCase().includes('imágenes') || s.nombre.toLowerCase().includes('imagenes'));
      if (servImg) this.seleccion.id_servicio = servImg.id;
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

  getNombreServicioLabel(id: any): string {
    if (!id) return 'Seleccione...';
    const serv = this.servicios.find(s => s.id === id);
    return serv ? serv.nombre : 'Seleccione...';
  }

  getEspecialidades() {
    return this.servicios.filter(s => 
      !s.nombre.toLowerCase().includes('laboratorio') && 
      !s.nombre.toLowerCase().includes('imágenes') && 
      !s.nombre.toLowerCase().includes('imagenes')
    );
  }
}
