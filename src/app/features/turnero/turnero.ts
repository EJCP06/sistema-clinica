import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, ClipboardList, ArrowLeft, LucideIconData } from 'lucide-angular';
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
  readonly ArrowLeft = ArrowLeft;

  turnos: TurnoDTO[] = [];
  fechaActual: Date = new Date();
  horaFormateada: string = '';
  sede: number | null = null;

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
        estados: [1, 2, 8],
        servicios: [2, 3],
        responsable: [1, 2],
      }
    },
    {
      id: 2,
      titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [1, 2, 8],
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
      titulo: 'LABORATORIO (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [1, 2, 8],
        servicios: [2],
        responsable: [1, 2],
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
      titulo: 'IMÁGENES (PARTICULARES Y ASEGURADORAS)',
      filtro: {
        estados: [1, 2, 8],
        servicios: [3],
        responsable: [1, 2],
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
  
  private repeatTimerId: any = null;
  private ultimoIdAtencion: number | null = null;
  private pacienteParaRepetir: { paciente: string; apellido: string; consultorio: string } | null = null;

  constructor(
    readonly api: ApiService,
    readonly route: ActivatedRoute,
    readonly router: Router,
  ) {}

  ngOnInit() {
    const validarSede = (sedeUrl: string | undefined): boolean => {
      const sedeEsperada = sessionStorage.getItem('turnero_sede');
      if (!sedeEsperada || sedeUrl !== sedeEsperada) {
        this.router.navigate(['/turnero'], { replaceUrl: true });
        return false;
      }
      return true;
    };

    if (!validarSede(this.route.snapshot.params['sede'])) return;

    this.route.params.subscribe(params => {
      if (!validarSede(params['sede'])) return;
      this.sede = params['sede'] ? Number(params['sede']) : null;
    });

    // Cargar voces al inicio
    const cargarVoces = () => {
      if (window.speechSynthesis.getVoices().length > 0) {
        this.cargarVozFemenina();
      } else {
        window.speechSynthesis.onvoiceschanged = () => this.cargarVozFemenina();
      }
    };
    cargarVoces();

    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'aps';
      this.config = SALAS[this.sala];
      this.cargarDatosSala();
    });

    this.cambiosSub = this.api.cambios$.subscribe((data: any) => {
      if (data.id_sede && this.sede && data.id_sede !== this.sede) {
        this.cargarDatosSala();
        return;
      }
      
      const esLlamado = data.tipo === 'llamado' && data.paciente && data.consultorio;
      const esMismoPaciente = data.id_atencion && data.id_atencion === this.ultimoIdAtencion;
      const esLiberacion = data.tipo === 'liberacion' || (data.tipo === 'estado-actualizado' && data.estado && data.estado.toUpperCase() !== 'LLAMADO');

      if (esLiberacion) {
        this.detenerRepeticion();
      }

      if (esLlamado && !esMismoPaciente) {
        this.pacienteParaRepetir = { paciente: data.paciente, apellido: data.apellido || '', consultorio: data.consultorio };
        this.ultimoIdAtencion = data.id_atencion;
        
        this.reproducirAudio(data.paciente, data.apellido || '', data.consultorio);
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
    this.detenerRepeticionTimer();
    this.repeatTimerId = setInterval(() => {
      if (this.pacienteParaRepetir) {
        this.reproducirAudio(
          this.pacienteParaRepetir.paciente,
          this.pacienteParaRepetir.apellido,
          this.pacienteParaRepetir.consultorio
        );
      } else {
        this.detenerRepeticionTimer();
      }
    }, 20000); // 20 segundos
  }

  private detenerRepeticionTimer() {
    if (this.repeatTimerId) {
      clearInterval(this.repeatTimerId);
      this.repeatTimerId = null;
    }
  }

  private detenerRepeticion() {
    this.detenerRepeticionTimer();
    this.pacienteParaRepetir = null;
    this.ultimoIdAtencion = null;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  ngOnDestroy() {
    this.queryParamsSub?.unsubscribe();
    this.cambiosSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
    this.detenerRepeticionTimer();
  }

  cambiarSala(sala: SalaMode) {
    this.router.navigate([], { queryParams: { sala }, replaceUrl: true });
  }

  volverASedes() {
    sessionStorage.removeItem('turnero_sede');
    this.router.navigate(['/turnero'], { replaceUrl: true });
  }

  private addSede(params: URLSearchParams) {
    if (this.sede) params.set('sede', String(this.sede));
  }

  cargarTurnos() {
    const params = new URLSearchParams();
    if (this.config.estados.length > 0) params.set('estados', this.config.estados.join(','));
    if (this.config.servicios) params.set('servicios', this.config.servicios.join(','));
    this.addSede(params);

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
      this.addSede(params);

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
      if (seccion.filtro.responsable?.length) params.set('responsable', seccion.filtro.responsable.join(','));
      this.addSede(params);

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
      this.addSede(params);

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
      this.addSede(params);

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
      this.addSede(params);

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
      this.addSede(params);

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
      this.addSede(params);

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
      if (voces.length === 0) return;

      const femaleKeywords = [
        'female', 'femenina', 'mujer', 'girl', 'sabina', 'paulina', 'helena', 
        'monica', 'mónica', 'siri', 'luz', 'marisol', 'rosa', 'alicia', 'elena', 
        'carmen', 'valeria', 'sofia', 'sofía', 'maria', 'maría', 'lucia', 'lucía', 
        'irene', 'cristina', 'sara', 'laura', 'patricia', 'silvia', 'yolanda', 
        'gloria', 'marta', 'ana', 'rebeca', 'victoria', 'julia', 'claudia'
      ];

      // 1. Buscar voz femenina en Español México (es-MX)
      let voz = voces.find(v => {
        const langLower = v.lang.toLowerCase();
        const isMX = langLower === 'es-mx' || langLower === 'es_mx';
        if (!isMX) return false;
        const nameLower = v.name.toLowerCase();
        return femaleKeywords.some(keyword => nameLower.includes(keyword));
      });

      // 2. Si no hay femenina en es-MX, buscar cualquier voz en es-MX
      if (!voz) {
        voz = voces.find(v => {
          const langLower = v.lang.toLowerCase();
          return langLower === 'es-mx' || langLower === 'es_mx';
        });
      }

      // 3. Si no hay es-MX, buscar cualquier voz femenina en Español (es)
      if (!voz) {
        voz = voces.find(v => {
          const langLower = v.lang.toLowerCase();
          const isEs = langLower.startsWith('es');
          if (!isEs) return false;
          const nameLower = v.name.toLowerCase();
          return femaleKeywords.some(keyword => nameLower.includes(keyword));
        });
      }

      // 4. Si no hay femenina en es, buscar cualquier voz en Español (es)
      if (!voz) {
        voz = voces.find(v => v.lang.toLowerCase().startsWith('es'));
      }

      // 5. Fallback a cualquier voz si no hay español
      if (!voz) {
        voz = voces[0] || null;
      }

      this.vozFemenina = voz;
    };
    buscarVoz();
    if (!this.vozFemenina) {
      window.speechSynthesis.onvoiceschanged = () => buscarVoz();
    }
  }

  private reproducirAudio(nombre: string, apellido: string, consultorio: string) {
    if (!('speechSynthesis' in window)) {
      console.error('SpeechSynthesis no soportado.');
      return;
    }
    
    // Forzamos la recarga si no hay voz cargada o si la que hay no es del español de México
    const esVozMX = this.vozFemenina && (this.vozFemenina.lang.toLowerCase() === 'es-mx' || this.vozFemenina.lang.toLowerCase() === 'es_mx');
    if (!this.vozFemenina || !esVozMX) {
      this.cargarVozFemenina();
    }
    
    const nombreCompleto = `${nombre} ${apellido}`.trim();

    // Eliminar ceros iniciales de los números en el nombre del consultorio
    // Ej: "Consultorio 05" → "Consultorio 5", "C-05" → "C-5"
    const consultorioLimpio = consultorio.replace(/\b0+(\d+)\b/g, '$1');

    let texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${consultorioLimpio}`;
    
    // Mantenemos la lógica de laboratorio/imágenes
    const c = consultorio.toLowerCase();
    if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a imágenes`;
    }

    const esMovil = this.detectarMovil();
    const textoFinal = esMovil ? texto.toLowerCase() : texto.toUpperCase();

    // Cancelar cualquier anuncio previo antes de hablar
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(textoFinal);
    if (this.vozFemenina) {
        utterance.voice = this.vozFemenina;
        utterance.lang = this.vozFemenina.lang;
    } else {
        utterance.lang = 'es-MX';
    }
    utterance.rate = 0.9;
    
    // Agregamos setTimeout para evitar que el cancel() asíncrono aborte este speak()
    setTimeout(() => {
      window.speechSynthesis.speak(utterance);
    }, 100);
  }

  private detectarMovil(): boolean {
    const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    return isMobileUA || isTouch;
  }

}
