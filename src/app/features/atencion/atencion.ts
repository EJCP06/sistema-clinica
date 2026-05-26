import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService, LlamarSiguienteResponse } from '@core/services/api.service';
import { AuthService } from '@core/services/auth.service';
import { ThemeService } from '@core/services/theme.service';
import { Subscription, interval } from 'rxjs';
import { LucideAngularModule, Play, Pause, Coffee, Volume2, CheckCircle2, ArrowRightLeft, UserX, MonitorSpeaker, IdCard, X, Search, Calendar, Clock, Download, ChevronRight, ChevronDown } from 'lucide-angular';
import { Header } from '../../shared/components/header/header';
import { Sidebar } from '../../shared/components/sidebar/sidebar';

@Component({
  selector: 'app-atencion',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Header, Sidebar],
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

  sidebarOpen: boolean = false;
  activeTab: string = 'atencion';

  private apiService = inject(ApiService);
  private authService = inject(AuthService);
  private themeService = inject(ThemeService);
  private cdr = inject(ChangeDetectorRef);

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

  turnoActual: any | null = null;
  turnosEnEspera: number = 0;
  proximosTurnos: any[] = [];

  tiempoRestante: number = 120;
  private timerSub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  mensajeInfo = '';
  cargando = false;

  // Historial
  turnosAtendidos: any[] = [];
  searchQueryHistorial: string = '';
  searchFilter: string = 'todo';
  showSearchFilterDropdown: boolean = false;
  totalAtendidosHoy: number = 0;
  tiempoPromedioConsulta: string = '0 min';

  ngOnInit() {
    this.cargarEstadoConsultorio();
    this.cargarHistorial();
    
    // Escuchar cambios en tiempo real
    this.pollSub = this.apiService.cambios$.subscribe(() => {
      this.cargarEstadoConsultorio();
      this.cargarHistorial();
    });
  }

  ngOnDestroy() {
    this.pollSub?.unsubscribe();
    this.detenerTemporizador();
  }

  cargarEstadoConsultorio() {
    const usuario = this.authService.usuarioActual;
    // Si estamos atendiendo localmente (llamando o en atención), pausamos el refresco del estado del consultorio 
    // para evitar que el servidor nos diga 'LIBRE' por un delay de DB
    if (!usuario || this.atendiendoLocalmente) return;

    this.consultorioId = usuario.consultorio_id || 0;

    if (this.consultorioId === 0) {
      this.consultorioNombre = 'Sin Consultorio';
      this.consultorioEstado = 'EN_PAUSA';
      this.mensajeInfo = 'No tienes un consultorio asignado a tu perfil de usuario. Por favor, contacta al administrador o asigna uno desde el panel de gestión de médicos.';
      return;
    }

    this.apiService.getMiEstado().subscribe({
      next: (estado: any) => {
        this.consultorioEstado = estado.estado || 'LIBRE';
        this.servicioId = estado.servicio_id;
        this.consultorioNombre = estado.nombre || `Consultorio ${this.consultorioId}`;
        this.mensajeInfo = '';

        // Recuperar turno activo si existe y no estamos en medio de una acción local
        if (estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = {
            id: estado.turno_id,
            numero: estado.turno_numero,
            estado: estado.turno_estado,
            paciente: {
              nombre: estado.nombre_paciente,
              documento: estado.documento_paciente
            },
            horaLlegada: estado.turno_hora_llegada
          };
          
          // Si el turno está llamado pero no iniciado, reactivar temporizador
          if (estado.turno_estado === 'LLAMADO' && !this.timerSub) {
            this.iniciarTemporizador();
          }
        } else if (!estado.turno_id && !this.atendiendoLocalmente) {
          this.turnoActual = null;
        }
        this.cdr.detectChanges();
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
    this.mensajeInfo = 'Llamando paciente...';
    
    this.apiService.llamarSiguiente().subscribe({
      next: (res: LlamarSiguienteResponse) => {
        this.cargando = false;
        this.mensajeInfo = '';
        this.turnoActual = {
          id: res.turno.id,
          numero: res.turno.numero,
          estado: res.turno.estado,
          paciente: res.turno.paciente,
          horaLlegada: res.turno.hora_llegada
        };
        this.consultorioEstado = 'OCUPADO';
        this.atendiendoLocalmente = true;
        this.iniciarTemporizador();
        this.cdr.detectChanges();
      },
      error: (err: any) => {
        this.cargando = false;
        this.mensajeInfo = err.error?.mensaje || 'No hay pacientes en espera de este servicio.';
        setTimeout(() => {
          this.mensajeInfo = '';
          this.cdr.detectChanges();
        }, 2000);
        this.cdr.detectChanges();
      }
    });
  }

  iniciarAtencion() {
    this.apiService.iniciarAtencion().subscribe({
      next: () => {
        this.detenerTemporizador();
        this.turnoActual.estado = 'EN_ATENCION';
        this.consultorioEstado = 'OCUPADO';
        this.atendiendoLocalmente = false;
        this.cargarEstadoConsultorio();
        this.cdr.detectChanges();
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  finalizarAtencion() {
    this.apiService.finalizarAtencion().subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        this.cargarEstadoConsultorio();
        this.cdr.detectChanges();
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  marcarAusente() {
    if (!this.turnoActual || !confirm(`¿Marcar turno ${this.turnoActual.numero} como AUSENTE?`)) return;
    this.apiService.marcarAusente(this.turnoActual.id).subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        this.detenerTemporizador();
        this.cargarEstadoConsultorio();
        this.cargarHistorial();
        this.cdr.detectChanges();
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  tiempoExpirado() {
    if (this.turnoActual && this.turnoActual.estado === 'LLAMADO') {
      this.marcarAusenteAuto();
    }
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
        this.cdr.detectChanges();
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  iniciarTemporizador() {
    this.detenerTemporizador();
    this.tiempoRestante = 120;
    this.timerSub = interval(1000).subscribe(() => {
      this.tiempoRestante--;
      this.cdr.detectChanges();
      if (this.tiempoRestante <= 0) {
        this.detenerTemporizador();
        this.tiempoExpirado();
      }
    });
  }

  detenerTemporizador() {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  cambiarTab(tab: string) {
    console.log('Cambiando a tab:', tab);
    this.activeTab = tab;
    this.sidebarOpen = false;
    if (tab === 'historial') {
      this.cargarHistorial();
    }
  }

  cargarHistorial() {
    this.cargando = true;
    const usuario = this.authService.usuarioActual;
    const cid = usuario?.consultorio_id;
    const eid = usuario?.id_especialidad;
    const sid = usuario?.servicio_id;

    console.log('Cargando historial y espera:', { cid, eid, sid });

    this.apiService.getTurnos().subscribe({
      next: (turnos: any[]) => {
        // Normalizar datos (convertir campos planos a objeto paciente si es necesario)
        const turnosNormalizados = turnos.map(t => ({
          ...t,
          paciente: t.paciente || {
            nombre: `${t.nombre || ''} ${t.apellido || ''}`.trim(),
            documento: t.cedula || ''
          }
        }));

        // 1. Filtrar HISTORIAL (atendidos por este médico/consultorio)
        if (eid && cid) {
          this.turnosAtendidos = turnosNormalizados.filter(t => {
            const turnoEspId = t.id_especialidad ? Number(t.id_especialidad) : null;
            const turnoConId = t.id_consultorio ? Number(t.id_consultorio) : null;
            const estadoMayus = (t.estado || '').toUpperCase();
            const esDeMiEspecialidad = turnoEspId === Number(eid);
            const esDeMiConsultorio = turnoConId === Number(cid);
            const esAtendido = ['ATENDIDO', 'AUSENTE'].includes(estadoMayus);
            return esDeMiEspecialidad && esDeMiConsultorio && esAtendido;
          }).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.filter(t => t.estado.toUpperCase() === 'ATENDIDO').length;
        } else if (cid) {
          // Fallback para consultorios sin especialidad definida pero con consultorio asignado
          this.turnosAtendidos = turnosNormalizados.filter(t => 
            t.id_consultorio == cid && 
            ['ATENDIDO', 'AUSENTE'].includes(t.estado.toUpperCase())
          ).sort((a, b) => {
            const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
            const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
            return dateB - dateA;
          });
          this.totalAtendidosHoy = this.turnosAtendidos.filter(t => t.estado.toUpperCase() === 'ATENDIDO').length;
        }

        // 2. Calcular TURNOS EN ESPERA (Filtrar por Especialidad)
        const miEspecialidadId = eid ? Number(eid) : null;
        const miServicioId = sid ? Number(sid) : null;

        if (miEspecialidadId) {
          // Si el médico tiene especialidad, filtramos por ella
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const turnoEspId = t.id_especialidad ? Number(t.id_especialidad) : null;
            const estadoMayus = (t.estado || '').toUpperCase();
            return turnoEspId === miEspecialidadId && ['SALA DE ESPERA'].includes(estadoMayus);
          }).length;
        } else if (miServicioId) {
          // Si no tiene especialidad, por su servicio general
          this.turnosEnEspera = turnosNormalizados.filter(t => {
            const turnoServId = t.id_servicio ? Number(t.id_servicio) : null;
            const estadoMayus = (t.estado || '').toUpperCase();
            return turnoServId === miServicioId && ['SALA DE ESPERA'].includes(estadoMayus);
          }).length;
        }

        this.tiempoPromedioConsulta = '12 min';
        this.cargando = false;
        
        // Debug para el usuario en consola del navegador
        console.log('--- ACTUALIZACIÓN DE DATOS ---');
        console.log('Mi Usuario:', usuario?.nombre, 'ID:', usuario?.id);
        console.log('Mi Especialidad ID (num):', miEspecialidadId);
        console.log('Pacientes totales en BD:', turnosNormalizados.length);
        console.log('Pacientes detectados para MI especialidad:', this.turnosEnEspera);
        
        if (this.turnosEnEspera === 0 && turnosNormalizados.length > 0) {
          const primerTurno = turnosNormalizados[0];
          console.log('Analizando primer turno de la lista:', {
            numero: primerTurno.numero,
            espId: primerTurno.id_especialidad,
            estado: primerTurno.estado
          });
        }
        
        // FORZAR ACTUALIZACIÓN DE LA UI
        this.cdr.detectChanges();
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
    const labels: any = { all: 'Todo', nombre: 'Nombre', apellido: 'Apellido', cedula: 'Cédula' };
    return labels[filter] || 'Filtrar';
  }
}
