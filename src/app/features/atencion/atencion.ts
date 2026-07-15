import { Component, inject, OnInit, OnDestroy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { SwalService } from '@core/services/swal.service';
import { TurnoDTO, MiEstadoDTO, LlamarSiguienteResponseDTO, ApiResponse } from '@core/models/dto.models';
import { Subscription, interval } from 'rxjs';
import { LucideAngularModule, Play, Pause, Coffee, Volume2, CheckCircle2, ArrowRightLeft, UserX, MonitorSpeaker, IdCard, X, Search, Calendar, Clock, Download, ChevronRight, ChevronDown, FileText, RefreshCcw } from 'lucide-angular';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { PaginationComponent } from '../../shared/components/pagination/pagination';
import { PaginatePipe } from '../../shared/pipes/paginate.pipe';
import { FillersPipe } from '../../shared/pipes/fillers.pipe';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-atencion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Header, Sidebar, PaginationComponent, PaginatePipe, FillersPipe],
  templateUrl: './atencion.html',
  styles: []
})
/**
 * Panel de atención médica/laboratorio/imágenes.
 * Gestiona llamado de pacientes, inicio y fin de atención,
 * temporizador de ausencia, historial de turnos atendidos
 * y listado de pacientes en espera.
 */
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
  readonly RefreshCcw = RefreshCcw;

  tipo: string = 'medico';
  esperaPageSize = 4;
  historialPageSize = 4;
  currentHistorialPage = 1;
  currentHistorialTabPage = 1;
  currentEsperaPage = 1;

  sidebarOpen: boolean = false;
  vista: string = 'completa';


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

  tienePermiso(permiso: string): boolean { return this.authService.tienePermiso(permiso); }

  tienePermisoAtencion(accion: string): boolean {
    const p = this.tipo === 'medico' ? 'atencion_medica' : this.tipo;
    return this.authService.tienePermiso(`${p}:${accion}`) || 
           this.authService.tienePermiso(`${p}:*`) || 
           this.authService.tienePermiso(`${p}_${accion}`);
  }

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

  turnosAtendidos: TurnoDTO[] = [];
  turnosEnEsperaLista: TurnoDTO[] = [];
  searchQueryHistorial: string = '';
  searchFilter: string = 'todo';
  showSearchFilterDropdown: boolean = false;
  totalAtendidosHoy: number = 0;
  tiempoPromedioConsulta: string = '0 min';

  trackById = (index: number, item: TurnoDTO) => item.id ?? index;

  /** Inicializa el componente: determina tipo (médico/lab/imágenes), carga estado y suscripciones. */
  ngOnInit() {
    this.diagnosticarVoces();
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

      const qVista = params['vista'];
      if (qVista === 'llamado' || qVista === 'atencion') {
        this.vista = qVista;
      } else {
        this.vista = 'completa';
      }
      
      this.cargarEstadoConsultorio();
      this.cargarHistorial();
    });
    
    this.apiService.cambios$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => {
      this.cargarEstadoConsultorio();
      this.cargarHistorial();
    });
  }

  ngOnDestroy() {
    this.detenerTemporizador();
  }

  private diagnosticarVoces() {
    if (!('speechSynthesis' in window)) return;
    const voces = window.speechSynthesis.getVoices();
    if (voces.length > 0) {
      console.log('Voces disponibles:', voces.map(v => ({ name: v.name, lang: v.lang, gender: '' })));
    }
    window.speechSynthesis.onvoiceschanged = () => {
      const voces = window.speechSynthesis.getVoices();
      console.log('Voces disponibles:', voces.map(v => v.name + ' (' + v.lang + ')'));
    };
  }

  /** Consulta el estado actual del consultorio/turno activo del médico autenticado. */
  cargarEstadoConsultorio() {
    const usuario = this.authService.usuarioActual;
    if (!usuario || this.atendiendoLocalmente) return;

    if (this.tipo === 'laboratorio' || this.tipo === 'imagenes') {
      this.consultorioNombre = this.tipo === 'laboratorio' ? 'Laboratorio' : 'Imágenes';
      this.servicioId = usuario.servicio_id || 0;
      this.mensajeInfo = '';

      this.apiService.getMiEstado().subscribe({
        next: (estado: MiEstadoDTO) => {
          this.consultorioEstado = estado.estado || 'LIBRE';

          if (estado.turno_id && !this.atendiendoLocalmente) {
            let status = estado.turno_estado || '';
            if (status === 'ATENDIDO') status = 'EN_ATENCION';

            if (status === 'LLAMADO' || status === 'EN_ATENCION') {
              this.turnoActual = {
                id: estado.turno_id!,
                numero: estado.turno_numero!,
                estado: status,
                paciente: {
                  nombre: estado.nombre_paciente!,
                  apellido: estado.apellido_paciente!,
                  documento: estado.documento_paciente!
                },
                hora_llegada: estado.turno_hora_llegada!
              };
              if (status === 'LLAMADO' && !this.timerSub) {
                this.iniciarTemporizador(estado.hora_llamado);
              }
            } else {
              this.turnoActual = null;
              this.detenerTemporizador();
            }
          } else if (!estado.turno_id && !this.atendiendoLocalmente) {
            this.turnoActual = null;
            this.detenerTemporizador();
          }
      },
      error: () => {
        this.consultorioEstado = 'LIBRE';
        this.turnoActual = null;
      }
    });
    return;
  }

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
          const status = estado.turno_estado || '';
          if (status === 'LLAMADO' || status === 'EN_ATENCION') {
            this.turnoActual = {
              id: estado.turno_id!,
              numero: estado.turno_numero!,
              estado: status,
              paciente: {
                nombre: estado.nombre_paciente!,
                apellido: estado.apellido_paciente!,
                documento: estado.documento_paciente!
              },
              hora_llegada: estado.turno_hora_llegada!
            };
            if (status === 'LLAMADO' && !this.timerSub) {
              this.iniciarTemporizador(estado.hora_llamado);
            }
          } else {
            this.turnoActual = null;
            this.detenerTemporizador();
          }
        } else if (!estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = null;
          this.detenerTemporizador();
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

  /** Llama al siguiente paciente en espera y activa el temporizador de ausencia (2 min). */
  llamarSiguiente() {
    if (this.cargando) return;
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
        const msg = err.error?.mensaje || '';
        if (msg.includes('LIBRE')) {
          Swal.fire({
            title: 'Consultorio Ocupado',
            text: 'El sistema detecta que el consultorio aún está ocupado. Si no tiene un paciente activo, puede forzar la liberación.',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Liberar Consultorio',
            cancelButtonText: 'Cancelar'
          }).then((result: any) => {
            if (result.isConfirmed) {
              this.liberarConsultorio();
            }
          });
        } else {
          this.swal.error(msg || 'Error al llamar paciente.');
        }
      }
    });
  }

  /** Fuerza la liberación del consultorio (cuando queda colgado en estado OCUPADO sin paciente). */
  liberarConsultorio() {
    this.cargando = true;
    this.apiService.liberarConsultorio().subscribe({
      next: () => {
        this.cargando = false;
        this.swal.success('Consultorio liberado correctamente.');
        this.cargarEstadoConsultorio();
      },
      error: (err) => {
        this.cargando = false;
        this.swal.error(err.error?.mensaje || 'Error al liberar consultorio.');
      }
    });
  }

  /** Confirma el inicio de la atención (cambia estado a EN_ATENCION). */
  iniciarAtencion() {
    window.speechSynthesis?.cancel();
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

  /** Finaliza la atención y libera el consultorio. */
  finalizarAtencion() {
    window.speechSynthesis?.cancel();
    this.apiService.finalizarAtencion().subscribe({
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

  async marcarAusente() {
    window.speechSynthesis?.cancel();
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
    window.speechSynthesis?.cancel();
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



  /** Carga el historial de turnos atendidos y la lista de pacientes en espera. */
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

        const estadoValido = (estado: string) => {
          const e = (estado || '').toUpperCase();
          return e === 'ATENDIDO' || e === 'AUSENTE';
        };

        if (this.tipo === 'laboratorio') {
          this.turnosAtendidos = turnosNormalizados.filter(t =>
            estadoValido(t.estado) &&
            (t.nombre_servicio || '').toLowerCase().includes('laboratorio')
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        } else if (this.tipo === 'imagenes') {
          this.turnosAtendidos = turnosNormalizados.filter(t =>
            estadoValido(t.estado) &&
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
            return esDeMiEspecialidad && esDeMiConsultorio && estadoValido(t.estado);
          }).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        } else if (cid) {
          this.turnosAtendidos = turnosNormalizados.filter(t => 
            t.id_consultorio == cid && estadoValido(t.estado)
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.length;
        }

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

        const esEstadoEspera = (estado: string) => {
          const e = (estado || '').toUpperCase();
          return e === 'SALA DE ESPERA' || e === 'LLAMADO' || e === 'EN_ATENCION';
        };
        const turnoActualId = this.turnoActual?.id;

        if (miServicioId) {
          this.turnosEnEsperaLista = turnosNormalizados.filter(t => {
            const turnoServId = t.id_servicio ? Number(t.id_servicio) : null;
            return turnoServId === miServicioId && esEstadoEspera(t.estado) && t.id !== turnoActualId;
          }).sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime());
        } else if (this.tipo === 'laboratorio') {
          this.turnosEnEsperaLista = turnosNormalizados.filter(t =>
            (t.nombre_servicio || '').toLowerCase().includes('laboratorio') && esEstadoEspera(t.estado) && t.id !== turnoActualId
          ).sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime());
        } else if (this.tipo === 'imagenes') {
          this.turnosEnEsperaLista = turnosNormalizados.filter(t =>
            ((t.nombre_servicio || '').toLowerCase().includes('imágenes') || (t.nombre_servicio || '').toLowerCase().includes('imagenes')) && esEstadoEspera(t.estado) && t.id !== turnoActualId
          ).sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime());
        } else if (eid && cid) {
          const miEsp = Number(eid);
          const miCon = Number(cid);
          this.turnosEnEsperaLista = turnosNormalizados.filter(t => {
            const turnoEspId = t.id_especialidad ? Number(t.id_especialidad) : null;
            const turnoConId = t.id_consultorio ? Number(t.id_consultorio) : null;
            return turnoEspId === miEsp && turnoConId === miCon && esEstadoEspera(t.estado) && t.id !== turnoActualId;
          }).sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime());
        } else if (cid) {
          this.turnosEnEsperaLista = turnosNormalizados.filter(t =>
            t.id_consultorio == cid && esEstadoEspera(t.estado) && t.id !== turnoActualId
          ).sort((a, b) => new Date(a.hora_llegada).getTime() - new Date(b.hora_llegada).getTime());
        } else {
          this.turnosEnEsperaLista = [];
        }

        this.tiempoPromedioConsulta = '12 min';
        this.cargando = false;
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

  get esperaFiltrado() {
    if (!this.searchQueryHistorial) return this.turnosEnEsperaLista;
    const query = this.searchQueryHistorial.toLowerCase();
    return this.turnosEnEsperaLista.filter(t => {
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

}
