import { Component, OnInit, OnDestroy, HostListener, ElementRef, inject, DestroyRef } from '@angular/core';
import { interval } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Search, FileText, CheckCircle2, ChevronDown, Undo2, DollarSign, XCircle, Trash2, Volume2 } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { SwalService } from '../../core/services/swal.service';
import { AdmisionDTO } from '@core/models/dto.models';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';


@Component({
  selector: 'app-laboratorio',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './laboratorio.html'
})
/**
 * Panel de laboratorio.
 * Gestiona pacientes de servicio de laboratorio: presupuesto, caja,
 * sala de espera, reincorporación y retiro de pacientes.
 */
export class LaboratorioComponent implements OnInit, OnDestroy {
  readonly Search = Search;
  readonly FileText = FileText;
  readonly CheckCircle2 = CheckCircle2;
  readonly ChevronDown = ChevronDown;
  readonly Undo2 = Undo2;
  readonly DollarSign = DollarSign;
  readonly XCircle = XCircle;
  readonly Trash2 = Trash2;
  readonly Volume2 = Volume2;

  pageSize = 9;
  currentPage = 1;

  sidebarOpen = false;
  cedulaBusqueda = '';

  searchFilter: string = 'todo';
  showSearchFilterDropdown = false;

  ultimasAdmisiones: AdmisionDTO[] = [];
  cargando: boolean = true;

  get admisionesFiltradas(): AdmisionDTO[] {
    return this.ultimasAdmisiones.filter(a => {
      const query = (this.cedulaBusqueda || '').trim().toLowerCase();
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

  get fillersVacios(): number[] {
    return Array(this.pageSize).fill(0);
  }

  get hayRegistradosEnCola(): boolean {
    return this.ultimasAdmisiones.some(a => Number(a.id_estado_actual) === 1);
  }

  get puedeLlamar(): boolean {
    return this.auth.tieneRol(['analista', 'coordinador', 'administrador', 'laboratorio']);
  }

  trackById = (index: number, item: AdmisionDTO) => item?.id_atencion ?? index;

  private el = inject(ElementRef);
  private destroyRef = inject(DestroyRef);
  private swal = inject(SwalService);
  private auth = inject(AuthService);

  constructor(private api: ApiService) {}

  get usuario() { return this.auth.usuarioActual; }

  tienePermiso(permiso: string): boolean { return this.auth.tienePermiso(permiso); }

  @HostListener('document:click', ['$event'])
  onClick(event: MouseEvent) {
    if (!this.el.nativeElement.contains(event.target)) {
      this.showSearchFilterDropdown = false;
    } else {
      const target = event.target as HTMLElement;
      if (!target.closest('.search-filter-container')) this.showSearchFilterDropdown = false;
    }
  }

  ngOnInit() {
    this.cargarUltimasAdmisiones();

    this.api.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event: any) => {
      if (event?.admision) {
        const a = event.admision;
        const servicioLower = (a.nombre_servicio || '').toLowerCase();
        const esLaboratorio = servicioLower.includes('laboratorio');
        const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
        const esSeguro = modalidadPagoLower === 'seguro' || modalidadPagoLower.includes('asegur');
        const esParticular = modalidadPagoLower === 'particular';
        
        if (event.tipo === 'nuevo-turno') {
          if (esLaboratorio && (esParticular || esSeguro) && ![6, 9].includes(Number(a.id_estado_actual))) {
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        } else if (event.tipo === 'retirado') {
          const idx = this.ultimasAdmisiones.findIndex(x => x.id_atencion === a.id_atencion);
          if (idx !== -1) {
            this.ultimasAdmisiones[idx] = a;
            this.ultimasAdmisiones = [...this.ultimasAdmisiones];
          }
        } else if (event.tipo === 'estado-cambiado') {
          if ([6, 9].includes(Number(event.id_estado_nuevo))) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== a.id_atencion);
          } else if (Number(event.id_estado_nuevo) === 3 && esLaboratorio && esParticular) {
            this.ultimasAdmisiones = [a, ...this.ultimasAdmisiones].slice(0, 50);
          }
        }
      } else if (event.tipo === 'liberacion' || event.tipo === 'retirado') {
        this.cargarUltimasAdmisiones();
      } else if (event.tipo === 'estado-cambiado') {
        if ([6, 9].includes(Number(event.id_estado_nuevo))) {
          const id = Number(event.id_atencion);
          if (!isNaN(id)) {
            this.ultimasAdmisiones = this.ultimasAdmisiones.filter(x => x.id_atencion !== id);
          } else {
            this.cargarUltimasAdmisiones();
          }
        }
      } else {
        this.cargarUltimasAdmisiones();
      }

    });

    interval(30000).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarUltimasAdmisiones();
    });
  }

  ngOnDestroy() {
  }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(filter: string) {
    this.searchFilter = filter;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(): string {
    const labels: Record<string, string> = {
      'todo': 'TODO',
      'nombre': 'NOMBRES',
      'apellido': 'APELLIDOS',
      'cedula': 'CÉDULA'
    };
    return labels[this.searchFilter] || 'TODO';
  }

  cargarUltimasAdmisiones() {
    this.cargando = true;
    this.api.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => {
        const items = data || [];
        this.ultimasAdmisiones = items.filter(a => {
          if ([6, 9].includes(Number(a.id_estado_actual))) return false;
          
          const servicioLower = (a.nombre_servicio || '').toLowerCase();
          const esLaboratorio = servicioLower.includes('laboratorio');

          const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
          const esSeguro = modalidadPagoLower === 'seguro' || modalidadPagoLower.includes('asegur');
          const esParticular = modalidadPagoLower === 'particular';

          if (esLaboratorio) return esParticular;
          return false;
        });
        this.cargando = false;
      },
      error: () => { this.cargando = false; console.error('Error cargando ultimas admisiones'); }
    });
  }

  onSearchChange(value: string | undefined) {
    this.cedulaBusqueda = value || '';
    this.currentPage = 1;
  }

  onSearch() {
    this.currentPage = 1;
  }

  /**
   * Llama por voz al siguiente paciente registrado de la cola filtrada de
   * esta vista (particulares de laboratorio): el anuncio suena al instante
   * en el turnero y se repite en cada pulsación, sin cambiar el estado.
   */
  llamarSiguienteRegistrado() {
    const cola = this.ultimasAdmisiones
      .filter(a => Number(a.id_estado_actual) === 1)
      .sort((a, b) => new Date(a.fecha_creacion).getTime() - new Date(b.fecha_creacion).getTime());

    if (cola.length === 0) return;

    const paciente = cola[0];
    this.api.post(`recepcion/atencion/${paciente.id_atencion}/llamar-laboratorio`, {}).subscribe({
      next: () => {},
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al llamar paciente')
    });
  }

  async enviarAPresupuesto(id_atencion: number) {
    const result = await this.swal.confirm('¿Ya se creó el presupuesto al paciente?');
    if (!result.isConfirmed) return;

    this.api.actualizarEstadoAtencion(id_atencion, 2).subscribe({
      next: () => {
        this.cargarUltimasAdmisiones();
      },
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async enviarACaja(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async enviarASalaEspera(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.actualizarEstadoAtencion(id_atencion, 4).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async reincorporar(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas reincorporar este paciente a la Sala de Espera?');
    if (!result.isConfirmed) return;
    this.api.reincorporarPaciente(id_atencion).subscribe({
      next: () => this.cargarUltimasAdmisiones(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al reincorporar paciente')
    });
  }

  async marcarAusente(admision: any) {
    const result = await this.swal.confirm('¿Quieres retirar al paciente?', '¿Estás seguro?');
    if (!result.isConfirmed) return;
    this.api.put(`recepcion/atencion/${admision.id_atencion}/marcar_ausente`, {}).subscribe({
      next: () => {
        this.ultimasAdmisiones = this.ultimasAdmisiones.filter(a => a.id_atencion !== admision.id_atencion);
        this.api.cambios$.next({ id_atencion: admision.id_atencion });
        this.swal.success('Paciente retirado correctamente');
      },
      error: () => {
        this.swal.error('Error al retirar paciente');
      },
    });
  }

  getResponsableLabel(value: string | undefined): string {
    const modalidad = (value || '').toString().trim().toLowerCase();
    if (modalidad.includes('particular')) return 'Particular';
    if (modalidad.includes('seguro') || modalidad.includes('asegur')) return 'Aseguradora';
    return 'SIN ASIGNAR';
  }

  getServicioCategoria(value: string | undefined): string {
    const servicio = (value || '').toString().trim().toLowerCase();
    if (servicio.includes('laboratorio')) return 'Laboratorio';
    if (servicio.includes('imágenes') || servicio.includes('imagenes')) return 'Imágenes';
    return 'Consulta';
  }
}
