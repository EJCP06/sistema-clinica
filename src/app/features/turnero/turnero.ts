import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Stethoscope, FlaskConical, ScanLine, ClipboardList, ArrowLeft, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ApsScrollDirective } from './aps-scroll.directive';
import { desbloquearVozNavegador } from './voz.util';
import { TurneroDataService } from './turnero-data.service';
import {
  calcularDestinoVisual,
  consultorioConPiso as consultorioConPisoDeTurno,
  esAnuncioAPS,
} from './turnero-formato.util';
import { TurneroVozService, AnuncioActivo } from './turnero-voz.service';
import { TurneroMonitorService } from './turnero-monitor.service';
import { initTarjetasResponsive } from './turnero-responsive.helper';

type SalaMode = 'aps' | 'lab' | 'img' | 'consulta';

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
  lab: {
    titulo: 'LABORATORIO',
    subtitulo: 'Pacientes de laboratorio',
    estados: [],
    servicios: null,
    icon: FlaskConical,
    layout: 'lab',
  },
  img: {
    titulo: 'IMÁGENES',
    subtitulo: 'Pacientes de imágenes',
    estados: [],
    servicios: null,
    icon: ScanLine,
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
    { key: 'lab', label: 'Laboratorio', icon: FlaskConical },
    { key: 'img', label: 'Imágenes', icon: ScanLine },
    { key: 'consulta', label: 'Consulta', icon: Stethoscope },
  ];

  readonly seccionesAPS: APSSeccion[] = [
    {
      id: 1,
      titulo: 'LABORATORIO / IMÁGENES (PARTICULARES Y ASEGURADORAS)',
      filtro: { estados: [1, 2, 3, 4, 5, 7, 8], servicios: [2, 3], responsable: [1, 2] }
    },
    {
      id: 2,
      titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)',
      filtro: { estados: [1, 2, 3, 4, 5, 7, 8], servicios: [1], responsable: [1, 2] }
    },
  ];

  apsData: TurnoDTO[][] = [];
  apsLoading: boolean[] = [];

  readonly labSections: APSSeccion[] = [
    { id: 1, titulo: 'LABORATORIO (PARTICULARES Y ASEGURADORAS)', filtro: { estados: [1, 2, 3, 4, 5, 7, 8], servicios: [2], responsable: [1, 2] } },
  ];
  labData: TurnoDTO[][] = [];
  labLoading: boolean[] = [];

  readonly imgSections: APSSeccion[] = [
    { id: 1, titulo: 'IMÁGENES (PARTICULARES Y ASEGURADORAS)', filtro: { estados: [1, 2, 3, 4, 5, 7, 8], servicios: [3], responsable: [1, 2] } },
  ];
  imgData: TurnoDTO[][] = [];
  imgLoading: boolean[] = [];

  readonly consultaSections: APSSeccion[] = [
    { id: 1, titulo: 'CONSULTA (PARTICULARES Y ASEGURADORAS)', filtro: { estados: [3, 4, 5, 7], servicios: [1], responsable: [1, 2] } },
  ];
  consultaData: TurnoDTO[][] = [];
  consultaLoading: boolean[] = [];

  trackById = (index: number, item: TurnoDTO) => item?.id_atencion ?? item?.id ?? index;

  consultorioConPiso(t: TurnoDTO): string {
    return consultorioConPisoDeTurno(t);
  }

  private queryParamsSub: Subscription | null = null;
  private cambiosSub: Subscription | null = null;
  // Modal de llamado visual
  showModalLlamado = false;
  modalLlamadoClosing = false;
  modalLlamadoCambiando = false;
  modalLlamadoPaciente = '';
  modalLlamadoApellido = '';
  modalLlamadoDestino = '';
  modalLlamadoTurno = '';
  modalLlamadoEtiqueta = 'Diríjase al consultorio';

  // Responsive
  maxVisibleTarjetas: number = 4;
  private destroyResponsive: (() => void) | null = null;

  // TV / Splash
  tvMode: boolean = false;
  showSplash: boolean = false;
  private originalViewport: string | null = null;

  constructor(
    readonly api: ApiService,
    readonly route: ActivatedRoute,
    readonly router: Router,
    readonly cdr: ChangeDetectorRef,
    private dataService: TurneroDataService,
    private voz: TurneroVozService,
    private monitor: TurneroMonitorService,
  ) {}

  ngOnInit() {
    this.voz.setUICallbacks({
      isSplashVisible: () => this.showSplash,
      mostrarModalLlamado: (a) => this.mostrarModalLlamado(a),
      cerrarModalLlamado: () => this.cerrarModalLlamado(),
    });

    desbloquearVozNavegador();
    this.destroyResponsive = initTarjetasResponsive(movil => {
      this.maxVisibleTarjetas = movil ? 2 : 4;
    });

    if (typeof window !== 'undefined') {
      const esCapacitor = !!(window as any).Capacitor && !!(window as any).Capacitor.isNativePlatform?.();
      if (!esCapacitor) {
        const sw = window.screen.width || 0;
        const sh = window.screen.height || 0;
        const realWidth = Math.max(sw, sh);
        const ua = navigator.userAgent || '';
        const isAndroidTV = /Android TV|SmartTV|GoogleTV|Apple TV|Android.*TV|Monitor|MiTV/i.test(ua);
        const isLargeScreen = isAndroidTV && realWidth >= 500;
        const isNarrowViewport = window.innerWidth < 768;
        this.tvMode = isLargeScreen && isNarrowViewport;
        if (this.tvMode) {
          const meta = document.querySelector('meta[name="viewport"]');
          if (meta) {
            this.originalViewport = meta.getAttribute('content');
            meta.setAttribute('content', 'width=1366');
          }
          document.documentElement.classList.add('tv-mode');
        }
      }
      this.showSplash = true;
    }

    try {
      (window as any).__turnero_instancias = ((window as any).__turnero_instancias || 0) + 1;
    } catch { /* ignore */ }

    const validarSede = (sedeUrl: string | undefined): boolean => {
      const esSedeValida = sedeUrl === '1' || sedeUrl === '2';
      if (!esSedeValida) {
        this.router.navigate(['/turnero'], { replaceUrl: true });
        return false;
      }
      try {
        if (sessionStorage.getItem('turnero_sede') !== sedeUrl) {
          sessionStorage.setItem('turnero_sede', sedeUrl);
        }
      } catch { /* ignore */ }
      return true;
    };

    const sedeInicial = this.route.snapshot.params['sede'] || sessionStorage.getItem('turnero_sede') || undefined;
    const sedeVieneDeParams = !!this.route.snapshot.params['sede'];
    if (!validarSede(sedeInicial)) return;

    if (!sedeVieneDeParams) {
      this.sede = Number(sedeInicial);
    }

    this.route.params.subscribe(params => {
      const sedeParam = params['sede'] || sessionStorage.getItem('turnero_sede');
      if (!validarSede(sedeParam)) return;
      this.sede = sedeParam ? Number(sedeParam) : null;
      this.monitor.setSede(this.sede);
    });

    this.voz.registrarListenersVoz();
    this.voz.registrarDesbloqueoAudio();

    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'aps';
      this.config = SALAS[this.sala];
      this.cargarDatosSala();
    });

    this.cambiosSub = this.api.cambios$.subscribe((data: any) => {
      if (data.id_sede && this.sede && Number(data.id_sede) !== Number(this.sede)) return;

      const esLiberacion = data.id_atencion && (data.tipo === 'liberacion' || data.tipo === 'retirado' || data.tipo === 'eliminado' ||
        (data.tipo === 'estado-cambiado' && data.id_estado_nuevo !== undefined && Number(data.id_estado_nuevo) !== 4));

      if (esLiberacion) {
        this.voz.detenerRepeticion(data.id_atencion);
      }

      // Anuncio general por megáfono (p. ej. recordatorio de silencio
      // disparado desde APS): se locuta una sola vez por voz.
      if (data.tipo === 'anuncio-general') {
        this.voz.reproducirAnuncioGeneral(data);
        return;
      }

      const esLlamado = data.tipo === 'llamado' && data.paciente && data.consultorio;
      if (esLlamado) {
        this.voz.procesarLlamado(data);
      }

      this.cargarDatosSala();
    });

    // Monitoreo: polling, refresco de datos y reloj (gestionados por el servicio)
    this.monitor.horaActual$.subscribe(fecha => {
      this.fechaActual = fecha;
      this.horaFormateada = fecha.toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
      });
    });
    this.monitor.cargarSala$.subscribe(() => this.cargarDatosSala());
    this.monitor.setSede(this.sede);
    this.monitor.iniciar();
  }

  ngOnDestroy() {
    this.destroyResponsive?.();
    this.queryParamsSub?.unsubscribe();
    this.cambiosSub?.unsubscribe();

    this.monitor.detener();

    const esRecargaPagina =
      typeof performance !== 'undefined' &&
      performance.getEntriesByType('navigation')?.length > 0 &&
      (performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';
    this.voz.detenerRepeticion(undefined, esRecargaPagina);
    this.voz.quitarListenersDesbloqueo();
    this.voz.quitarListenersVoz();

    if (this.tvMode && this.originalViewport) {
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) meta.setAttribute('content', this.originalViewport);
    }
    document.documentElement.classList.remove('tv-mode');
    this.cerrarModalLlamado();
  }

  private cargarDatosSala() {
    if (this.sala === 'aps') this.cargarAPS();
    else if (this.sala === 'lab') this.cargarLab();
    else if (this.sala === 'img') this.cargarImg();
    else if (this.sala === 'consulta') this.cargarConsulta();
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

  cargarAPS() { this.dataService.cargarSeccion(this.seccionesAPS, this.sede, { data: this.apsData, loading: this.apsLoading }); }
  cargarLab() { this.dataService.cargarSeccion(this.labSections, this.sede, { data: this.labData, loading: this.labLoading }); }
  cargarImg() { this.dataService.cargarSeccion(this.imgSections, this.sede, { data: this.imgData, loading: this.imgLoading }); }
  cargarConsulta() { this.dataService.cargarSeccion(this.consultaSections, this.sede, { data: this.consultaData, loading: this.consultaLoading }); }

  cambiarSala(sala: SalaMode) {
    this.router.navigate([], { queryParams: { sala }, replaceUrl: true });
  }

  volverASedes() {
    sessionStorage.removeItem('turnero_sede');
    this.router.navigate(['/turnero'], { replaceUrl: true });
  }

  iniciarTurnero() {
    this.showSplash = false;
    this.voz.desbloquearAudio();
    const pendientes = Array.from(this.voz.anunciosActivos.values())
      .filter(a => a.idAtencion !== this.voz.ultimoIdAnunciado)
      .sort((a, b) => (b.inicioMs || 0) - (a.inicioMs || 0));
    if (pendientes.length > 0) {
      this.voz.reproducirAudio(pendientes[0]);
    }
  }

  mostrarModalLlamado(a: AnuncioActivo): void {
    const destino = calcularDestinoVisual(a.consultorio, a.piso);
    const consultorioLower = (a.consultorio || '').toLowerCase();
    const esModuloRecepcion = a.destinoInmediato ||
      consultorioLower.includes('laboratorio') ||
      consultorioLower.includes('imagenes') ||
      consultorioLower.includes('imágenes') ||
      consultorioLower.includes('imagen') ||
      esAnuncioAPS(a.consultorio);
    this.modalLlamadoEtiqueta = esModuloRecepcion ? 'Diríjase a la' : 'Diríjase al consultorio';
    this.modalLlamadoPaciente = a.paciente;
    this.modalLlamadoApellido = a.apellido;
    this.modalLlamadoDestino = destino;
    this.modalLlamadoTurno = a.numeroTurno || '';
    if (!this.showModalLlamado) {
      this.showModalLlamado = true;
      this.modalLlamadoClosing = false;
    }
    this.modalLlamadoCambiando = false;
    this.cdr.detectChanges();
  }

  cerrarModalLlamado(): void {
    if (!this.showModalLlamado || this.modalLlamadoClosing) return;
    this.modalLlamadoClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showModalLlamado = false;
      this.modalLlamadoClosing = false;
      this.cdr.detectChanges();
    }, 350);
  }

  private addSede(params: URLSearchParams) {
    if (this.sede) params.set('sede', String(this.sede));
  }


}

