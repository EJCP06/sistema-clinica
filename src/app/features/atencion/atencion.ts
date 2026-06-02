import { Component, inject, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '@core/services/swal.service';
import { TurnoDTO, MiEstadoDTO, LlamarSiguienteResponseDTO, ApiResponse, AdmisionDTO } from '@core/models/dto.models';
import { Subscription, interval } from 'rxjs';
import { LucideAngularModule, Play, Pause, Coffee, Volume2, CheckCircle2, ArrowRightLeft, UserX, MonitorSpeaker, IdCard, X, Search, Calendar, Clock, Download, ChevronRight, ChevronDown, FileText } from 'lucide-angular';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';


@Component({
  selector: 'app-atencion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Header, Sidebar, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './atencion.html',
  styles: []
})
export class Atencion implements OnInit, OnDestroy {
  readonly Play = Play;
  readonly Pause = Pause;
  readonly Coffee = Coffee;
  readonly Volume2 = Volume2;
  readonly CheckCircle2 = CheckCircle2;
  readonly ArrowRightLeft = ArrowRightLeft;
  readonly UserX = UserX;
  readonly MonitorSpeaker = MonitorSpeaker;
  readonly IdCard = IdCard;
  readonly X = X;
  readonly Search = Search;
  readonly Calendar = Calendar;
  readonly Clock = Clock;
  readonly Download = Download;
  readonly ChevronRight = ChevronRight;
  readonly ChevronDown = ChevronDown;
  readonly FileText = FileText;

  tipo: string = 'medico';
  activeView: 'atencion' | 'recepcion' = 'atencion';
  pageSize = 6;
  historialPageSize = 7;
  currentHistorialPage = 1;
  currentHistorialTabPage = 1;
  currentPage = 1;

  sidebarOpen: boolean = false;


  private route = inject(ActivatedRoute);
  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private swal = inject(SwalService);

  get pageTitle(): string {
    if (this.tipo === 'laboratorio') return 'Panel de Laboratorio';
    if (this.tipo === 'imagenes') return 'Panel de Imágenes';
    return 'Panel de Atención';
  }

  get pageSubtitle(): string {
    if (this.tipo === 'laboratorio') return 'Gestión de pacientes de laboratorio';
    if (this.tipo === 'imagenes') return 'Gestión de pacientes de imágenes';
    return 'Gestión dinámica de flujo de pacientes';
  }

  consultorioEstado: string = 'LIBRE';
  consultorioId: number = 0;
  consultorioNombre: string = '';
  servicioId: number = 0;
  atendiendoLocalmente: boolean = false;

  get isDarkMode() { return this.themeService.isDarkMode(); }

  // Getter de compatibilidad con el template que usa consultorio?.estado
  get consultorio() {
    return {
      id: this.consultorioId,
      nombre: this.consultorioNombre,
      estado: this.consultorioEstado,
      especialidadNombre: this.authService.usuarioActual?.especialidad_nombre || 'General',
      medicoAsignado: this.authService.usuarioActual?.nombre || ''
    };
  }

  turnoActual: TurnoDTO | null = null;
  turnosEnEspera: number = 0;
  proximosTurnos: TurnoDTO[] = [];

  private destroyRef = inject(DestroyRef);

  tiempoRestante: number = 120;
  private timerSub: Subscription | null = null;

  mensajeInfo = '';
  cargando = false;

  // Historial
  turnosAtendidos: TurnoDTO[] = [];
  searchQueryHistorial: string = '';
  searchFilter: string = 'todo';
  showSearchFilterDropdown: boolean = false;
  totalAtendidosHoy: number = 0;
  tiempoPromedioConsulta: string = '0 min';

  // Pacientes en sala (APS-like para lab/imagenes)
  ultimasAdmisiones: AdmisionDTO[] = [];
  cedulaBusquedaPacientes: string = '';
  searchFilterPacientes: string = 'todo';
  showSearchFilterDropdownPacientes: boolean = false;

  get pacientesFiltrados(): AdmisionDTO[] {
    return this.ultimasAdmisiones.filter(a => {
      const query = (this.cedulaBusquedaPacientes || '').trim().toLowerCase();
      if (!query) return true;
      const matchNombre = (a.nombre || '').toLowerCase().includes(query);
      const matchApellido = (a.apellido || '').toLowerCase().includes(query);
      const matchCedula = (a.cedula || '').toLowerCase().includes(query);
      if (this.searchFilterPacientes === 'nombre') return matchNombre;
      if (this.searchFilterPacientes === 'apellido') return matchApellido;
      if (this.searchFilterPacientes === 'cedula') return matchCedula;
      return matchNombre || matchApellido || matchCedula;
    });
  }

  trackById = (index: number, item: TurnoDTO | AdmisionDTO) => {
    if ('id_atencion' in item) return item.id_atencion ?? index;
    return (item as TurnoDTO).id ?? index;
  };

  ngOnInit() {
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const qTipo = params['tipo'];
      if (qTipo && ['medico', 'laboratorio', 'imagenes'].includes(qTipo)) {
        this.tipo = qTipo;
      } else {
        const userRole = this.authService.usuarioActual?.rol;
        if (userRole === 'laboratorio') {
          this.tipo = 'laboratorio';
        } else if (userRole === 'imagenes') {
          this.tipo = 'imagenes';
        } else {
          this.tipo = this.route.snapshot.data['tipo'] || 'medico';
        }
      }
      
      this.cargarEstadoConsultorio();
      this.cargarHistorial();
      if (this.tipo !== 'medico') this.cargarPacientes();
    });
    
    // Escuchar cambios en tiempo real
    this.apiService.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarEstadoConsultorio();
      this.cargarHistorial();
      if (this.tipo !== 'medico') this.cargarPacientes();
    });
  }

  ngOnDestroy() {
    this.detenerTemporizador();
  }

  cargarEstadoConsultorio() {
    const usuario = this.authService.usuarioActual;
    if (!usuario || this.atendiendoLocalmente) return;

    // Lab/Imagenes
    if (this.tipo === 'laboratorio' || this.tipo === 'imagenes') {
      this.consultorioNombre = this.tipo === 'laboratorio' ? 'Laboratorio' : 'Imágenes';
      this.servicioId = usuario.servicio_id || 0;
      this.mensajeInfo = '';

      this.apiService.getMiEstado().subscribe({
        next: (estado: MiEstadoDTO) => {
          this.consultorioEstado = estado.estado || 'LIBRE';

          if (estado.turno_id && !this.atendiendoLocalmente) {
            this.turnoActual = {
              id: estado.turno_id!,
              numero: estado.turno_numero!,
              estado: estado.turno_estado!,
              paciente: {
                nombre: estado.nombre_paciente!,
                apellido: estado.apellido_paciente!,
                documento: estado.documento_paciente!
              },
              hora_llegada: estado.turno_hora_llegada!
            };
          if (estado.turno_estado === 'LLAMADO' && !this.timerSub) {
            this.iniciarTemporizador(estado.hora_llamado);
          }
        } else if (!estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = null;
        }
      },
      error: () => {
        this.consultorioEstado = 'LIBRE';
        this.turnoActual = null;
      }
    });
    return;
  }

  // Otros roles: requieren consultorio
  this.consultorioId = usuario.consultorio_id || 0;

    if (this.consultorioId === 0) {
      this.consultorioNombre = 'Sin Consultorio';
      this.consultorioEstado = 'EN_PAUSA';
      this.mensajeInfo = 'No tienes un consultorio asignado a tu perfil de usuario. Por favor, contacta al administrador o asigna uno desde el panel de gestión de médicos.';
      return;
    }

    this.apiService.getMiEstado().subscribe({
      next: (estado: MiEstadoDTO) => {
        this.consultorioEstado = estado.estado || 'LIBRE';
        this.servicioId = estado.servicio_id;
        this.consultorioNombre = estado.nombre || `Consultorio ${this.consultorioId}`;
        this.mensajeInfo = '';

        if (estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = {
            id: estado.turno_id!,
            numero: estado.turno_numero!,
            estado: estado.turno_estado!,
            paciente: {
              nombre: estado.nombre_paciente!,
              apellido: estado.apellido_paciente!,
              documento: estado.documento_paciente!
            },
            hora_llegada: estado.turno_hora_llegada!
          };
          if (estado.turno_estado === 'LLAMADO' && !this.timerSub) {
            this.iniciarTemporizador(estado.hora_llamado);
          }
        } else if (!estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = null;
        }
      },
      error: (err) => {
        console.error('Error cargando consultorio:', err);
        this.consultorioNombre = `Consultorio ${this.consultorioId}`;
        this.consultorioEstado = 'EN_PAUSA';
        this.mensajeInfo = 'No se pudo cargar el estado del consultorio.';
      }
    });
  }

  llamarSiguiente() {
    if (this.cargando) return; // Prevenir doble click
    this.cargando = true;
    
    this.apiService.llamarSiguiente().subscribe({
      next: (res: LlamarSiguienteResponseDTO) => {
        this.cargando = false;
        if (!res.turno) {
          this.swal.warning(res.mensaje || 'No hay pacientes en espera de este servicio.');
          return;
        }
        this.turnoActual = { ...res.turno };
        this.consultorioEstado = 'OCUPADO';
        this.atendiendoLocalmente = true;
        this.iniciarTemporizador();
      },
      error: (err: any) => {
        this.cargando = false;
        this.swal.error(err.error?.mensaje || 'Error al llamar paciente.');
      }
    });
  }

  iniciarAtencion() {
    this.apiService.iniciarAtencion().subscribe({
      next: () => {
        this.detenerTemporizador();
        if (this.turnoActual) this.turnoActual.estado = 'EN_ATENCION';
        this.consultorioEstado = 'OCUPADO';
        this.atendiendoLocalmente = false;
        this.cargarEstadoConsultorio();
      },
      error: (err: any) => this.swal.error(err.error?.mensaje)
    });
  }

  finalizarAtencion() {
    this.apiService.finalizarAtencion().subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        this.cargarEstadoConsultorio();
      },
      error: (err: any) => this.swal.error(err.error?.mensaje)
    });
  }

  async marcarAusente() {
    if (!this.turnoActual) return;
    const result = await this.swal.confirm(`¿Marcar turno ${this.turnoActual.numero} como AUSENTE?`);
    if (!result.isConfirmed) return;
    this.apiService.marcarAusente(this.turnoActual.id).subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        this.detenerTemporizador();
        this.cargarEstadoConsultorio();
        this.cargarHistorial();
      },
      error: (err: any) => this.swal.error(err.error?.mensaje)
    });
  }

  marcarAusenteAuto() {
    if (!this.turnoActual) return;
    this.apiService.marcarAusente(this.turnoActual.id).subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        this.cargarEstadoConsultorio();
        this.cargarHistorial();
      },
      error: (err: any) => this.swal.error(err.error?.mensaje)
    });
  }

  iniciarTemporizador(horaLlamado?: string) {
    this.detenerTemporizador();

    if (horaLlamado) {
      const llamadoAt = new Date(horaLlamado).getTime();
      const ahora = Date.now();
      const segundosPasados = Math.floor((ahora - llamadoAt) / 1000);
      this.tiempoRestante = Math.max(0, 120 - segundosPasados);
    } else {
      this.tiempoRestante = 120;
    }

    this.timerSub = interval(1000).subscribe(() => {
      this.tiempoRestante--;
      if (this.tiempoRestante <= 0) {
        this.detenerTemporizador();
        this.marcarAusenteAuto();
      }
    });
  }

  detenerTemporizador() {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }



  cargarHistorial() {
    this.cargando = true;
    const usuario = this.authService.usuarioActual;
    const cid = usuario?.consultorio_id;
    const eid = usuario?.id_especialidad;
    const sid = usuario?.servicio_id;

    this.apiService.getTurnos().subscribe({
      next: (turnos: TurnoDTO[]) => {
        const turnosNormalizados = turnos.map(t => ({
          ...t,
          paciente: t.paciente || { nombre: '', apellido: '', documento: '' }
        }));

        // 1. Filtrar HISTORIAL según el tipo
        const estadoMayusAusente = (estado: string) => estado.toUpperCase() === 'AUSENTE';

        if (this.tipo === 'laboratorio') {
          this.turnosAtendidos = turnosNormalizados.filter(t =>
            estadoMayusAusente(t.estado) &&
            (t.nombre_servicio || '').toLowerCase().includes('laboratorio')
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        } else if (this.tipo === 'imagenes') {
          this.turnosAtendidos = turnosNormalizados.filter(t =>
            estadoMayusAusente(t.estado) &&
            ((t.nombre_servicio || '').toLowerCase().includes('imágenes') ||
             (t.nombre_servicio || '').toLowerCase().includes('imagenes'))
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        } else if (eid && cid) {
          this.turnosAtendidos = turnosNormalizados.filter(t => {
            const turnoEspId = t.id_especialidad ? Number(t.id_especialidad) : null;
            const turnoConId = t.id_consultorio ? Number(t.id_consultorio) : null;
            const esDeMiEspecialidad = turnoEspId === Number(eid);
            const esDeMiConsultorio = turnoConId === Number(cid);
            return esDeMiEspecialidad && esDeMiConsultorio && estadoMayusAusente(t.estado);
          }).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        } else if (cid) {
          this.turnosAtendidos = turnosNormalizados.filter(t => 
            t.id_consultorio == cid && estadoMayusAusente(t.estado)
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        }

        // 2. Calcular TURNOS EN ESPERA
        const miServicioId = sid ? Number(sid) : null;

        if (miServicioId) {
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const turnoServId = t.id_servicio ? Number(t.id_servicio) : null;
            const estadoMayus = (t.estado || '').toUpperCase();
            return turnoServId === miServicioId && estadoMayus === 'SALA DE ESPERA';
          }).length;
        } else if (this.tipo === 'laboratorio') {
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const estadoMayus = (t.estado || '').toUpperCase();
            return (t.nombre_servicio || '').toLowerCase().includes('laboratorio') && estadoMayus === 'SALA DE ESPERA';
          }).length;
        } else if (this.tipo === 'imagenes') {
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const estadoMayus = (t.estado || '').toUpperCase();
            return ((t.nombre_servicio || '').toLowerCase().includes('imágenes') || (t.nombre_servicio || '').toLowerCase().includes('imagenes')) && estadoMayus === 'SALA DE ESPERA';
          }).length;
        } else if (eid) {
          const miEspecialidadId = Number(eid);
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const turnoEspId = t.id_especialidad ? Number(t.id_especialidad) : null;
            const estadoMayus = (t.estado || '').toUpperCase();
            return turnoEspId === miEspecialidadId && estadoMayus === 'SALA DE ESPERA';
          }).length;
        }

        this.tiempoPromedioConsulta = '12 min';
        this.cargando = false;
        
        // FORZAR ACTUALIZACIÓN DE LA UI
      },
      error: (err: any) => {
        console.error('Error cargando historial:', err);
        this.cargando = false;
      }
    });
  }

  get historialFiltrado() {
    if (!this.searchQueryHistorial) return this.turnosAtendidos;
    const query = this.searchQueryHistorial.toLowerCase();
    return this.turnosAtendidos.filter(t => {
      const p = t.paciente;
      if (this.searchFilter === 'nombre') return p.nombre.toLowerCase().includes(query);
      if (this.searchFilter === 'apellido') return (p.apellido || '').toLowerCase().includes(query);
      if (this.searchFilter === 'cedula') return p.documento.includes(query);
      return p.nombre.toLowerCase().includes(query) || (p.apellido || '').toLowerCase().includes(query) || p.documento.includes(query) || t.numero.toLowerCase().includes(query);
    });
  }

  toggleSearchFilterDropdown() {
    this.showSearchFilterDropdown = !this.showSearchFilterDropdown;
  }

  selectSearchFilter(filter: string) {
    this.searchFilter = filter;
    this.showSearchFilterDropdown = false;
  }

  getSearchFilterLabel(filter: string) {
    const labels: Record<string, string> = { todo: 'Todo', nombre: 'Nombre', apellido: 'Apellido', cedula: 'Cédula' };
    return labels[filter] || 'Filtrar';
  }

  // === MÉTODOS PARA TAB PACIENTES (lab/imagenes) ===

  toggleSearchFilterPacientes() {
    this.showSearchFilterDropdownPacientes = !this.showSearchFilterDropdownPacientes;
  }

  selectSearchFilterPacientes(filter: string) {
    this.searchFilterPacientes = filter;
    this.showSearchFilterDropdownPacientes = false;
  }

  getSearchFilterLabelPacientes(): string {
    const labels: Record<string, string> = {
      'todo': 'TODO',
      'nombre': 'NOMBRE',
      'apellido': 'APELLIDO',
      'cedula': 'CÉDULA'
    };
    return labels[this.searchFilterPacientes] || 'TODO';
  }

  cargarPacientes() {
    this.apiService.get<AdmisionDTO[]>('recepcion/ultimas-admisiones').subscribe({
      next: (data) => {
        const items = data || [];
        this.ultimasAdmisiones = items.filter(a => {
          if ((a.nombre_estado || '').toUpperCase() === 'ATENDIDO') return false;

          const servicioLower = (a.nombre_servicio || '').toLowerCase();
          const modalidadPagoLower = (a.modalidad_pago || '').toLowerCase();
          const esParticular = modalidadPagoLower === 'particular';
          const esSeguro = modalidadPagoLower === 'seguro';

          if (this.tipo === 'laboratorio') {
            return servicioLower.includes('laboratorio') && esParticular;
          }
          if (this.tipo === 'imagenes') {
            return (servicioLower.includes('imágenes') || servicioLower.includes('imagenes')) && esParticular;
          }
          return false;
        });
      },
      error: () => console.error('Error cargando pacientes')
    });
  }

  async enviarAPresupuesto(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a Presupuesto/Caja?');
    if (!result.isConfirmed) return;
    this.apiService.actualizarEstadoAtencion(id_atencion, 2).subscribe({
      next: () => this.cargarPacientes(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
    });
  }

  async enviarASalaEspera(id_atencion: number) {
    const result = await this.swal.confirm('¿Deseas enviar este paciente a la Sala de Espera (Ya pagó)?');
    if (!result.isConfirmed) return;
    this.apiService.actualizarEstadoAtencion(id_atencion, 3).subscribe({
      next: () => this.cargarPacientes(),
      error: (err) => this.swal.error(err.error?.mensaje || 'Error al cambiar estado')
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

  onSearchChange(value: string | undefined) {}
}
