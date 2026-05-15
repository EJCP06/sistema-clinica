import { Component, inject, OnInit, OnDestroy } from '@angular/core';
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
      especialidadId: String(this.servicioId),
      medicoAsignado: this.authService.usuarioActual?.nombre || ''
    };
  }

  turnoActual: any | null = null;
  turnosEnEspera: number = 0;
  proximosTurnos: any[] = [];

  tiempoRestante: number = 60;
  private timerSub: Subscription | null = null;
  private pollSub: Subscription | null = null;

  mensajeInfo = '';
  cargando = false;

  // Historial
  turnosAtendidos: any[] = [];
  searchQueryHistorial: string = '';
  searchFilter: string = 'all';
  showSearchFilterDropdown: boolean = false;
  totalAtendidosHoy: number = 0;
  tiempoPromedioConsulta: string = '0 min';

  // Modal de Transferencia
  mostrarModalTransferencia = false;
  especialidadesDisponibles: any[] = [];
  especialidadDestinoId = '';

  ngOnInit() {
    this.cargarEstadoConsultorio();
    this.cargarHistorial();
    // Polling cada 5 segundos para actualizar el estado
    this.pollSub = interval(5000).subscribe(() => {
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
    this.cargando = true;
    this.apiService.llamarSiguiente().subscribe({
      next: (res: LlamarSiguienteResponse) => {
        this.cargando = false;
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
      },
      error: (err: any) => {
        this.cargando = false;
        this.mensajeInfo = err.error?.mensaje || 'No hay pacientes en espera.';
        setTimeout(() => this.mensajeInfo = '', 3000);
      }
    });
  }

  iniciarAtencion() {
    this.detenerTemporizador();
    this.apiService.iniciarAtencion().subscribe({
      next: () => this.consultorioEstado = 'OCUPADO',
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  finalizarAtencion() {
    this.apiService.finalizarAtencion().subscribe({
      next: () => {
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  pausarConsultorio() {
    this.apiService.pausarConsultorio().subscribe({
      next: () => this.consultorioEstado = 'EN_DESCANSO',
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  reanudarConsultorio() {
    this.apiService.reanudarConsultorio().subscribe({
      next: () => this.consultorioEstado = 'LIBRE',
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
      },
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  pausarAtencion() {
    if (!this.turnoActual) return;
    this.apiService.pausarAtencion(this.turnoActual.id).subscribe({
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  reanudarAtencion() {
    if (!this.turnoActual) return;
    this.apiService.reanudarAtencion(this.turnoActual.id).subscribe({
      error: (err: any) => alert(err.error?.mensaje)
    });
  }

  iniciarTemporizador() {
    this.tiempoRestante = 60;
    this.detenerTemporizador();
    this.timerSub = interval(1000).subscribe(() => {
      this.tiempoRestante--;
      if (this.tiempoRestante <= 0) {
        this.detenerTemporizador();
        this.tiempoExpirado();
      }
    });
  }

  tiempoExpirado() {
    if (this.turnoActual && this.turnoActual.estado === 'LLAMADO') {
      this.marcarAusente();
    }
  }

  detenerTemporizador() {
    this.timerSub?.unsubscribe();
    this.timerSub = null;
  }

  // --- Transferencia ---
  abrirModalTransferencia() {
    this.apiService.getServicios().subscribe({
      next: (svs: any[]) => {
        this.especialidadesDisponibles = svs.filter((s: any) => s.id !== this.servicioId);
        this.especialidadDestinoId = '';
        this.mostrarModalTransferencia = true;
      }
    });
  }

  cerrarModalTransferencia() {
    this.mostrarModalTransferencia = false;
    this.especialidadDestinoId = '';
  }

  confirmarTransferencia() {
    if (!this.especialidadDestinoId || !this.turnoActual) return;
    this.apiService.transferirPaciente(this.turnoActual.id, Number(this.especialidadDestinoId)).subscribe({
      next: (res: any) => {
        const destino = this.especialidadesDisponibles.find((s: any) => s.id === Number(this.especialidadDestinoId));
        this.cerrarModalTransferencia();
        this.turnoActual = null;
        this.consultorioEstado = 'LIBRE';
        this.atendiendoLocalmente = false;
        alert(`Transferido. Nuevo turno: ${res.nuevo_turno?.numero} en ${destino?.nombre}`);
      },
      error: (err: any) => alert(err.error?.mensaje || 'Error al transferir')
    });
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

    if (!cid) {
      this.turnosAtendidos = [];
      this.totalAtendidosHoy = 0;
      this.cargando = false;
      return;
    }

    console.log('Cargando historial para consultorio:', cid);

    this.apiService.getTurnos().subscribe({
      next: (turnos: any[]) => {
        this.turnosAtendidos = turnos.filter(t => 
          t.consultorio_id == cid && 
          ['ATENDIDO', 'AUSENTE', 'TRANSFERIDO'].includes(t.estado)
        ).sort((a, b) => {
          const dateA = new Date(a.updated_at || a.hora_llegada).getTime();
          const dateB = new Date(b.updated_at || b.hora_llegada).getTime();
          return dateB - dateA;
        });
        
        this.totalAtendidosHoy = this.turnosAtendidos.filter(t => t.estado === 'ATENDIDO').length;
        this.tiempoPromedioConsulta = '12 min';
        this.cargando = false;
        console.log('Historial cargado:', this.turnosAtendidos.length, 'registros');
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
      if (this.searchFilter === 'cedula') return p.documento.includes(query);
      return p.nombre.toLowerCase().includes(query) || p.documento.includes(query) || t.numero.toLowerCase().includes(query);
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
    const labels: any = { all: 'Todo', nombre: 'Nombre', cedula: 'Cédula' };
    return labels[filter] || 'Filtrar';
  }
}
