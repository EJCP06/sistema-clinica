import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, Megaphone, ClipboardList, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApsScrollDirective } from './aps-scroll.directive';

type SalaMode = 'llegada' | 'consulta' | 'lab-espera' | 'img-espera' | 'aps';

interface APSSeccion {
  id: number;
  titulo: string;
  filtro: {
    estados?: number[];
    servicios?: number[];
    responsable?: number[];
  };
}

interface SalaConfig {
  titulo: string;
  subtitulo: string;
  estados: number[];
  servicios: number[] | null;
  icon: LucideIconData;
  layout: 'llamados' | 'lista' | 'aps' | 'lab' | 'img';
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
    estados: [5],
    servicios: [1],
    icon: Stethoscope,
    layout: 'llamados',
  },
  'lab-espera': {
    titulo: 'LABORATORIO',
    subtitulo: 'Pacientes en laboratorio',
    estados: [],
    servicios: null,
    icon: FlaskConical,
    layout: 'lab',
  },
  'img-espera': {
    titulo: 'IMÁGENES',
    subtitulo: 'Pacientes en imágenes',
    estados: [],
    servicios: null,
    icon: ScanLine,
    layout: 'img',
  },
  aps: {
    titulo: 'PANEL APS',
    subtitulo: 'Pacientes de aseguradoras',
    estados: [],
    servicios: null,
    icon: ClipboardList,
    layout: 'aps',
  },
};

@Component({
  selector: 'app-turnero',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ApsScrollDirective],
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
    { key: 'lab-espera', label: 'Laboratorio', icon: FlaskConical },
    { key: 'img-espera', label: 'Imágenes', icon: ScanLine },
    { key: 'aps', label: 'APS', icon: ClipboardList },
  ];

  readonly seccionesAPS: APSSeccion[] = [
    {
      id: 1,
      titulo: 'ASEGURADORAS',
      filtro: {
        estados: [1, 2, 4, 5, 7],
        servicios: [1, 2, 3],
        responsable: [2],
      }
    },
    {
      id: 2,
      titulo: 'PARTICULARES CONSULTA',
      filtro: {
        estados: [1, 2, 4, 5, 7],
        servicios: [1],
        responsable: [1],
      }
    },
  ];

  apsData: TurnoDTO[][] = [];
  apsLoading: boolean[] = [];

  readonly labSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'PARTICULARES',
      filtro: {
        estados: [1, 2, 4, 5, 7],
        servicios: [2],
        responsable: [1],
      }
    },
  ];
  labData: TurnoDTO[][] = [];
  labLoading: boolean[] = [];

  readonly imgSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'PARTICULARES',
      filtro: {
        estados: [1, 2, 4, 5, 7],
        servicios: [3],
        responsable: [1],
      }
    },
  ];
  imgData: TurnoDTO[][] = [];
  imgLoading: boolean[] = [];

  trackById = (index: number, item: TurnoDTO) => item?.id_atencion ?? item?.id ?? index;

  private queryParamsSub: Subscription | null = null;
  private timerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;
  private cambiosSub: Subscription | null = null;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'llegada';
      this.config = SALAS[this.sala];
      if (this.sala === 'aps') {
        this.apsLoading = this.seccionesAPS.map(() => true);
        this.cargarAPS();
      } else if (this.sala === 'lab-espera') {
        this.labLoading = this.labSections.map(() => true);
        this.cargarLab();
      } else if (this.sala === 'img-espera') {
        this.imgLoading = this.imgSections.map(() => true);
        this.cargarImg();
      } else {
        this.cargarTurnos();
      }
    });

    this.cambiosSub = this.api.cambios$.subscribe(() => {
      if (this.sala === 'aps') {
        this.cargarAPS();
      } else if (this.sala === 'lab-espera') {
        this.cargarLab();
      } else if (this.sala === 'img-espera') {
        this.cargarImg();
      } else {
        this.cargarTurnos();
      }
    });
    this.timerSub = interval(5000).subscribe(() => {
      if (this.sala === 'aps') {
        this.cargarAPS();
      } else if (this.sala === 'lab-espera') {
        this.cargarLab();
      } else if (this.sala === 'img-espera') {
        this.cargarImg();
      } else {
        this.cargarTurnos();
      }
    });
    this.clockSub = interval(1000).subscribe(() => {
      this.fechaActual = new Date();
      this.horaFormateada = this.fechaActual.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      });
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
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

  cargarAPS() {
    for (let i = 0; i < this.seccionesAPS.length; i++) {
      const seccion = this.seccionesAPS[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.apsData[i] = data;
          if (this.apsLoading[i]) this.apsLoading[i] = false;
        },
        error: () => {
          if (!this.apsData[i]) {
            this.apsData[i] = [];
            this.apsLoading[i] = false;
          }
        },
      });
    }
  }

  cargarLab() {
    for (let i = 0; i < this.labSections.length; i++) {
      const seccion = this.labSections[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.labData[i] = data;
          if (this.labLoading[i]) this.labLoading[i] = false;
        },
        error: () => {
          if (!this.labData[i]) {
            this.labData[i] = [];
            this.labLoading[i] = false;
          }
        },
      });
    }
  }

  cargarImg() {
    for (let i = 0; i < this.imgSections.length; i++) {
      const seccion = this.imgSections[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.imgData[i] = data;
          if (this.imgLoading[i]) this.imgLoading[i] = false;
        },
        error: () => {
          if (!this.imgData[i]) {
            this.imgData[i] = [];
            this.imgLoading[i] = false;
          }
        },
      });
    }
  }

  private readonly MAX_VISIBLE = 4;
  private readonly CARD_H = 90;
  private readonly GAP = 12;

  get viewportH(): number {
    return this.MAX_VISIBLE * this.CARD_H + (this.MAX_VISIBLE - 1) * this.GAP;
  }

}
