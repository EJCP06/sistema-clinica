import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, Megaphone, ClipboardList, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApsScrollDirective } from './aps-scroll.directive';

type SalaMode = 'aps' | 'aps-espera' | 'lab-espera' | 'lab-en-espera' | 'img-espera' | 'img-en-espera' | 'consulta';

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
  aps: {
    titulo: 'PANEL APS',
    subtitulo: 'Pacientes de Consulta-Laboratorio-Imagenes',
    estados: [],
    servicios: null,
    icon: ClipboardList,
    layout: 'aps',
  },
  'aps-espera': {
    titulo: 'APS EN ESPERA',
    subtitulo: 'Pacientes de Consulta-Laboratorio-Imagenes en espera',
    estados: [],
    servicios: null,
    icon: Users,
    layout: 'aps',
  },
  'lab-espera': {
    titulo: 'LABORATORIO',
    subtitulo: 'Pacientes de laboratorio',
    estados: [],
    servicios: null,
    icon: FlaskConical,
    layout: 'lab',
  },
  'lab-en-espera': {
    titulo: 'LABORATORIO EN ESPERA',
    subtitulo: 'Pacientes de laboratorio en espera',
    estados: [],
    servicios: null,
    icon: Clock,
    layout: 'lab',
  },
  'img-espera': {
    titulo: 'IMÁGENES',
    subtitulo: 'Pacientes de imágenes',
    estados: [],
    servicios: null,
    icon: ScanLine,
    layout: 'img',
  },
  'img-en-espera': {
    titulo: 'IMÁGENES EN ESPERA',
    subtitulo: 'Pacientes de imágenes en espera',
    estados: [],
    servicios: null,
    icon: Clock,
    layout: 'img',
  },
  consulta: {
    titulo: 'CONSULTA',
    subtitulo: 'Pacientes de consulta',
    estados: [],
    servicios: null,
    icon: Stethoscope,
    layout: 'img',
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

  sala: SalaMode = 'aps';
  config!: SalaConfig;
  readonly salasDisponibles: { key: SalaMode; label: string; icon: LucideIconData }[] = [
    { key: 'aps', label: 'APS', icon: ClipboardList },
    { key: 'aps-espera', label: 'APS en espera', icon: Users },
    { key: 'lab-espera', label: 'Laboratorio', icon: FlaskConical },
    { key: 'lab-en-espera', label: 'Laboratorio en espera', icon: Clock },
    { key: 'img-espera', label: 'Imágenes', icon: ScanLine },
    { key: 'img-en-espera', label: 'Imágenes en espera', icon: Clock },
    { key: 'consulta', label: 'Consulta', icon: Stethoscope },
  ];

  readonly seccionesAPS: APSSeccion[] = [
    {
      id: 1,
      titulo: 'LABORATORIO / IMÁGENES (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [1, 2, 7, 8],
        servicios: [2, 3],
        responsable: [1, 2],
      }
    },
    {
      id: 2,
      titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [1, 2, 7, 8],
        servicios: [1],
        responsable: [1, 2],
      }
    },
  ];

  readonly seccionesAPSEspera: APSSeccion[] = [
    {
      id: 1,
      titulo: 'LABORATORIO / IMÁGENES (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [3, 4, 5, 7],
        servicios: [2, 3],
        responsable: [1, 2],
      }
    },
    {
      id: 2,
      titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [3, 4, 5, 7],
        servicios: [1],
        responsable: [1, 2],
      }
    },
  ];

  apsData: TurnoDTO[][] = [];
  apsLoading: boolean[] = [];
  apsEsperaData: TurnoDTO[][] = [];
  apsEsperaLoading: boolean[] = [];

  readonly labSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'LABORATORIO (PARTICULARES)',
      filtro: {
        estados: [1, 2, 8],
        servicios: [2],
        responsable: [1],
      }
    },
  ];
  labData: TurnoDTO[][] = [];
  labLoading: boolean[] = [];

  readonly labEsperaSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'LABORATORIO EN ESPERA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [3, 4, 5, 7],
        servicios: [2],
        responsable: [1, 2],
      }
    },
  ];
  labEsperaData: TurnoDTO[][] = [];
  labEsperaLoading: boolean[] = [];

  readonly imgSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'IMÁGENES (PARTICULARES)',
      filtro: {
        estados: [1, 2, 8],
        servicios: [3],
        responsable: [1],
      }
    },
  ];
  imgData: TurnoDTO[][] = [];
  imgLoading: boolean[] = [];

  readonly imgEsperaSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'IMÁGENES EN ESPERA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [3, 4, 5, 7],
        servicios: [3],
        responsable: [1, 2],
      }
    },
  ];
  imgEsperaData: TurnoDTO[][] = [];
  imgEsperaLoading: boolean[] = [];

  readonly consultaSections: APSSeccion[] = [
    {
      id: 1,
      titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [3, 4, 5, 7],
        servicios: [1],
        responsable: [1, 2],
      }
    },
  ];
  consultaData: TurnoDTO[][] = [];
  consultaLoading: boolean[] = [];

  trackById = (index: number, item: TurnoDTO) => item?.id_atencion ?? item?.id ?? index;

  private queryParamsSub: Subscription | null = null;
  private timerSub: Subscription | null = null;
  private clockSub: Subscription | null = null;
  private cambiosSub: Subscription | null = null;
  private repeatSubscription: Subscription | null = null;
  private pacienteParaRepetir: { paciente: string; apellido: string; consultorio: string } | null = null;

  constructor(
    private api: ApiService,
    private route: ActivatedRoute,
    private router: Router,
  ) {}

  ngOnInit() {
    this.cargarVozFemenina();
    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'aps';
      this.config = SALAS[this.sala];
      this.cargarDatosSala();
    });

    this.cambiosSub = this.api.cambios$.subscribe((data) => {
      const llamado = data as any;
      
      // Detener repetición si el evento indica que el turno ya no debe ser llamado (estado activo o final)
      const esEstadoFinal = [
        'marcar_ausente', 'finalizar', 'ausente', 'finalizado', 
        'iniciar', 'atencion', 'iniciado'
      ].includes(llamado.accion) || 
      ['ausente', 'finalizado', 'iniciado', 'atencion'].includes(llamado.estado);
      
      if (esEstadoFinal) {
        this.detenerRepeticion();
      }

      if (llamado.paciente && llamado.consultorio) {
        this.pacienteParaRepetir = {
          paciente: llamado.paciente,
          apellido: llamado.apellido || '',
          consultorio: llamado.consultorio
        };
        // Pasar el estado para que 'reproducirAudio' pueda filtrar
        this.reproducirAudio(llamado.paciente, llamado.apellido || '', llamado.consultorio, llamado.estado);
        this.iniciarTemporizadorRepeticion();
      }
      this.cargarDatosSala();
    });

    this.timerSub = interval(5000).subscribe(() => {
        this.cargarDatosSala();
    });
    this.clockSub = interval(1000).subscribe(() => {
      this.fechaActual = new Date();
      this.horaFormateada = this.fechaActual.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: true
      });
    });
  }

  private cargarDatosSala() {
      if (this.sala === 'aps') {
        this.cargarAPS();
      } else if (this.sala === 'aps-espera') {
        this.cargarAPSEspera();
      } else if (this.sala === 'lab-espera') {
        this.cargarLab();
      } else if (this.sala === 'lab-en-espera') {
        this.cargarLabEspera();
      } else if (this.sala === 'img-espera') {
        this.cargarImg();
      } else if (this.sala === 'img-en-espera') {
        this.cargarImgEspera();
      } else if (this.sala === 'consulta') {
        this.cargarConsulta();
      }
  }

  private iniciarTemporizadorRepeticion() {
    this.repeatSubscription?.unsubscribe();
    this.repeatSubscription = interval(20000).subscribe(() => {
      if (this.pacienteParaRepetir) {
        this.reproducirAudio(
          this.pacienteParaRepetir.paciente,
          this.pacienteParaRepetir.apellido,
          this.pacienteParaRepetir.consultorio
        );
      }
    });
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.cambiosSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
    this.repeatSubscription?.unsubscribe();
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
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','))

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

  cargarAPSEspera() {
    for (let i = 0; i < this.seccionesAPSEspera.length; i++) {
      const seccion = this.seccionesAPSEspera[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','))

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.apsEsperaData[i] = data;
          if (this.apsEsperaLoading[i]) this.apsEsperaLoading[i] = false;
        },
        error: () => {
          if (!this.apsEsperaData[i]) {
            this.apsEsperaData[i] = [];
            this.apsEsperaLoading[i] = false;
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

  cargarLabEspera() {
    for (let i = 0; i < this.labEsperaSections.length; i++) {
      const seccion = this.labEsperaSections[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.labEsperaData[i] = data;
          if (this.labEsperaLoading[i]) this.labEsperaLoading[i] = false;
        },
        error: () => {
          if (!this.labEsperaData[i]) {
            this.labEsperaData[i] = [];
            this.labEsperaLoading[i] = false;
          }
        },
      });
    }
  }

  cargarImgEspera() {
    for (let i = 0; i < this.imgEsperaSections.length; i++) {
      const seccion = this.imgEsperaSections[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.imgEsperaData[i] = data;
          if (this.imgEsperaLoading[i]) this.imgEsperaLoading[i] = false;
        },
        error: () => {
          if (!this.imgEsperaData[i]) {
            this.imgEsperaData[i] = [];
            this.imgEsperaLoading[i] = false;
          }
        },
      });
    }
  }

  cargarConsulta() {
    for (let i = 0; i < this.consultaSections.length; i++) {
      const seccion = this.consultaSections[i];
      const params = new URLSearchParams();
      if (seccion.filtro.estados?.length) params.set('estados', seccion.filtro.estados.join(','));
      if (seccion.filtro.servicios?.length) params.set('servicios', seccion.filtro.servicios.join(','));
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));

      this.api.get<TurnoDTO[]>(`turnero/pacientes?${params.toString()}`).subscribe({
        next: (data) => {
          this.consultaData[i] = data;
          if (this.consultaLoading[i]) this.consultaLoading[i] = false;
        },
        error: () => {
          if (!this.consultaData[i]) {
            this.consultaData[i] = [];
            this.consultaLoading[i] = false;
          }
        },
      });
    }
  }

  private readonly MAX_VISIBLE = 4;
  private readonly CARD_H = 86;
  private readonly GAP = 12;

  get viewportH(): number {
    return this.MAX_VISIBLE * this.CARD_H + (this.MAX_VISIBLE - 1) * this.GAP;
  }

  private vozFemenina: SpeechSynthesisVoice | null = null;

  private cargarVozFemenina() {
    if (!('speechSynthesis' in window)) return;
    const buscarVoz = () => {
      const voces = window.speechSynthesis.getVoices();
      
      // Prioridad 1: Microsoft Sabina (es-MX)
      // Prioridad 2: Cualquier otra voz de Español México (es-MX) + Femenino
      // Prioridad 3: Español México (es-MX)
      this.vozFemenina = voces.find(v => v.name.includes('Microsoft Sabina'))
                         || voces.find(v => v.lang.startsWith('es-MX') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('femenina') || v.name.toLowerCase().includes('mujer')))
                         || voces.find(v => v.lang.startsWith('es-MX'))
                         || voces.find(v => v.lang.startsWith('es') && (v.name.toLowerCase().includes('female') || v.name.toLowerCase().includes('femenina') || v.name.toLowerCase().includes('mujer')))
                         || voces.find(v => v.lang.startsWith('es'))
                         || null;
    };
    buscarVoz();
    if (!this.vozFemenina) {
      window.speechSynthesis.onvoiceschanged = () => buscarVoz();
    }
  }

  private detenerRepeticion() {
    console.log('Turnero: Deteniendo repetición y audio...');
    this.repeatSubscription?.unsubscribe();
    this.repeatSubscription = null;
    this.pacienteParaRepetir = null;
    
    // Acción más agresiva para detener el audio
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      // En algunos navegadores es necesario pausar y luego cancelar para limpiar la cola
      window.speechSynthesis.pause();
      window.speechSynthesis.resume();
      window.speechSynthesis.cancel();
    }
  }

  private reproducirAudio(nombre: string, apellido: string, consultorio: string, estado?: string) {
    // Depuración
    console.log(`Turnero: Intentando reproducir audio para ${nombre}, estado: ${estado}`);
    
    // Solo reproducir si el estado es explícitamente 'LLAMADO'
    if (estado && estado.toUpperCase() !== 'LLAMADO') {
      console.log('Turnero: Audio bloqueado por estado no válido.');
      return;
    }

    if (!('speechSynthesis' in window)) return;
    
    // Limpieza previa antes de nueva reproducción
    window.speechSynthesis.cancel();
    
    const nombreCompleto = `${nombre} ${apellido}`.trim();
    let texto: string;
    const c = consultorio.toLowerCase();
    if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a imágenes`;
    } else {
      const cFormateado = consultorio.replace(/\b0+(\d+)\b/g, '$1');
      texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${cFormateado}`;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    utterance.lang = 'es-MX';
    utterance.rate = 0.9;
    if (!this.vozFemenina) this.cargarVozFemenina();
    if (this.vozFemenina) utterance.voice = this.vozFemenina;
    window.speechSynthesis.speak(utterance);
  }

}
