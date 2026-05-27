import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Users, Bell, CheckCircle, Clock, ArrowRight, UserCheck, Activity } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { PacienteEnEsperaDTO } from '../../core/models/dto.models';
import { Subscription, interval } from 'rxjs';

import { Sidebar } from '../../shared/components/sidebar/sidebar';
import { Header } from '../../shared/components/header/header';

@Component({
  selector: 'app-panel-medico',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, Sidebar, Header],
  templateUrl: './panel-medico.html'
})
export class PanelMedicoComponent implements OnInit, OnDestroy {
  // Iconos
  readonly Users = Users;
  readonly Bell = Bell;
  readonly CheckCircle = CheckCircle;
  readonly Clock = Clock;
  readonly ArrowRight = ArrowRight;
  readonly UserCheck = UserCheck;
  readonly Activity = Activity;

  // Estados
  sidebarOpen: boolean = false;
  pacientesEspera: PacienteEnEsperaDTO[] = [];
  pacienteActual: PacienteEnEsperaDTO | null = null;
  pacientesAtendidosHoy: PacienteEnEsperaDTO[] = [];
  loading: boolean = false;
  timerSubscription: Subscription | null = null;
  
  // Perfil Médico
  medicoInfo: {
    id_servicio: number | null;
    id_especialidad: number | null;
    servicio_nombre: string;
  } = {
    id_servicio: null,
    id_especialidad: null,
    servicio_nombre: ''
  };

  trackById = (index: number, item: PacienteEnEsperaDTO) => item?.id_atencion ?? index;

  constructor(
    private api: ApiService, 
    private router: Router,
    private auth: AuthService
  ) {}

  onTabChange(tab: string) {
    if (tab === 'dashboard') this.router.navigate(['/admin']);
    if (tab === 'recepcion') this.router.navigate(['/recepcion']);
  }

  ngOnInit() {
    const user = this.auth.usuarioActual;
    if (user) {
      this.medicoInfo.id_servicio = user.servicio_id ?? null;
      this.medicoInfo.id_especialidad = user.id_especialidad ?? null;
      this.medicoInfo.servicio_nombre = user.especialidad_nombre || 'Especialista';
    }

    // Primero intentamos recuperar de la sesión para evitar parpadeos
    this.recuperarPacienteSesion();
    this.cargarPacientes();
    this.cargarAtendidosHoy();
    
    // Refresco automático cada 30 segundos
    this.timerSubscription = interval(30000).subscribe(() => {
      this.cargarPacientes();
      this.cargarAtendidosHoy();
    });
  }

  private recuperarPacienteSesion() {
    const guardado = sessionStorage.getItem('paciente_atendiendo_data');
    if (guardado) {
      this.pacienteActual = JSON.parse(guardado) as PacienteEnEsperaDTO;
    }
  }

  ngOnDestroy() {
    if (this.timerSubscription) {
      this.timerSubscription.unsubscribe();
    }
  }

  cargarPacientes() {
    if (!this.medicoInfo.id_servicio) {
      const sesion = sessionStorage.getItem('clinica_usuario');
      if (sesion) {
        const user = JSON.parse(sesion);
        this.medicoInfo.id_servicio = user.servicio_id;
        this.medicoInfo.id_especialidad = user.id_especialidad;
      } else return;
    }

    this.loading = true;
    const params = `?id_servicio=${this.medicoInfo.id_servicio}${this.medicoInfo.id_especialidad ? '&id_especialidad=' + this.medicoInfo.id_especialidad : ''}`;
    this.api.get<PacienteEnEsperaDTO[]>(`medico/espera${params}`).subscribe({
      next: (data) => {
        const normalizar = (s: string) => (s || '').toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        
        // 1. Filtrar lista de espera (excluir al que ya se está atendiendo)
        this.pacientesEspera = data.filter(p => {
          const st = normalizar(p.nombre_estado);
          return st !== 'en atencion' && st !== 'atendido' && st !== 'ausente';
        });
        
        // 2. Sincronizar paciente actual
        const enAtencionServer = data.find(p => normalizar(p.nombre_estado) === 'en atencion');
        
        if (enAtencionServer) {
          // SOLO ACTUALIZAR SI ES UN PACIENTE DIFERENTE
          if (!this.pacienteActual || this.pacienteActual.id_atencion !== enAtencionServer.id_atencion) {
            this.pacienteActual = enAtencionServer;
            sessionStorage.setItem('paciente_atendiendo_data', JSON.stringify(enAtencionServer));
          }
        } else {
          if (!sessionStorage.getItem('paciente_atendiendo_data')) {
            this.pacienteActual = null;
          }
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error cargando pacientes:', err);
        this.loading = false;
      }
    });
  }

  cargarAtendidosHoy() {
    if (!this.medicoInfo.id_servicio) return;
    const params = `?id_servicio=${this.medicoInfo.id_servicio}${this.medicoInfo.id_especialidad ? '&id_especialidad=' + this.medicoInfo.id_especialidad : ''}`;
    this.api.get<PacienteEnEsperaDTO[]>(`medico/atendidos-hoy${params}`).subscribe({
      next: (data) => { this.pacientesAtendidosHoy = data; },
      error: () => {}
    });
  }

  llamarSiguiente() {
  if (this.pacientesEspera.length === 0 || this.pacienteActual) return;
  
  const proximo = this.pacientesEspera[0];
  
  // Llamada al backend para cambiar el estado
  this.api.post('medico/llamar', { id_atencion: proximo.id_atencion }).subscribe({
    next: () => {
      // Actualizamos el estado optimísticamente para mejorar la UX
      this.pacienteActual = { ...proximo, nombre_estado: 'En Atención' };
      sessionStorage.setItem('paciente_atendiendo_data', JSON.stringify(this.pacienteActual));
      this.pacientesEspera.shift();
      
      // Programamos una actualización para sincronizar con el backend
      this.cargarPacientes(); 
    },
    error: (err) => {
      console.error('Error al llamar:', err);
      // En caso de error, no cambiamos el estado
      this.cargarPacientes();
    }
  });
}

  finalizarAtencion() {
    if (!this.pacienteActual) return;

    const id = this.pacienteActual.id_atencion;
    
    // Limpieza inmediata en UI
    this.pacienteActual = null;
    sessionStorage.removeItem('paciente_atendiendo_data');

    this.api.post('medico/finalizar', { id_atencion: id }).subscribe({
      next: () => this.cargarPacientes(),
      error: (err) => {
        console.error('Error al finalizar:', err);
        this.cargarPacientes();
      }
    });
  }

  getTiempoEspera(horaLlegada: string): string {
    if (!horaLlegada) return '0 min';
    const llegada = new Date(horaLlegada);
    const ahora = new Date();
    const difMinutos = Math.floor((ahora.getTime() - llegada.getTime()) / 60000);
    return `${difMinutos} min`;
  }
}
