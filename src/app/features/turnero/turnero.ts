import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, ClipboardList, ArrowLeft, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApsScrollDirective } from './aps-scroll.directive';
import { desbloquearVozNavegador, instalarGuardiaGlobalAntiDoble, limpiarGuardiaGlobalAntiDoble } from './voz.util';

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

interface AnuncioActivo {
  idAtencion: number;
  numeroTurno: string | null;
  paciente: string;
  apellido: string;
  consultorio: string;
  /** Llamado de módulo (APS / Laboratorio / Imágenes): anuncio único e inmediato. */
  destinoInmediato: boolean;
  /** Llamado del médico ("Llamar al Siguiente"): el primer anuncio sale ya y el ciclo de 10s continúa. */
  primerTickInmediato: boolean;
  inicioMs: number | null;
  timerId: any | null;
  speakTimerId: any | null;
  ultimaVozMs: number;
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

/**
 * GUARDIA GLOBAL ANTI-DOBLE.
 * Compartida por TODAS las instancias del turnero y por todas las vías de
 * anuncio (socket, polling periódico, click de desbloqueo, reanudación tras
 * recarga). El MISMO texto (mismo paciente + consultorio) no puede
 * reproducirse dos veces: se bloquea si el anuncio anterior aún se está
 * reproduciendo o si ya sonó hace menos de 9s. La repetición legítima ocurre
 * a los 10s exactos, así que siempre se permite; cualquier duplicado queda
 * físicamente bloqueado. Un texto DISTINTO (otro paciente o consultorio, p. ej.
 * dos doctores con la misma especialidad en consultorios diferentes) nunca se
 * bloquea. Se reinicia en detenerRepeticion(): tras Iniciar/Ausente/Retirar,
 * un nuevo llamado del mismo paciente sí debe sonar de inmediato.
 */
let ultimoAnuncioGlobal: { texto: string; ts: number; sonado: boolean } | null = null;
const VENTANA_ANTIDOBLE_MS = 9000;
/**
 * Ventana del llamado (desde `inicio_ms`): coincide con el contador del
 * médico (120s desde la hora del llamado). Pasada esta ventana (~115s desde
 * `inicio_ms`), la repetición se DETIENE sola: la voz suena cada 10s mientras
 * el paciente siga llamado y el corte final lo hace el auto-ausente del
 * médico. Si ese evento se pierde por el socket, este tope evita que la voz
 * siga sonando en bucle.
 */
const VENTANA_LLAMADO_MS = 115000;

@Component({
  selector: 'app-turnero',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, ApsScrollDirective],
  templateUrl: './turnero.html'
})
/**
 * Componente del tablero turnero (pantalla pública).
 * Muestra pacientes agrupados por sala (APS, laboratorio, imágenes, consulta),
 * reproduce anuncios de voz al llamar pacientes y refresca automáticamente.
 */
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

  // Anuncios activos por id_atencion: cada llamado tiene su PROPIO ciclo de
  // repetición (grilla de 10s anclada a su `inicio_ms`). Dos doctores llamando
  // casi a la vez → dos anuncios simultáneos que suenan uno tras otro sin
  // pisarse (la voz nunca interrumpe: espera a que el motor quede libre).
  private anunciosActivos = new Map<number, AnuncioActivo>();
  private colaVoz: AnuncioActivo[] = [];

  /**
   * Calcula el retardo hasta la siguiente marca de 10s de la grilla del llamado.
   * Devuelve null si el llamado ya pasó la ventana de 115s (VENTANA_LLAMADO_MS).
   */
  private retardoHastaSiguienteMarca(a: AnuncioActivo, minMs: number): number | null {
    if (!a.inicioMs || !Number.isFinite(a.inicioMs)) {
      return Math.max(minMs, 10000);
    }
    const baseLocal = a.inicioMs - this.deltaRelojMs;
    const ahora = Date.now();
    const desfase = ahora - baseLocal;
    if (desfase >= VENTANA_LLAMADO_MS) return null;
    const periodos = Math.max(1, Math.floor(desfase / 10000) + 1);
    const siguienteBorde = baseLocal + periodos * 10000;
    if (siguienteBorde - baseLocal >= VENTANA_LLAMADO_MS) return null;
    return Math.max(minMs, siguienteBorde - ahora);
  }

  /**
   * Retardo hasta el instante objetivo del anuncio (`inicio_ms` en hora
   * local). Se usa para los llamados que deben sonar de INMEDIATO: los
   * botones de módulo (APS/Lab/Imágenes) y el primer tick del médico
   * ("Llamar al Siguiente") emiten `inicio_ms` en el mismo instante del
   * clic, así que cuando el evento llega el objetivo ya está en el pasado y
   * el retardo queda en `minMs` (la voz sale YA), en vez de esperar la
   * siguiente marca de 10s de la grilla de consultorios. Devuelve null si
   * el llamado ya pasó la ventana de 115s.
   */
  private retardoHastaInicioAnuncio(a: AnuncioActivo, minMs: number): number | null {
    if (!a.inicioMs || !Number.isFinite(a.inicioMs)) {
      return Math.max(minMs, 500);
    }
    const baseLocal = a.inicioMs - this.deltaRelojMs;
    const ahora = Date.now();
    const desfase = ahora - baseLocal;
    if (desfase >= VENTANA_LLAMADO_MS) return null;
    return Math.max(minMs, baseLocal - ahora);
  }

  /**
   * Inicia/reinicia el ciclo de repetición de 10s para un anuncio específico.
   * Usa setTimeout recursivo (NO setInterval) para auto-corregir deriva.
   */
  private iniciarRepeticionAnuncio(a: AnuncioActivo): void {
    if (a.timerId) {
      clearTimeout(a.timerId);
      a.timerId = null;
    }
    const hablar = (): boolean => {
      if (!this.anunciosActivos.has(a.idAtencion)) {
        return false; // Fue detenido/retirado
      }
      const anunciado = this.reproducirAudio(a);
      return anunciado;
    };
    // Llamados de módulo (APS / Laboratorio / Imágenes): anuncio único e
    // inmediato. El backend manda `inicio_ms` en el pasado inmediato del
    // clic, así que con minMs 0 la voz sale YA, sin esperar la siguiente
    // marca de 10s de la grilla de consultorios.
    const esDestino = a.destinoInmediato || this.esAnuncioAPS(a.consultorio);
    // Llamados del médico ("Llamar al Siguiente"): el backend manda
    // `inicio_inmediato` para que el PRIMER anuncio salga ya, y las
    // siguientes repeticiones siguen ancladas a la grilla de 10s.
    let delay: number | null;
    if (esDestino) {
      delay = this.retardoHastaInicioAnuncio(a, 0);
    } else if (a.primerTickInmediato) {
      delay = this.retardoHastaInicioAnuncio(a, 300);
      a.primerTickInmediato = false;
    } else {
      delay = this.retardoHastaSiguienteMarca(a, 500);
    }
    if (delay === null) {
      this.anunciosActivos.delete(a.idAtencion);
      return;
    }
    a.timerId = setTimeout(() => {
      let continuar = true;
      try {
        continuar = hablar();
        if (continuar) {
          console.log('[Turnero v7] Anuncio repetido (ciclo de 10s) para', a.idAtencion);
        }
      } catch (e) {
        console.error('[Turnero v7] Error en anuncio repetido:', e);
      }
      // Llamados de módulo: anuncio único. Como el paciente no cambia de
      // estado al llamarlo, el ciclo de repetición de 10s sonaría en bucle,
      // así que no se re-agenda.
      if (continuar && !esDestino) {
        this.iniciarRepeticionAnuncio(a);
      } else {
        this.anunciosActivos.delete(a.idAtencion);
      }
    }, delay);
  }

  /**
   * Procesa un llamado (socket o polling): crea el anuncio si no existe y arranca su ciclo.
   */
  private procesarLlamado(data: any): void {
    const id = data.id_atencion;
    if (!id) {
      return;
    }
    // Re-llamado explícito (botón "Llamar" de APS pulsado de nuevo): la voz
    // debe repetirse AL INSTANTE en CADA pulsación. El APS es de anuncio
    // único, así que al terminar la primera locución el id ya no está en el
    // mapa: por eso `forzar` se evalúa ANTES de la guardia de "ya procesado".
    if (data.forzar) {
      this.reanunciarInmediato(data);
      return;
    }
    if (this.anunciosActivos.has(id)) {
      return; // Ya procesado
    }
    this.crearAnuncio(data);
  }

  /**
   * Crea el anuncio de un llamado nuevo y arranca su ciclo de voz.
   * Extraído para reusarse desde el re-llamado forzado (APS), donde primero
   * se limpian las guardias anti-doble y luego se recrea el anuncio.
   */
  private crearAnuncio(data: any): void {
    const id = data.id_atencion;
    this.actualizarDeltaReloj(data.server_now);
    if (data.inicio_ms) {
      this.inicioMsActual = data.inicio_ms;
    }
    const anuncio: AnuncioActivo = {
      idAtencion: id,
      numeroTurno: data.turno || null,
      paciente: this.aNombreNatural(data.paciente || ''),
      apellido: this.aNombreNatural(data.apellido || ''),
      consultorio: data.consultorio,
      // Los llamados de módulo (botones "Llamar" de APS/Lab/Imágenes) llevan
      // `forzar: true`: suenan al instante, son de disparo único y se
      // repiten en cada pulsación. La grilla de consultorios no lo lleva.
      destinoInmediato: data.forzar === true,
      // El médico ("Llamar al Siguiente") manda `inicio_inmediato: true`:
      // el primer anuncio sale ya y el ciclo de 10s de la grilla continúa.
      primerTickInmediato: data.inicio_inmediato === true,
      inicioMs: data.inicio_ms ?? this.inicioMsActual,
      timerId: null,
      speakTimerId: null,
      ultimaVozMs: 0,
    };
    this.anunciosActivos.set(id, anuncio);
    this.iniciarRepeticionAnuncio(anuncio);
    // Memoria anti-voz-doble para polling
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();
  }

  /**
   * ¿Este llamado es de APS? El backend emite `consultorio: 'APS'` para los
   * botones "Llamar" de APS. Los anuncios APS son de disparo único e
   * inmediato (sin grilla de 10s ni espera de marca).
   */
  private esAnuncioAPS(consultorio: string): boolean {
    return consultorio.trim().toLowerCase() === 'aps';
  }

  /**
   * Re-llamado explícito (botón "Llamar" de APS pulsado de nuevo): limpia las
   * guardias anti-doble del mismo texto, corta la locución en curso si la hay
   * y reprocesa el llamado como nuevo. Como `inicio_ms` ya está en el pasado,
   * `reproducirAudio` habla de inmediato (retardo 0).
   */
  private reanunciarInmediato(data: any): void {
    const id = data.id_atencion;
    // Limpia timers, cola y guardias anti-doble (global y de ventana)
    this.detenerRepeticion(id);
    // Resetea la memoria local anti-doble para que el MISMO texto suene YA
    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    // Evita que el polling re-anuncie este mismo llamado
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();
    // Si otra locución está sonando, se corta para que la voz salga al instante
    const hablando = 'speechSynthesis' in window && window.speechSynthesis.speaking;
    if (hablando) {
      window.speechSynthesis.cancel();
      // Chrome ignora speak() inmediatamente después de cancel(): se espera
      // ~120ms para que el motor quede libre antes de recrear el anuncio.
      setTimeout(() => this.crearAnuncio(data), 120);
    } else {
      this.crearAnuncio(data);
    }
  }

  /**
   * Reproduce el audio de un anuncio. Devuelve true si se programó/sonó.
   * Respeta la guardia global anti-doble y serializa las voces (cola si hay otra sonando).
   */
  private reproducirAudio(a: AnuncioActivo): boolean {
    if (!('speechSynthesis' in window)) {
      console.error('SpeechSynthesis no soportado.');
      return false;
    }
    const nombreCompleto = `${a.paciente} ${a.apellido}`.trim();
    const consultorioLimpio = a.consultorio.replace(/\b0+(\d+)\b/g, '$1');
    let texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${consultorioLimpio}`;
    const c = a.consultorio.toLowerCase();
    if (a.destinoInmediato) {
      // Botones "Llamar" de módulos (APS / clave / laboratorio / imágenes):
      // anuncio único genérico, sin variantes por servicio.
      texto = `Paciente ${nombreCompleto}, por favor acérquese a la recepción`;
    } else if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a imágenes`;
    } else if (c.includes('consulta')) {
      texto = `Paciente ${nombreCompleto}, diríjase a consulta`;
    } else if (c.startsWith('consultorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase al ${consultorioLimpio}`;
    } else if (this.esAnuncioAPS(a.consultorio)) {
      texto = `Paciente ${nombreCompleto}, por favor acérquese a la recepción`;
    }
    const ahora = Date.now();
    // Deduplicación local por instancia (complemento a la guardia global):
    // SOLO bloquea si es el MISMO llamado (mismo ancla `inicio_ms`) que sonó
    // hace <9s. Un llamado NUEVO del mismo paciente (p. ej. el médico llama a
    // alguien que minutos antes fue anunciado por el botón de APS) NO se
    // bloquea: la voz debe salir ya.
    const esMismoLlamadoLocal = a.inicioMs && Number.isFinite(a.inicioMs) &&
      this.ultimoAnuncioInicioMs !== null && Number.isFinite(this.ultimoAnuncioInicioMs) &&
      Math.abs(a.inicioMs - this.ultimoAnuncioInicioMs) < 2000;
    if (this.sonidoConfirmado && a.idAtencion === this.ultimoIdAnunciado && esMismoLlamadoLocal && ahora - this.ultimaVezAnunciado < 9000) {
      return false;
    }
    this.ultimoIdAnunciado = a.idAtencion;
    this.ultimaVezAnunciado = ahora;
    if (a.inicioMs && Number.isFinite(a.inicioMs)) {
      this.ultimoAnuncioInicioMs = a.inicioMs;
    }
    this.persistirAnuncioEnSesion(a);
    // Guardia global anti-doble
    const hablandoAhora = 'speechSynthesis' in window && window.speechSynthesis.speaking;
    const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
      hablandoAhora || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
    );
    if (bloqueaDoble) {
      return false;
    }
    ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
    // Si el motor está ocupado (otra voz sonando), encolar y salir: sonará en onend
    if (hablandoAhora) {
      if (!this.colaVoz.some(x => x.idAtencion === a.idAtencion)) {
        this.colaVoz.push(a);
      }
      return true; // Tick consumido, se re-agendará en su ciclo
    }
    // Watchdog de seguridad
    if (a.speakTimerId) {
      clearTimeout(a.speakTimerId);
      a.speakTimerId = null;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    this.aplicarVoz(utterance);
    utterance.rate = 0.9;
    utterance.onstart = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
    };
    utterance.onend = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
      if (a.speakTimerId) {
        clearTimeout(a.speakTimerId);
        a.speakTimerId = null;
      }
      a.ultimaVozMs = Date.now();
      this.procesarColaVoz();
    };
    utterance.onerror = (e) => {
      console.warn('SpeechSynthesis error:', e.error);
      if (a.speakTimerId) {
        clearTimeout(a.speakTimerId);
        a.speakTimerId = null;
      }
      // NO reintentar aquí: la repetición cada 10s lo re-anunciará
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      this.procesarColaVoz();
    };
    // Sincronización con inicio_ms del servidor
    let retrasoSpeak = 300;
    if (a.inicioMs && Number.isFinite(a.inicioMs)) {
      const objetivoLocal = a.inicioMs - this.deltaRelojMs;
      retrasoSpeak = Math.max(0, objetivoLocal - Date.now());
    }
    a.speakTimerId = setTimeout(() => {
      a.speakTimerId = null;
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      this.ultimoDisparoVozMs = Date.now();
      window.speechSynthesis.speak(utterance);
    }, retrasoSpeak);
    return true;
  }

  /**
   * Saca el siguiente anuncio de la cola y lo reproduce (cuando el motor se libera).
   */
  private procesarColaVoz(): void {
    while (this.colaVoz.length > 0) {
      const next = this.colaVoz.shift()!;
      if (this.anunciosActivos.has(next.idAtencion)) {
        // Reproducir inmediatamente (sin delay de grilla)
        const utterance = new SpeechSynthesisUtterance(this.construirTexto(next));
        this.aplicarVoz(utterance);
        utterance.rate = 0.9;
        const ahora = Date.now();
        const texto = this.construirTexto(next);
        // Guardia global para la cola también
        const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
          window.speechSynthesis.speaking || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
        );
        if (bloqueaDoble) {
          continue; // Saltar este, siguiente de la cola
        }
        ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
        utterance.onstart = () => {
          this.sonidoConfirmado = true;
          if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
          this.quitarListenersDesbloqueo();
        };
        utterance.onend = () => {
          this.sonidoConfirmado = true;
          if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
          this.quitarListenersDesbloqueo();
          next.ultimaVozMs = Date.now();
          this.procesarColaVoz();
        };
        utterance.onerror = (e) => {
          console.warn('SpeechSynthesis error (cola):', e.error);
          if (e.error === 'interrupted' || e.error === 'canceled') return;
          this.procesarColaVoz();
        };
        if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        this.ultimoDisparoVozMs = Date.now();
        window.speechSynthesis.speak(utterance);
        return; // Solo uno a la vez; onend continuará la cola
      }
    }
  }

  /**
   * Construye el texto de anuncio para un AnuncioActivo (extraído para reusar en cola).
   */
  private construirTexto(a: AnuncioActivo): string {
    const nombreCompleto = `${a.paciente} ${a.apellido}`.trim();
    const consultorioLimpio = a.consultorio.replace(/\b0+(\d+)\b/g, '$1');
    let texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${consultorioLimpio}`;
    const c = a.consultorio.toLowerCase();
    if (a.destinoInmediato) {
      // Botones "Llamar" de módulos (APS / clave / laboratorio / imágenes):
      // anuncio único genérico, sin variantes por servicio.
      texto = `Paciente ${nombreCompleto}, por favor acérquese a la recepción`;
    } else if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a imágenes`;
    } else if (c.includes('consulta')) {
      texto = `Paciente ${nombreCompleto}, diríjase a consulta`;
    } else if (c.startsWith('consultorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase al ${consultorioLimpio}`;
    } else if (this.esAnuncioAPS(a.consultorio)) {
      texto = `Paciente ${nombreCompleto}, por favor acérquese a la recepción`;
    }
    return texto;
  }

  /**
   * Persiste el id y momento del último anuncio en sessionStorage para que,
   * tras un F5, el polling (`verificarUltimoLlamado`) detecte que ESTE
   * dispositivo ya anunció a este paciente y reanude el ciclo de 10s en la
   * fase de la grilla que le corresponde (la voz continúa donde iba, como el
   * contador del médico) en vez de re-anunciar de golpe.
   */
  private persistirAnuncioEnSesion(a: AnuncioActivo): void {
    try {
      sessionStorage.setItem('turnero_ultimo_anuncio_id', String(a.idAtencion));
      sessionStorage.setItem('turnero_ultimo_anuncio_ts', String(Date.now()));
      if (a.inicioMs && Number.isFinite(a.inicioMs)) {
        sessionStorage.setItem('turnero_ultimo_anuncio_inicio_ms', String(a.inicioMs));
      }
    } catch {}
  }

  /**
   * Detiene la repetición de un anuncio específico (por id_atencion) o de todos.
   * Limpia la guardia global para que un re-llamado inmediato suene.
   * `preservarSesion`: true solo en recarga de página (F5), donde la memoria
   * de reanudación debe sobrevivir para que la voz continúe el ciclo de 10s.
   */
  private detenerRepeticion(idAtencion?: number, preservarSesion: boolean = false): void {
    if (idAtencion !== undefined) {
      const a = this.anunciosActivos.get(idAtencion);
      if (a) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
        this.anunciosActivos.delete(idAtencion);
        // Sacar de la cola si estaba esperando
        const idx = this.colaVoz.findIndex(x => x.idAtencion === idAtencion);
        if (idx >= 0) this.colaVoz.splice(idx, 1);
      }
    } else {
      // Detener todos
      for (const a of this.anunciosActivos.values()) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
      }
      this.anunciosActivos.clear();
      this.colaVoz.length = 0;
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }
    // Reiniciar guardias para permitir re-llamado inmediato del mismo paciente
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
    if (preservarSesion) {
      // F5: la memoria de reanudación debe sobrevivir a la recarga.
      return;
    }
    try {
      sessionStorage.removeItem('turnero_ultimo_anuncio_id');
      sessionStorage.removeItem('turnero_ultimo_anuncio_ts');
      sessionStorage.removeItem('turnero_ultimo_anuncio_inicio_ms');
    } catch {}
  }
  // Memoria anti-voz-doble: el último llamado que ESTE turnero ya procesó
  // (anunció o detuvo). El polling NO debe re-anunciarlo: tras
  // Iniciar/Ausente/Retirar el paciente sigue en estado "Llamado" en la BD y
  // sin esta memoria el polling lo re-anunciaba + reiniciaba su ciclo (la voz
  // que debía callar seguía sonando y se duplicaba con la del siguiente tick).
  private ultimoLlamadoProcesadoId: number | null = null;
  private ultimoLlamadoProcesadoHora: number = 0;
  // Momento (Date.now) en que la ÚLTIMA locución se disparó de verdad en el
  // motor de voz (dentro del speak). Se usa para el guard del click de
  // desbloqueo: anclar al disparo real (no a la programación) evita que la
  // cadena de 10s refresque el ancla y deje ventanas de doble voz.
  private ultimoDisparoVozMs: number = 0;
  private audioDesbloqueado: boolean = (() => {
    try {
      return typeof sessionStorage !== 'undefined' && sessionStorage.getItem('turnero_audio_unlocked') === 'true';
    } catch {
      return false;
    }
  })();
  /**
   * Confirmación REAL de que el navegador reprodujo voz en ESTA carga de
   * página. A diferencia del flag de sessionStorage, no sobrevive a un F5:
   * la activación de audio del navegador se reinicia con cada recarga, por
   * lo que los listeners de desbloqueo deben seguir activos hasta que
   * speechSynthesis realmente emita onstart.
   */
  private sonidoConfirmado: boolean = false;
  private resumeHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;
  private unlockHandlerClick: (() => void) | null = null;
  private unlockHandlerKeydown: (() => void) | null = null;
  private unlockHandlerTouch: (() => void) | null = null;
  private verificandoUltimoLlamado: boolean = false;
  private verificarTimeout: any = null;
  private verificarFetchSub: Subscription | null = null;
  private ultimoIdReproducido: number | null = null;
  private audioWatchdog: any = null;
  private verificarSub: Subscription | null = null;
  // Campos legacy (ya no usados, mantenidos para compatibilidad con código muerto)
  private repeatTimerId: any = null;
  private pacienteParaRepetir: { paciente: string; apellido: string; consultorio: string } | null = null;
  private ultimoIdAtencion: number | null = null;
  private ultimoNumeroTurno: string | null = null;
  private estaReproduciendo: boolean = false;
  private speakTimeout: any = null;
  /**
   * Hora objetivo (reloj del SERVIDOR) en la que debe sonar el anuncio del
   * paciente actual. La envía el backend en el evento `nuevo-llamado` y en
   * `ultimo-llamado` (`inicio_ms`). Todas las pantallas agendan la voz para
   * esa MISMA hora absoluta → suenan simultáneamente.
   */
  private inicioMsActual: number | null = null;
  /**
   * Desfase estimado (ms) entre el reloj local y el del servidor
   * (positivo si el servidor va adelantado). Se estima con cada evento que
   * trae `server_now` y se usa para convertir `inicio_ms` a tiempo local:
   * así cada dispositivo compensa su desfase y habla en el mismo instante.
   */
  private deltaRelojMs: number = 0;
  private contadorDeltaReloj: number = 0;
  /**
   * Último paciente anunciado y cuándo (para deduplicar anuncios y para
   * reanudar el ciclo de repetición tras una recarga de la página).
   * Se persiste en sessionStorage porque la activación del componente no
   * sobrevive a un F5: así la voz continúa el ciclo de 10s en la fase que
   * le corresponde en vez de reiniciar la locución desde el principio.
   */
  private ultimoIdAnunciado: number | null = (() => {
    try {
      const v = sessionStorage.getItem('turnero_ultimo_anuncio_id');
      return v ? Number(v) || null : null;
    } catch {
      return null;
    }
  })();
  private ultimaVezAnunciado: number = (() => {
    try {
      return Number(sessionStorage.getItem('turnero_ultimo_anuncio_ts') || '0') || 0;
    } catch {
      return 0;
    }
  })();
  /**
   * Ancla (`inicio_ms` del servidor) del último anuncio reproducido por ESTE
   * dispositivo. Se persiste en sessionStorage para que, tras un F5, el
   * polling distinga el MISMO llamado (reanudar la grilla de 10s) de un
   * llamado NUEVO del mismo paciente (p. ej. el médico llama a un paciente
   * que minutos antes fue anunciado por el botón de APS): si el ancla
   * coincide con el `inicio_ms` del llamado, es el mismo; si es más reciente,
   * la voz debe salir YA, sin esperar la siguiente marca de 10s.
   */
  private ultimoAnuncioInicioMs: number | null = (() => {
    try {
      const v = sessionStorage.getItem('turnero_ultimo_anuncio_inicio_ms');
      return v ? Number(v) || null : null;
    } catch {
      return null;
    }
  })();

  constructor(
    readonly api: ApiService,
    readonly route: ActivatedRoute,
    readonly router: Router,
  ) {}

  /** Inicializa: valida sede, carga voz femenina, suscribe a cambios y polling, inicia reloj. */
  ngOnInit() {
    // Guardia global a nivel de window: envuelve speechSynthesis.speak UNA
    // sola vez por pestaña. Aunque existan DOS instancias del turnero (HMR,
    // chunk viejo en caché, doble montaje), el mismo texto jamás puede sonar
    // dos veces en menos de 9s: todas pasan por el mismo envoltorio.
    instalarGuardiaGlobalAntiDoble();
    // Intento de desbloqueo automático al cargar (modo kiosco, cero clicks):
    // en navegadores que lo permiten activa el motor de voz; en Chrome sin
    // gesto previo es un no-op silencioso y los listeners de desbloqueo siguen.
    desbloquearVozNavegador();
    this.initTarjetasResponsive();
    // Marca de versión para verificar en consola (F12) que este turnero corre
    // el código con la guardia anti-doble (un anuncio por ciclo de 10s).
    // El contador de instancias detecta turneros duplicados en la misma pestaña.
    try {
      (window as any).__turnero_instancias = ((window as any).__turnero_instancias || 0) + 1;
      console.log(`[Turnero v7] Guardia anti-doble activa (instancia #${(window as any).__turnero_instancias}): un anuncio cada 10s anclado al contador del médico.`);
    } catch {
      console.log('[Turnero v7] Guardia anti-doble activa: un anuncio cada 10s anclado al contador del médico.');
    }
    const validarSede = (sedeUrl: string | undefined): boolean => {
      // Modo kiosco: la sede puede venir directa en la URL (/turnero/1,
      // /turnero/2). Se acepta y se guarda sin necesidad de pasar por el
      // selector de sedes (cero clicks para entrar al turnero).
      const esSedeValida = sedeUrl === '1' || sedeUrl === '2';
      if (!esSedeValida) {
        this.router.navigate(['/turnero'], { replaceUrl: true });
        return false;
      }
      try {
        if (sessionStorage.getItem('turnero_sede') !== sedeUrl) {
          sessionStorage.setItem('turnero_sede', sedeUrl);
        }
      } catch {
        // Almacenamiento no disponible: la sede queda solo en memoria.
      }
      return true;
    };

    if (!validarSede(this.route.snapshot.params['sede'])) return;

    this.route.params.subscribe(params => {
      if (!validarSede(params['sede'])) return;
      this.sede = params['sede'] ? Number(params['sede']) : null;
      // Al recargar la vista, la sede llega de forma asíncrona: se dispara
      // la verificación del último llamado apenas se conoce, para que el
      // anuncio inicial no se pierda esperando el intervalo de 10s.
      this.verificarUltimoLlamado();
    });

    if (this.resumeHandler) {
      document.removeEventListener('click', this.resumeHandler);
    }
    this.resumeHandler = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    document.addEventListener('click', this.resumeHandler);

    this.registrarDesbloqueoAudio();

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    // Al recargar la página, la voz de la página anterior seguiría sonando
    // en algunos navegadores (móvil, TV) mientras la nueva página anuncia:
    // se escuchaban dos voces encimadas. Se cancela la voz al abandonar la
    // página (beforeunload/pagehide cubren la recarga en todos los navegadores).
    this.beforeUnloadHandler = () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('pagehide', this.beforeUnloadHandler);

    this.queryParamsSub = this.route.queryParams.subscribe(params => {
      const sala = params['sala'] as SalaMode;
      this.sala = SALAS[sala] ? sala : 'aps';
      this.config = SALAS[this.sala];
      this.cargarDatosSala();
    });

    this.cambiosSub = this.api.cambios$.subscribe((data: any) => {
      if (data.id_sede && this.sede && Number(data.id_sede) !== Number(this.sede)) {
        return;
      }

      // Liberación: Iniciar / Ausente / Retirado / estado-cambiado (no 4)
      const esLiberacion = data.id_atencion && (data.tipo === 'liberacion' || data.tipo === 'retirado' ||
        (data.tipo === 'estado-cambiado' && data.id_estado_nuevo !== undefined && Number(data.id_estado_nuevo) !== 4));

      if (esLiberacion) {
        this.detenerRepeticion(data.id_atencion);
      }

      // Nuevo llamado
      const esLlamado = data.tipo === 'llamado' && data.paciente && data.consultorio;
      if (esLlamado) {
        this.procesarLlamado(data);
      }

      this.cargarDatosSala();
    });

    // Revisa periódicamente el último llamado para anunciar llamadas
    // que pudieron perderse si el socket se desconectó o reconectó.
    // Cada 4s (antes 10s): al ser el mecanismo de respaldo (y el principal
    // si el socket del turnero público se cae), un intervalo menor hace que
    // la voz salga "de una vez" en lugar de tardar hasta 10s.
    this.verificarSub = interval(4000).subscribe(() => {
      this.verificarUltimoLlamado();
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

  /**
   * Programa la repetición del anuncio CADA 10 SEGUNDOS EXACTOS, anclada a
   * la grilla global: cada anuncio cae en una marca de `cicloBaseMs + n*10000`
   * (la misma grilla del contador del médico), corregida con `deltaRelojMs`.
   * `primerDelayMs` se usa solo si no hay `cicloBaseMs` (repite cada 10s
   * exactos desde el primer disparo).
   *
   * Usa setTimeout recursivo (NO setInterval): tras cada anuncio se re-agenda
   * el siguiente en la SIGUIENTE marca de 10s. Si un tick se retrasa por
   * throttling del navegador o carga de CPU, el siguiente vuelve a caer
   * EXACTAMENTE en la marca de la grilla: el intervalo jamás acumula deriva.
   */

  private registrarDesbloqueoAudio() {
    if (this.sonidoConfirmado || typeof document === 'undefined') return;
    const desbloquear = () => this.desbloquearAudio();
    this.unlockHandlerClick = desbloquear;
    this.unlockHandlerKeydown = desbloquear;
    this.unlockHandlerTouch = desbloquear;
    document.addEventListener('click', desbloquear);
    document.addEventListener('keydown', desbloquear);
    document.addEventListener('touchstart', desbloquear);
  }

  private quitarListenersDesbloqueo() {
    if (typeof document === 'undefined') return;
    if (this.unlockHandlerClick) document.removeEventListener('click', this.unlockHandlerClick);
    if (this.unlockHandlerKeydown) document.removeEventListener('keydown', this.unlockHandlerKeydown);
    if (this.unlockHandlerTouch) document.removeEventListener('touchstart', this.unlockHandlerTouch);
    this.unlockHandlerClick = null;
    this.unlockHandlerKeydown = null;
    this.unlockHandlerTouch = null;
  }

  private desbloquearAudio() {
    // Si el audio ya fue confirmado en ESTA carga de página (onstart recibido),
    // los clicks posteriores son inofensivos: no hay que volver a desbloquear
    // ni cancelar nada (cancelar cortaría una locución en curso).
    if (this.sonidoConfirmado) return;
    // Si una locución YA se está reproduciendo en este momento, el click no
    // debe cortarla ni re-anunciar: en Chrome/Windows onstart no siempre
    // dispara, así que sonidoConfirmado puede seguir en false mientras la
    // voz suena, y un click aquí cancelaba la locución y la volvía a decir
    // desde el principio (el "recarga y suena otra vez" que escuchabas).
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      return;
    }
    // Tras un F5 el flag de sessionStorage sigue en 'true' pero el navegador
    // reinició la activación de audio: hay que volver a desbloquear dentro
    // del gesto del usuario.
    this.audioDesbloqueado = true;
    try {
      sessionStorage.setItem('turnero_audio_unlocked', 'true');
    } catch {
      // Almacenamiento no disponible: el flag queda activo solo en memoria.
    }
    desbloquearVozNavegador();

    // Buscar un anuncio activo que NUNCA haya sonado (ultimaVozMs === 0)
    // o cuya última voz fue hace >8s (posible autoplay bloqueado).
    // El click fuerza ese anuncio inmediatamente (sin esperar marca de 10s).
    const ahora = Date.now();
    let forzado = false;
    for (const a of this.anunciosActivos.values()) {
      const nuncaSono = a.ultimaVozMs === 0;
      const haceTiempo = a.ultimaVozMs > 0 && ahora - a.ultimaVozMs > 8000;
      if (nuncaSono || haceTiempo) {
        // Forzar ahora: cancelar speakTimerId pendiente y hablar ya
        if (a.speakTimerId) {
          clearTimeout(a.speakTimerId);
          a.speakTimerId = null;
        }
        // Reproducir inmediatamente (sin delay de grilla)
        const texto = this.construirTexto(a);
        // Guardia global
        const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
          window.speechSynthesis.speaking || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
        );
        if (!bloqueaDoble) {
          ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
          const utterance = new SpeechSynthesisUtterance(texto);
          this.aplicarVoz(utterance);
          utterance.rate = 0.9;
          utterance.onstart = () => {
            this.sonidoConfirmado = true;
            if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
            this.quitarListenersDesbloqueo();
          };
          utterance.onend = () => {
            this.sonidoConfirmado = true;
            if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
            this.quitarListenersDesbloqueo();
            a.ultimaVozMs = Date.now();
            this.procesarColaVoz();
          };
          utterance.onerror = (e) => {
            console.warn('SpeechSynthesis error (click):', e.error);
            if (e.error === 'interrupted' || e.error === 'canceled') return;
            this.procesarColaVoz();
          };
          if (window.speechSynthesis.paused) window.speechSynthesis.resume();
          this.ultimoDisparoVozMs = Date.now();
          window.speechSynthesis.speak(utterance);
          forzado = true;
          break; // Solo uno por click
        }
      }
    }

    if (!forzado) {
      // Si no hubo nada que forzar, procesar cola normal (llamados en espera)
      this.procesarColaVoz();
    }
    // Si hubo un llamado mientras el audio estaba bloqueado, polling lo anunciará
    this.verificarUltimoLlamado();
  }

  /**
   * Actualiza el desfase de reloj con una muestra de `server_now`. La primera
   * muestra define el desfase y las siguientes lo suavizan (filtra el ruido
   * de la latencia de red). Se usa para convertir `inicio_ms` (reloj del
   * servidor) a tiempo local y así todas las pantallas hablan a la vez.
   */
  private actualizarDeltaReloj(serverNow: number | undefined) {
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return;
    const muestra = serverNow - Date.now();
    this.contadorDeltaReloj++;
    if (this.contadorDeltaReloj === 1) {
      this.deltaRelojMs = muestra;
    } else {
      this.deltaRelojMs += 0.25 * (muestra - this.deltaRelojMs);
    }
  }

private verificarUltimoLlamado() {
    if (!this.sede || this.verificandoUltimoLlamado) return;
    this.verificandoUltimoLlamado = true;

    const terminar = () => {
      this.verificandoUltimoLlamado = false;
    };

    this.verificarTimeout = setTimeout(() => {
      this.verificarFetchSub = this.api.get<any>(`turnero/ultimo-llamado?sede=${this.sede}`).subscribe({
          next: (data) => {
            if (!data || !data.id_atencion || !data.paciente || !data.consultorio) {
              // Ya no hay un llamado reciente activo: si había un anuncio para este id, se detiene.
              // Como no tenemos id, no sabemos cuál; pero el socket debería haber enviado liberación.
              terminar();
              return;
            }

            // Actualiza el desfase de reloj y la hora objetivo del anuncio
            this.actualizarDeltaReloj(data.server_now);
            if (data.inicio_ms) {
              this.inicioMsActual = data.inicio_ms;
            }

            // Defensa extra: no anunciar llamados antiguos (>10 min)
            const referenciaHora = data.hora_llamado_epoch || (data.hora_llamado ? new Date(data.hora_llamado).getTime() : null);
            if (referenciaHora) {
              const antiguedadMin = (Date.now() - (referenciaHora - this.deltaRelojMs)) / 60000;
              if (antiguedadMin > 10) {
                // Llamado viejo: si estaba en nuestro mapa, lo sacamos
                if (this.anunciosActivos.has(data.id_atencion)) {
                  this.detenerRepeticion(data.id_atencion);
                }
                terminar();
                return;
              }
            }

            // ANTI VOZ DOBLE (memoria de llamado ya procesado): polling no re-anuncia
            const horaDeEsteLlamado = data.inicio_ms || data.hora_llamado_epoch ||
              (data.hora_llamado ? new Date(data.hora_llamado).getTime() : 0) || 0;
            if (data.id_atencion === this.ultimoLlamadoProcesadoId) {
              if (!horaDeEsteLlamado || horaDeEsteLlamado <= this.ultimoLlamadoProcesadoHora) {
                terminar();
                return;
              }
            } else if (horaDeEsteLlamado && this.ultimoLlamadoProcesadoHora >= horaDeEsteLlamado) {
              terminar();
              return;
            }
            this.ultimoLlamadoProcesadoId = data.id_atencion;
            this.ultimoLlamadoProcesadoHora = horaDeEsteLlamado;

            // Si ya tenemos este anuncio activo, polling no hace nada (el ciclo corre solo)
            if (this.anunciosActivos.has(data.id_atencion)) {
              terminar();
              return;
            }

            // Reanudación tras recarga: si este dispositivo ya anunció a este paciente
            // y hay ancla, el ciclo sigue la grilla global. Si no hay ancla o está fuera
            // de ventana, se trata como nuevo llamado.
            //
            // IMPORTANTE: solo se reanuda si es el MISMO llamado (el ancla
            // `inicio_ms` coincide con lo último anunciado, p. ej. tras un F5).
            // Si el llamado es NUEVO (inicio_ms más reciente), aunque sea el
            // mismo paciente (p. ej. el médico llama a alguien que minutos antes
            // fue anunciado por APS), la voz debe salir YA, no esperar la
            // siguiente marca de 10s.
            if (this.ultimoIdAnunciado === data.id_atencion && this.ultimaVezAnunciado > 0 && this.inicioMsActual) {
              const esMismoLlamado = this.ultimoAnuncioInicioMs !== null && Number.isFinite(this.ultimoAnuncioInicioMs) &&
                !!data.inicio_ms && Math.abs(data.inicio_ms - this.ultimoAnuncioInicioMs) < 2000;
              const anclaLocal = this.inicioMsActual - this.deltaRelojMs;
              const elapsed = Date.now() - anclaLocal;
              if (esMismoLlamado && elapsed >= -3000 && elapsed < 120000) {
                console.log(`[Turnero v7] Ciclo anclado (polling): próximo anuncio en la siguiente marca de 10s (contador ≈ ${Math.max(0, Math.round((120000 - elapsed) / 1000))}s).`);
                // Reanudar en la SIGUIENTE marca de la grilla, NO disparar el
                // tick inmediato (el primer anuncio ya sonó antes de la recarga).
                data.inicio_inmediato = false;
                this.procesarLlamado(data);
                terminar();
                return;
              }
            }

            // Nuevo llamado desde polling: crear anuncio y arrancar ciclo
            this.procesarLlamado(data);
            terminar();
          },
          error: () => terminar(),
        });
    }, 500);
  }

  ngOnDestroy() {
    this.destroyTarjetasResponsive();
    this.queryParamsSub?.unsubscribe();
    this.cambiosSub?.unsubscribe();
    this.timerSub?.unsubscribe();
    this.clockSub?.unsubscribe();
    this.verificarSub?.unsubscribe();
    if (this.verificarTimeout) {
      clearTimeout(this.verificarTimeout);
      this.verificarTimeout = null;
    }
    this.verificarFetchSub?.unsubscribe();
    // Detener todos los anuncios y limpiar timers/cola. En un F5 (reload) se
    // PRESERVA la memoria de reanudación en sessionStorage para que la nueva
    // página continúe el ciclo de 10s en la fase que le corresponde (como el
    // contador del médico). En navegación SPA normal se limpia como siempre.
    const esRecargaPagina =
      typeof performance !== 'undefined' &&
      performance.getEntriesByType('navigation')?.length > 0 &&
      (performance.getEntriesByType('navigation')[0] as any)?.type === 'reload';
    this.detenerRepeticion(undefined, esRecargaPagina);
    this.quitarListenersDesbloqueo();
    if (this.resumeHandler) {
      document.removeEventListener('click', this.resumeHandler);
      this.resumeHandler = null;
    }
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.beforeUnloadHandler) {
      window.removeEventListener('beforeunload', this.beforeUnloadHandler);
      window.removeEventListener('pagehide', this.beforeUnloadHandler);
      this.beforeUnloadHandler = null;
    }
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

  /**
   * Cantidad de tarjetas visibles por sección (y umbral de animación):
   * en PC se ven 4 y la animación arranca con 5+ pacientes; en móvil se ven
   * 2 y arranca con 3+. Se detecta con el breakpoint md de Tailwind (768px).
   */
  maxVisibleTarjetas: number = 4;
  private mediaQueryMovil: MediaQueryList | null = null;
  private mediaQueryHandler: (() => void) | null = null;

  private initTarjetasResponsive() {
    if (typeof window === 'undefined') return;
    this.mediaQueryMovil = window.matchMedia('(max-width: 767px)');
    const aplicar = () => {
      this.maxVisibleTarjetas = this.mediaQueryMovil!.matches ? 2 : 4;
    };
    aplicar();
    this.mediaQueryHandler = aplicar;
    this.mediaQueryMovil.addEventListener('change', aplicar);
  }

  private destroyTarjetasResponsive() {
    if (this.mediaQueryMovil && this.mediaQueryHandler) {
      this.mediaQueryMovil.removeEventListener('change', this.mediaQueryHandler);
    }
    this.mediaQueryMovil = null;
    this.mediaQueryHandler = null;
  }

  /**
   * Selecciona la mejor voz en español disponible EN ESTE MOMENTO.
   * Re-consulta `getVoices()` en cada llamada (en Android la lista se carga
   * de forma asíncrona y las referencias guardadas pueden quedar obsoletas).
   * Prefiere: femenina es-MX → es-MX → femenina es-* → cualquier es-*.
   * Devuelve null si NO existe ninguna voz en español (típico en móviles
   * sin el paquete de voz española instalado).
   */
  private elegirVozEspañola(): SpeechSynthesisVoice | null {
    if (!('speechSynthesis' in window)) return null;
    const voces = window.speechSynthesis.getVoices();
    if (!voces.length) return null;

    const femaleKeywords = [
      'female', 'femenina', 'mujer', 'girl', 'sabina', 'paulina', 'helena',
      'monica', 'mónica', 'siri', 'luz', 'marisol', 'rosa', 'alicia', 'elena',
      'carmen', 'valeria', 'sofia', 'sofía', 'maria', 'maría', 'lucia', 'lucía',
      'irene', 'cristina', 'sara', 'laura', 'patricia', 'silvia', 'yolanda',
      'gloria', 'marta', 'ana', 'rebeca', 'victoria', 'julia', 'claudia'
    ];
    const esFemale = (v: SpeechSynthesisVoice) => {
      const langLower = v.lang.toLowerCase();
      if (!langLower.startsWith('es')) return false;
      const nameLower = v.name.toLowerCase();
      return femaleKeywords.some(keyword => nameLower.includes(keyword));
    };
    const esMX = (v: SpeechSynthesisVoice) => {
      const langLower = v.lang.toLowerCase();
      return langLower === 'es-mx' || langLower === 'es_mx';
    };

    return voces.find(v => esMX(v) && esFemale(v))
        || voces.find(esMX)
        || voces.find(esFemale)
        || voces.find(v => v.lang.toLowerCase().startsWith('es'))
        || null;
  }

  /**
   * Aplica a la utterance la mejor voz en español disponible.
   *
   * Si NO existe ninguna voz en español, NO se fuerza `utterance.lang`:
   * en Android, pedir un idioma (p. ej. 'es-MX') que no tiene voz instalada
   * hace que Chrome deletree el texto letra por letra. Sin `lang`, el
   * navegador usa su voz por defecto y lee la frase de corrido.
   *
   * Tampoco se asigna nunca una voz de OTRO idioma (p. ej. una voz en
   * inglés leyendo español): esa mezcla es justo lo que provoca que los
   * nombres se deletreen en el móvil.
   */
  private aplicarVoz(utterance: SpeechSynthesisUtterance): void {
    const voz = this.elegirVozEspañola();
    if (voz) {
      utterance.voice = voz;
      utterance.lang = voz.lang;
    }
    // Sin voz en español → no se toca utterance.lang (evita el deletreo).
  }

  /**
   * Convierte un nombre guardado en MAYÚSCULAS a formato natural
   * ("JUAN CARLOS" → "Juan Carlos") SOLO para la voz. Los motores TTS en
   * Android (Google TTS) interpretan las palabras en mayúscula sostenida
   * como acrónimos y las deletrean letra por letra (por eso el nombre se
   * deletreaba en el móvil pero no en PC). La pantalla sigue mostrando el
   * nombre en mayúsculas: este cambio afecta únicamente la locución.
   */
  private aNombreNatural(nombre: string): string {
    return nombre
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');
  }

}