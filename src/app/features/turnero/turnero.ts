import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, Megaphone, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';

type SalaMode = 'llegada' | 'consulta' | 'lab-espera' | 'lab-llamados' | 'img-espera' | 'img-llamados';

interface SalaConfig {
  titulo: string;
  subtitulo: string;
  estados: number[];
  servicios: number[] | null;
  icon: LucideIconData;
  layout: 'llamados' | 'lista';
}

const SALAS: Record<SalaMode, SalaConfig> = {
  llegada: {
    titulo: 'RECIÉN LLEGADOS',
    subtitulo: 'Pacientes registrados pendientes por procesar',
    estados: [1],
    servicios: null,
    icon: Users,
    layout: 'lista',
  },
  consulta: {
    titulo: 'LLAMADOS CONSULTA',
    subtitulo: 'Pacientes llamados a consulta médica',
    estados: [7],
    servicios: [1],
    icon: Stethoscope,
    layout: 'llamados',
  },
  'lab-espera': {
    titulo: 'SALA DE ESPERA - LABORATORIO',
    subtitulo: 'Pacientes esperando en laboratorio',
    estados: [3],
    servicios: [2],
    icon: FlaskConical,
    layout: 'lista',
  },
  'lab-llamados': {
    titulo: 'ORDEN SERVICIO - LABORATORIO',
    subtitulo: 'Pacientes llamados a laboratorio',
    estados: [7],
    servicios: [2],
    icon: Megaphone,
    layout: 'llamados',
  },
  'img-espera': {
    titulo: 'SALA DE ESPERA - IMÁGENES',
    subtitulo: 'Pacientes esperando en imágenes',
    estados: [3],
    servicios: [3],
    icon: ScanLine,
    layout: 'lista',
  },
  'img-llamados': {
    titulo: 'ORDEN SERVICIO - IMÁGENES',
    subtitulo: 'Pacientes llamados a imágenes',
    estados: [7],
    servicios: [3],
    icon: Megaphone,
    layout: 'llamados',
  },
};

@Component({
  selector: 'app-turnero',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './turnero.html'
})
export class TurneroComponent implements OnInit, OnDestroy {
  readonly Bell = Bell;
  readonly Volume2 = Volume2;
  readonly Clock = Clock;

  turnos: TurnoDTO[] = [];
  fechaActual: Date = new Date();
  horaFormateada: string = '';

  sala: SalaMode = 'llegada';
  config!: SalaConfig;
  readonly salasDisponibles: { key: SalaMode; label: string; icon: LucideIconData }[] = [
    { key: 'llegada', label: 'Recién Llegados', icon: Users },
    { key: 'consulta', label: 'Consulta', icon: Stethoscope },
    { key: 'lab-espera', label: 'Lab Espera', icon: FlaskConical },
    { key: 'lab-llamados', label: 'Lab Llamados', icon: Megaphone },
    { key: 'img-espera', label: 'Img Espera', icon: ScanLine },
    { key: 'img-llamados', label: 'Img Llamados', icon: Megaphone },
  ];

  trackById = (index: number, item: TurnoDTO) => item?.id_atencion ?? item?.id ?? index;

  private timerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;
  private cambiosSub: Subscription | null = null;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'llegada';
      this.config = SALAS[this.sala];
      this.cargarTurnos();
    });

    this.cambiosSub = this.api.cambios$.subscribe(() => this.cargarTurnos());
    this.timerSub = interval(5000).subscribe(() => this.cargarTurnos());
    this.clockSub = interval(1000).subscribe(() => {
      this.fechaActual = new Date();
      this.horaFormateada = this.fechaActual.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      });
    });
  }

  ngOnDestroy() {
    this.cambiosSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
  }

  cambiarSala(sala: SalaMode) {
    this.router.navigate([], { queryParams: { sala }, replaceUrl: true });
  }

  cargarTurnos() {
    const params = new URLSearchParams();
    if (this.config.estados.length > 0) params.set('estados', this.config.estados.join(','));
    if (this.config.servicios) params.set('servicios', this.config.servicios.join(','));

    this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
      next: (data) => this.turnos = data,
      error: () => console.error('Error turnero:'),
    });
  }
}
