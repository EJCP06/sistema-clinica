import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule, Users, Bell, CheckCircle, Clock, ArrowRight, UserCheck, Activity } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
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
  pacientesEspera: any[] = [];
  pacienteActual: any = null;
  loading: boolean = false;
  timerSubscription: Subscription | null = null;
  
  // Perfil Médico
  medicoInfo: any = {
    id_servicio: null,
    servicio_nombre: ''
  };

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
      this.medicoInfo.id_servicio = user.servicio_id;
      this.medicoInfo.servicio_nombre = user.especialidad_nombre || 'Especialista';
    }

    // Primero intentamos recuperar de la sesión para evitar parpadeos
    this.recuperarPacienteSesion();
    this.cargarPacientes();
    
    // Refresco automático cada 30 segundos
    this.timerSubscription = interval(30000).subscribe(() => this.cargarPacientes());
  }

  private recuperarPacienteSesion() {
    const guardado = sessionStorage.getItem('paciente_atendiendo_data');
    if (guardado) {
      this.pacienteActual = JSON.parse(guardado);
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
      } else return;
    }

    this.loading = true;
    this.api.get(`medico/espera?id_servicio=${this.medicoInfo.id_servicio}`).subscribe({
      next: (data: any[]) => {
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

  llamarSiguiente() {
    if (this.pacientesEspera.length === 0 || this.pacienteActual) return;
    
    const proximo = this.pacientesEspera[0];
    
    // Bloqueo inmediato para evitar doble clic y parpadeos
    this.pacienteActual = { ...proximo, nombre_estado: 'En Atención' };
    sessionStorage.setItem('paciente_atendiendo_data', JSON.stringify(this.pacienteActual));
    this.pacientesEspera.shift();

    this.api.post('medico/llamar', { id_atencion: proximo.id_atencion }).subscribe({
      next: () => {
        // No llamamos a cargarPacientes() inmediatamente para dar tiempo a la DB
        setTimeout(() => this.cargarPacientes(), 1000); 
      },
      error: (err) => {
        console.error('Error al llamar:', err);
        this.pacienteActual = null;
        sessionStorage.removeItem('paciente_atendiendo_data');
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
