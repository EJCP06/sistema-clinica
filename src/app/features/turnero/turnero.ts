import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, Bell, Volume2, Clock, Users, Stethoscope, FlaskConical, ScanLine, ClipboardList, ArrowLeft, LucideIconData } from 'lucide-angular';
import { ApiService } from '../../core/services/api.service';
import { TurnoDTO } from '../../core/models/dto.models';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, interval } from 'rxjs';
import { ApsScrollDirective } from './aps-scroll.directive';
import { desbloquearVozNavegador, instalarGuardiaGlobalAntiDoble, limpiarGuardiaGlobalAntiDoble, isCapacitor, getBackendUrl, descargarAudioBlob } from './voz.util';

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
  /** Piso físico del consultorio (tabla "Consultorios"): se antepone al número en la voz (ej. "01" en piso "1" => "101"). */
  piso: string | null;
  /** Llamado de módulo (APS / Laboratorio / Imágenes): anuncio único e inmediato. */
  destinoInmediato: boolean;
  /** Llamado del médico ("Llamar al Siguiente"): el primer anuncio sale ya y el ciclo de 10s continúa. */
  primerTickInmediato: boolean;
  inicioMs: number | null;
  /** Grilla anclada al momento de la creación: `inicioMs - deltaRelojMs`. Se calcula UNA vez y NO cambia con el tiempo para evitar deriva. */
  baseLocal: number;
  timerId: any | null;
  speakTimerId: any | null;
  ultimaVozMs: number;
  /** URL del audio pre-sintetizado por el servidor (para sincronización entre pantallas). */
  audioUrl?: string;
  /** Blob URL cacheado del WAV pre-descargado (para reproducción instantánea). */
  audioBlobUrl?: string;
  /** Promesa de pre-descarga del WAV (para esperar antes de reproducir). */
  audioPreload?: Promise<string | undefined>;
  /** true cuando el ciclo se pausó temporalmente (ej. llegó un megáfono). Se reanuda al terminar el megáfono. */
  pausado?: boolean;
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

  /**
   * Muestra el consultorio con el piso antepuesto en la pantalla (ej.
   * consultorio "01" en piso "1" => "101", o en mezanina con piso "M" =>
   * "M01", conservando el cero). El piso se toma de la ESPECIALIDAD del
   * turno (configurado en Especialidades) y se respalda con el del
   * consultorio físico. Puede ser numérico o una letra (M = mezanina),
   * siempre en mayúscula. Si no hay piso o el nombre no es numérico,
   * conserva el formato actual. Usado en las tarjetas de pacientes llamados.
   */
  consultorioConPiso(t: TurnoDTO): string {
    const nombre = (t.consultorio_nombre || '').trim();
    if (!nombre) {
      // Para pacientes de laboratorio/imagenes no hay consultorio fisico:
      // mostrar el nombre del servicio (ej. "Laboratorio", "Imagenes").
      const svc = (t.nombre_servicio || '').trim();
      return svc || 'Consultorio';
    }
    const piso = (t.especialidad_piso || t.consultorio_piso || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const digitos = nombre.match(/\d+/);
    if (piso && digitos) {
      // Se conserva el número original del consultorio (con su cero): "M" + "01" => "M01".
      return nombre.replace(digitos[0], `${piso}${digitos[0]}`);
    }
    return nombre.replace(/\b0+(\d+)\b/g, '$1');
  }

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
  /** Audio element for server-side TTS playback. Null when nothing is playing. */
  private audioServidor: HTMLAudioElement | null = null;
  /**
   * true mientras hay una síntesis del servidor en vuelo (fetch POST /api/tts
   * en curso, antes de que exista el elemento <audio>). Cierra la ventana en
   * la que el motor parece libre pero ya hay una voz "comprometida": sin esto,
   * dos llamados (p. ej. el ciclo de 10s del doctor A y un llamado nuevo del
   * doctor B) arrancan su fetch a la vez y el que termina ÚLTIMO mata el audio
   * del otro — la voz de B no sonaba hasta que A entraba en atención.
   */
  private sintetizandoTTS: boolean = false;

  /**
   * true mientras el navegador (fallback) está hablando vía Web Speech API.
   * Se usa en motorVozOcupado() para bloquear nuevos anuncios sin incluir la
   * utterance de DESBLOQUEO (volumen=0) que se usa solo para activar el motor.
   */
  private isBrowserTTSSpeaking: boolean = false;

  /** Indica si el motor de voz está ocupado (audio del servidor sonando, síntesis en vuelo
   * o el navegador hablando con el fallback Web Speech). Se usa isBrowserTTSSpeaking
   * en lugar de speechSynthesis.speaking para excluir la utterance de desbloqueo. */
  private motorVozOcupado(): boolean {
    return this.audioServidor !== null ||
      this.sintetizandoTTS ||
      this.isBrowserTTSSpeaking;
  }
  /**
   * Generación de voz: se incrementa cada vez que se detiene un anuncio o
   * se inicia uno nuevo. Los callbacks de audio (onEnd/onError) del anuncio
   * ANTERIOR capturan la generación en la que nacieron; si al dispararse la
   * generación ya cambió, se ignoran. Esto evita que el audio viejo (o su
   * fallback con la voz del navegador) suene encima del anuncio nuevo.
   */
  private generacionVoz: number = 0;
  /** Whether server TTS is available (checked on first use). */
  private ttsServidorDisponible: boolean | null = null;

  /**
   * Calcula el retardo hasta la siguiente marca de 10s de la grilla del llamado.
   * Devuelve null si el llamado ya pasó la ventana de 115s (VENTANA_LLAMADO_MS).
   */
  private retardoHastaSiguienteMarca(a: AnuncioActivo, minMs: number): number | null {
    if (!a.inicioMs || !Number.isFinite(a.inicioMs)) {
      return Math.max(minMs, 10000);
    }
    const baseLocal = a.baseLocal;
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
    const baseLocal = a.baseLocal;
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
      // Si el anuncio está pausado (llegó un megáfono), no hablar y
      // re-agendar para el siguiente tick. Se reanudará cuando el megáfono
      // termine (reanudarCiclosPausados).
      if (a.pausado) {
        return true; // Tick consumido; se re-agendará en el siguiente ciclo
      }
      // Prioridad: si es ciclo médico (no megáfono) y hay megáfonos en cola,
      // NO tocamos y re-agendamos para la siguiente marca de 10s.
      const esMegafono = a.destinoInmediato || this.esAnuncioAPS(a.consultorio);
      if (!esMegafono && this.colaVoz.some(x => x.destinoInmediato || this.esAnuncioAPS(x.consultorio))) {
        return true; // Tick consumido; se re-agendará en el siguiente ciclo
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
      // "Llamar al Siguiente": la voz sale YA (sin espera). El backend manda
      // `inicio_ms` en el pasado inmediato del clic, así que con minMs 0 el
      // retardo queda en 0 y el anuncio se dispara apenas llega el evento.
      delay = this.retardoHastaInicioAnuncio(a, 0);
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
      } catch (e) {
        console.error('[Turnero v7] Error en anuncio repetido:', e);
      }
      // Llamados de módulo: anuncio único. Como el paciente no cambia de
      // estado al llamarlo, el ciclo de repetición de 10s sonaría en bucle,
      // así que no se re-agenda.
      if (continuar && !esDestino) {
        this.iniciarRepeticionAnuncio(a);
      } else if (this.colaVoz.some(x => x.idAtencion === a.idAtencion)) {
        // El megáfono quedó ENCOLADO esperando que el motor se libere (p. ej.
        // el ciclo de 10s del doctor A está sonando). NO se borra de
        // anunciosActivos: procesarColaVoz lo sacará y reproducirá apenas
        // termine la voz en curso. Si se borrara aquí, procesarColaVoz lo
        // saltaría (anunciosActivos.has = false) y la voz del megáfono no
        // sonaría hasta que el paciente del doctor entrara en atención.
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
    // ANTI-DOBLE: si ya existe un anuncio activo para esta atención, NO crear
    // otro. Evita que el polling duplique el anuncio del socket (o viceversa).
    if (this.anunciosActivos.has(id)) {
      return;
    }
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
      piso: data.piso || null,
      // Los llamados de módulo (botones "Llamar" de APS/Lab/Imágenes) llevan
      // `forzar: true`: suenan al instante, son de disparo único y se
      // repiten en cada pulsación. La grilla de consultorios no lo lleva.
      destinoInmediato: data.forzar === true,
      // El médico ("Llamar al Siguiente") manda `inicio_inmediato: true`:
      // el primer anuncio sale ya y el ciclo de 10s de la grilla continúa.
      primerTickInmediato: data.inicio_inmediato === true,
      inicioMs: data.inicio_ms ?? this.inicioMsActual,
      baseLocal: (data.inicio_ms ?? this.inicioMsActual) - this.deltaRelojMs,
      timerId: null,
      speakTimerId: null,
      ultimaVozMs: 0,
      audioUrl: data.audio_url || undefined,
    };
    this.anunciosActivos.set(id, anuncio);
    // Pre-descargar el WAV de forma INMEDIATA y guardar la Promesa.
    // Cuando llegue el turno de reproducir, se hará await de esta promesa
    // para que el WAV ya esté en memoria (blob URL) y suene INMEDIATO.
    if (anuncio.audioUrl) {
      const url = anuncio.audioUrl;
      const fullUrl = url.startsWith('http') ? url : getBackendUrl(url);
      anuncio.audioPreload = fetch(fullUrl)
        .then(r => r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(blob => {
          anuncio.audioBlobUrl = URL.createObjectURL(blob);
          return anuncio.audioBlobUrl;
        })
        .catch(() => undefined); // silencioso: reproducirTexto maneja fallback
    }
    // Resetear disponibilidad del servidor TTS en cada llamado nuevo para que
    // tras un error temporal se reintente en lugar de quedarse en fallback permanente.
    this.ttsServidorDisponible = null;
    this.iniciarRepeticionAnuncio(anuncio);
    // Memoria anti-voz-doble para polling
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();
  }

  private esAnuncioAPS(consultorio: string): boolean {
    return consultorio.trim().toLowerCase() === 'aps';
  }

  /**
   * Pausa SOLO los ciclos de médicos (grilla 10s), NO los megáfonos (destinoInmediato/APS).
   * Se usa cuando llega un megáfono: los ciclos médicos se pausan y se reanudan
   * cuando el megáfono termina (en procesarColaVoz). A diferencia de borrarlos,
   * pausarlos permite que su ciclo de 10s continúe después del megáfono.
   */
  private detenerSoloCiclosMedicos(): void {
    for (const [id, a] of this.anunciosActivos) {
      const esMegafono = a.destinoInmediato || this.esAnuncioAPS(a.consultorio);
      if (!esMegafono) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
        a.pausado = true;
        const idx = this.colaVoz.findIndex(x => x.idAtencion === id);
        if (idx >= 0) this.colaVoz.splice(idx, 1);
      }
    }
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
  }

  /**
   * Reanuda los ciclos de médicos que se pausaron al llegar un megáfono.
   * Se llama cuando el megáfono termina de sonar y la cola de voz queda vacía.
   */
  private reanudarCiclosPausados(): void {
    for (const [id, a] of this.anunciosActivos) {
      if (a.pausado) {
        a.pausado = false;
        this.iniciarRepeticionAnuncio(a);
      }
    }
  }

  /**
   * Compone el destino del consultorio para la voz: si el consultorio tiene
   * piso asignado, se antepone al número del consultorio (consultorio "01"
   * en piso "1" => "101", o en mezanina con piso "M" => "M5", sin el cero:
   * se lee "eme cinco" y no "eme cero cinco"). Cuando el piso es numérico se
   * conserva el cero para que "1" + "01" siga siendo "101". El piso puede
   * ser numérico o una letra (M = mezanina), siempre en mayúscula. Si no hay
   * piso o el nombre no es numérico, conserva el formato actual.
   */
  private formatearConsultorioConPiso(consultorio: string, piso?: string | null): string {
    const nombre = (consultorio || '').trim();
    const pisoLimpio = (piso || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    const digitos = nombre.match(/\d+/);
    if (pisoLimpio && digitos) {
      // Con piso de letra (M = mezanina) se quita el cero: "M" + "05" => "M5".
      const numero = /^\d+$/.test(pisoLimpio) ? digitos[0] : digitos[0].replace(/^0+/, '');
      return nombre.replace(digitos[0], `${pisoLimpio}${numero}`);
    }
    return nombre.replace(/\b0+(\d+)\b/g, '$1');
  }

  /**
   * Re-llamado explícito (botón "Llamar" de APS pulsado de nuevo): limpia las
   * guardias anti-doble del mismo texto, corta la locución en curso si la hay
   * y reprocesa el llamado como nuevo. Como `inicio_ms` ya está en el pasado,
   * `reproducirAudio` habla de inmediato (retardo 0).
   */
  private reanunciarInmediato(data: any): void {
    const id = data.id_atencion;
    // ANTI VOZ DOBLE del megáfono: si este mismo llamado ya se re-anunció
    // hace <2.5s, es un duplicado y se ignora.
    try {
      const ultimoMegafono = (window as any).__turnero_megafono_ultimo;
      const ahoraMegafono = Date.now();
      if (ultimoMegafono && ultimoMegafono.id === id && ahoraMegafono - ultimoMegafono.ts < 2500) {
        return;
      }
      (window as any).__turnero_megafono_ultimo = { id, ts: ahoraMegafono };
    } catch {
      // Almacenamiento no disponible: se ignora.
    }
    // Resetea la memoria local anti-doble para que el texto suene cuando
    // toque (no se bloquea por haber sonado recientemente el mismo paciente).
    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
    // Evita que el polling re-anuncie este mismo llamado
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();
    // Detener el anuncio anterior si existe para que crearAnuncio pueda
    // recrearlo (crearAnuncio tiene guardia anti-doble si ya existe).
    if (this.anunciosActivos.has(id)) {
      this.detenerRepeticion(id);
    }
    this.crearAnuncio(data);
  }

  /**
   * Reproduce el audio de un anuncio. Devuelve true si se programó/sonó.
   * Respeta la guardia global anti-doble y serializa las voces (cola si hay otra sonando).
   */
  private reproducirAudio(a: AnuncioActivo): boolean {
    // No reproducir audio mientras el splash esté visible (el usuario aún no
    // tocó "TOCA PARA INICIAR"). El anuncio queda en anunciosActivos y se
    // reproducirá cuando iniciarTurnero() lo procese.
    if (this.showSplash) {
      // Do not show visual modal if splash is visible (audio is not ready either)
      return false;
    }
    // NOTA: speechSynthesis NO existe en el WebView de Android (Capacitor).
    // No bloqueamos aqui: el audio se reproduce via WAV/AudioContext,
    // y speechSynthesis solo se usa como último fallback en reproducirTextoNavegador.
    const nombreCompleto = `${a.paciente} ${a.apellido}`.trim();
    // Piso + número del consultorio (ej. consultorio "01" en piso "1" => "101")
    const destinoConsultorio = this.formatearConsultorioConPiso(a.consultorio, a.piso);
    let texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${destinoConsultorio}`;
    const c = a.consultorio.toLowerCase();
    if (a.destinoInmediato) {
      // Botones "Llamar" de módulos (APS / clave / laboratorio / imágenes):
      // anuncio de disparo inmediato. El texto DEBE coincidir con el generado
      // por emitirLlamadoNuevo en el backend (salaEspera=true) para evitar
      // doble voz cuando el WAV pre-sintetizado falla y se usa POST /api/tts.
      const destinoModulo = (a.consultorio || '').toLowerCase();
      if (destinoModulo.includes('laboratorio')) {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de laboratorio`;
      } else if (destinoModulo.includes('imagen')) {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de imágenes`;
      } else {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de APS`;
      }
    } else if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de imágenes`;
    } else if (c.includes('consulta')) {
      texto = `Paciente ${nombreCompleto}, diríjase a consulta`;
    } else if (c.startsWith('consultorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase al ${destinoConsultorio}`;
    } else if (this.esAnuncioAPS(a.consultorio)) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de APS`;
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
    const hablandoAhora = this.motorVozOcupado();
    const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
      hablandoAhora || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
    );
    if (bloqueaDoble) {
      return false;
    }
    // Si el motor está ocupado (otra voz sonando o sintetizando), encolar y
    // mostrar modal de inmediato: el audio sonará cuando el motor se libere.
    // IMPORTANTE: al ENCOLAR no se reclama ultimoAnuncioGlobal. Si se fijara
    // aquí (con sonado:false), el onExito del anuncio en curso (p. ej. el
    // ciclo de 10s del doctor A) marcaría ESE registro como "sonado" y el
    // dedup bloquearía al encolado (doctor B) para siempre: la voz de B no
    // sonaba hasta que el paciente de A entraba en atención.
    if (hablandoAhora) {
      if (!this.colaVoz.some(x => x.idAtencion === a.idAtencion)) {
        this.colaVoz.push(a);
      }
      return true; // Tick consumido, se re-agendará en su ciclo
    }
    ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
    // Watchdog de seguridad
    if (a.speakTimerId) {
      clearTimeout(a.speakTimerId);
      a.speakTimerId = null;
    }
    // RESERVAR el motor DESDE aquí (antes del retraso de sincronización):
    // entre este punto y el disparo real de reproducirTexto pueden pasar
    // hasta ~300ms, y sin la reserva otro llamado (p. ej. el tick de 10s del
    // doctor A) pasaría también el check de motor libre, arrancaría su fetch
    // a la vez y el que termina último mataría el audio de este paciente.
    this.sintetizandoTTS = true;
    const onExito = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
      this.sintetizandoTTS = false;
      if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
      if (a.speakTimerId) {
        clearTimeout(a.speakTimerId);
        a.speakTimerId = null;
      }
      a.ultimaVozMs = Date.now();
      if (this.colaVoz.length === 0) {
        this.cerrarModalLlamado();
      }
      this.procesarColaVoz();
    };
    const onError = (msg?: string) => {
      if (msg) console.warn(msg);
      this.sintetizandoTTS = false;
      if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
      if (a.speakTimerId) {
        clearTimeout(a.speakTimerId);
        a.speakTimerId = null;
      }
      if (this.colaVoz.length === 0) {
        this.cerrarModalLlamado();
      }
      this.procesarColaVoz();
    };
    // Para llamados inmediatos (APS/médico), delay = 0 para que suene YA.
    // Solo usar delay de grilla para ciclos de repetición de médicos.
    let retrasoSpeak = 0;
    if (!a.destinoInmediato && !a.primerTickInmediato && a.inicioMs && Number.isFinite(a.inicioMs)) {
      retrasoSpeak = Math.max(0, a.baseLocal - Date.now());
    }
    a.speakTimerId = setTimeout(async () => {
      a.speakTimerId = null;
      // ESPERAR a que el WAV pre-descargado esté listo (blob en memoria).
      // Sin esto, el Audio() tiene que descargar el WAV de la red → delay perceptible.
      let audioUrlFinal: string | undefined;
      if (a.audioPreload) {
        audioUrlFinal = await a.audioPreload;
      }
      if (!audioUrlFinal) {
        audioUrlFinal = a.audioBlobUrl || a.audioUrl;
      }
      // Mostrar modal y reproducir audio SIMULTÁNEAMENTE (el WAV ya está en memoria).
      this.mostrarModalLlamado(a);
      this.reproducirTexto(texto, onExito, onError, audioUrlFinal);
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
        const ahora = Date.now();
        const texto = this.construirTexto(next);
        const estaHablando = this.motorVozOcupado();
        const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
          estaHablando || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
        );
        if (bloqueaDoble) {
          continue; // Saltar este, siguiente de la cola
        }
        ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
        this.sintetizandoTTS = true;
        // Los megáfonos (destinoInmediato/APS) son de disparo único: al
        // reproducirlos desde la cola se liberan de anunciosActivos, igual
        // que cuando suenan directo. Los ciclos del médico NO se tocan (su
        // ciclo de 10s sigue re-agendando y debe permanecer en el mapa).
        const esAnuncioUnico = next.destinoInmediato || this.esAnuncioAPS(next.consultorio);
        const onExito = () => {
          this.sonidoConfirmado = true;
          if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
          this.quitarListenersDesbloqueo();
          this.sintetizandoTTS = false;
          if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
          if (esAnuncioUnico) this.anunciosActivos.delete(next.idAtencion);
          next.ultimaVozMs = Date.now();
          if (this.colaVoz.length === 0) {
            this.cerrarModalLlamado();
          }
          this.procesarColaVoz();
        };
        const onError = (msg?: string) => {
          if (msg) console.warn(msg);
          this.sintetizandoTTS = false;
          if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
          if (esAnuncioUnico) this.anunciosActivos.delete(next.idAtencion);
          if (this.colaVoz.length === 0) {
            this.cerrarModalLlamado();
          }
          this.procesarColaVoz();
        };
        // Mostrar modal al reproducir desde la cola (deferred para no interrumpir audio)
        setTimeout(() => this.mostrarModalLlamado(next), 0);
        // Pasar audioUrl pre-sintetizado si existe (APS/Lab/Imágenes lo mandan),
        // para que suene Piper en lugar del fallback al navegador.
        const audioUrlCola = next.audioUrl;
        next.audioUrl = undefined; // Solo primer uso; repeticiones van por POST
        this.reproducirTexto(texto, onExito, onError, audioUrlCola);
        return; // Solo uno a la vez; onend continuará la cola
      }
    }
    // Cuando la cola queda vacía (el último megáfono terminó de sonar),
    // reanudar los ciclos de médicos que se pausaron al llegar el megáfono.
    this.reanudarCiclosPausados();
  }

  /**
   * Construye el texto de anuncio para un AnuncioActivo (extraído para reusar en cola).
   */
  private construirTexto(a: AnuncioActivo): string {
    const nombreCompleto = `${a.paciente} ${a.apellido}`.trim();
    // Piso + número del consultorio (ej. consultorio "01" en piso "1" => "101")
    const destinoConsultorio = this.formatearConsultorioConPiso(a.consultorio, a.piso);
    let texto = `Paciente ${nombreCompleto}, diríjase al consultorio ${destinoConsultorio}`;
    const c = a.consultorio.toLowerCase();
    if (a.destinoInmediato) {
      // Botones "Llamar" de módulos (APS / clave / laboratorio / imágenes):
      // anuncio de disparo inmediato. El texto DEBE coincidir con el generado
      // por emitirLlamadoNuevo en el backend (salaEspera=true) para evitar
      // doble voz cuando el WAV pre-sintetizado falla y se usa POST /api/tts.
      const destinoModulo = (a.consultorio || '').toLowerCase();
      if (destinoModulo.includes('laboratorio')) {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de laboratorio`;
      } else if (destinoModulo.includes('imagen')) {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de imágenes`;
      } else {
        texto = `Paciente ${nombreCompleto}, diríjase a la recepción de APS`;
      }
    } else if (c.includes('laboratorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de laboratorio`;
    } else if (c.includes('imágenes') || c.includes('imagenes')) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de imágenes`;
    } else if (c.includes('consulta')) {
      texto = `Paciente ${nombreCompleto}, diríjase a consulta`;
    } else if (c.startsWith('consultorio')) {
      texto = `Paciente ${nombreCompleto}, diríjase al ${destinoConsultorio}`;
    } else if (this.esAnuncioAPS(a.consultorio)) {
      texto = `Paciente ${nombreCompleto}, diríjase a la recepción de APS`;
    }
    return texto;
  }

  /**
   * Reproduce audio generado por el backend (node-edge-tts).
   * Si el backend no está disponible, retorna false para que el caller
   * use Web Speech API como respaldo.
   */
  private async reproducirConServidor(texto: string, onEnd: () => void, onError: () => void): Promise<boolean> {
    // Marca el motor como ocupado DESDE el inicio del fetch (no solo cuando
    // el <audio> ya existe): cierra la ventana en la que dos llamados (p. ej.
    // el ciclo de 10s del doctor A y un llamado nuevo del doctor B) creen que
    // el motor está libre, arranquen su fetch a la vez y el que termina
    // último mate el audio del otro.
    this.sintetizandoTTS = true;
    try {
      const ttsUrl = getBackendUrl('/api/tts');
      
      let blob: Blob;
      
      // Usar fetch normal para TODOS los entornos (CORS configurado en servidor)
      // Nota: CapacitorHttp está deshabilitado para que Socket.IO funcione
      const resp = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (!resp.ok) {
        this.ttsServidorDisponible = false;
        // Auto-resetear después de 30s para reintentar el servidor
        setTimeout(() => { this.ttsServidorDisponible = null; }, 30000);
        this.sintetizandoTTS = false;
        return false;
      }
      blob = await resp.blob();
      
      this.ttsServidorDisponible = true;
      const url = URL.createObjectURL(blob);
      // Detener audio anterior si existe (defensa: con la marca de síntesis
      // en vuelo el turnero ya no debería llegar aquí con otro audio sonando)
      if (this.audioServidor) {
        this.audioServidor.pause();
        this.audioServidor.src = '';
        URL.revokeObjectURL(this.audioServidor.src);
        this.audioServidor = null;
      }
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audioServidor = audio;
      // Captura la generación actual: si al terminar (o fallar) este audio ya
      // se anunció OTRO paciente (generación cambiada), estos callbacks se
      // ignoran. Sin esto, el onEnd del audio viejo disparaba procesarColaVoz
      // y el anuncio anterior volvía a sonar (con la voz del navegador por el
      // fallback) encima del paciente nuevo.
      const generacion = this.generacionVoz;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.sintetizandoTTS = false;
        if (this.audioServidor === audio) this.audioServidor = null;
        if (generacion !== this.generacionVoz) return;
        onEnd();
      };
      audio.onerror = () => {
        // SOLO limpiar recursos y resetear estado. NO llamar onError() aquí
        // porque el catch de audio.play() ya maneja el fallback (AudioContext).
        // Si onError() se dispara aquí Y en el catch, se lanzan 2 reproducciones
        // en paralelo (doble voz).
        URL.revokeObjectURL(url);
        if (this.audioServidor === audio) this.audioServidor = null;
        this.sintetizandoTTS = false;
      };
      this.ultimoDisparoVozMs = Date.now();
      try {
        // Antes de sonar el audio del servidor (Piper) se corta cualquier voz
        // del navegador que haya quedado hablando de un anuncio anterior; así
        // no se escucha la voz de la PC de fondo encima de la de Piper.
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        
        // En Capacitor (Android), usar Crosswalk o plugin nativo
        if (isCapacitor()) {
          // Android WebView: forzar reproducción con workaround
          audio.load();
          await new Promise<void>((resolve, reject) => {
            audio.oncanplaythrough = () => resolve();
            audio.onerror = () => reject(new Error('Error cargando audio'));
          });
          await audio.play();
        } else {
          await audio.play();
        }
        return true;
      } catch {
        // Autoplay bloqueado: intentar con AudioContext (byppasea autoplay policy)
        // IMPORTANTE: limpiar el <audio> ANTES para que su onerror no dispare
        // el fallback de voz del navegador encima de Piper.
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          audio.src = '';
          URL.revokeObjectURL(url);
          this.audioServidor = null;
          const arrayBuffer = await blob.arrayBuffer();
          await this.reproducirBlobConAudioContext(arrayBuffer, generacion, onEnd);
          return true;
        } catch {
          this.sintetizandoTTS = false;
          return false;
        }
      }
    } catch {
      this.sintetizandoTTS = false;
      return false;
    }
  }

  /**
   * Cancela la reproducción del audio del servidor TTS.
   */
  private detenerAudioServidor(): void {
    this.sintetizandoTTS = false;
    if (this.audioServidor) {
      this.audioServidor.pause();
      this.audioServidor.src = '';
      this.audioServidor = null;
    }
  }

  /**
   * Reproduce un texto usando el servidor TTS (node-edge-tts) con fallback
   * a Web Speech API del navegador.
   * Si se proporciona audioUrl, reproduce ese WAV directamente (audio
   * pre-sintetizado por el servidor para sincronización entre pantallas).
   */
  private async reproducirTexto(texto: string, onExito: () => void, onError: (msg?: string) => void, audioUrl?: string): Promise<void> {
    // Si hay audio pre-sintetizado, reproducirlo directamente (más rápido y sincronizado)
    if (audioUrl) {
      this.reproducirAudioURL(audioUrl, onExito, async () => {
        // Si el WAV falla (404, Piper no disponible), intentar POST /api/tts on-the-fly
        let fallbackLlamado = false;
        const fallbackNavegador = () => {
          if (fallbackLlamado) return; // Evita doble llamada
          fallbackLlamado = true;
          if ('speechSynthesis' in window) window.speechSynthesis.cancel();
          this.reproducirTextoNavegador(texto, onExito, onError);
        };
        const ok = await this.reproducirConServidor(texto, onExito, fallbackNavegador);
        // IMPORTANTE: si ok=false, reproducirConServidor NO llamó onError (retornó
        // false directo), así que el fallback aún no se activó → activarlo ahora.
        if (!ok) fallbackNavegador();
      });
      return;
    }
    // Si ya se detectó que el servidor no está disponible, ir directo al fallback
    if (this.ttsServidorDisponible === false) {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.reproducirTextoNavegador(texto, onExito, onError);
      return;
    }
    let fallbackLlamado = false;
    const fallbackNavegador = () => {
      if (fallbackLlamado) return; // Evita doble llamada
      fallbackLlamado = true;
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      this.reproducirTextoNavegador(texto, onExito, onError);
    };
    const ok = await this.reproducirConServidor(texto, onExito, fallbackNavegador);
    // IMPORTANTE: si ok=false, reproducirConServidor NO llamó onError (retornó
    // false directo), así que el fallback aún no se activó → activarlo ahora.
    if (!ok) fallbackNavegador();
  }

  /**
   * Reproduce un audio pre-sintetizado desde una URL (WAV servido por el backend).
   * Se usa cuando el servidor pre-generó el audio antes de emitir el socket,
   * para que todos los turneros reproduzcan el mismo WAV simultáneamente.
   */
  private async reproducirAudioURL(url: string, onEnd: () => void, onError: () => void): Promise<void> {
    try {
      if (this.audioServidor) {
        this.audioServidor.pause();
        this.audioServidor.src = '';
        URL.revokeObjectURL(this.audioServidor.src);
        this.audioServidor = null;
      }
      
      // Construir URL completa si es necesaria (para Capacitor/Android)
      // Blob URLs (blob:...) se usan tal cual, no necesitan prefijo.
      const audioUrl = (url.startsWith('http') || url.startsWith('blob:')) ? url : getBackendUrl(url);
      
      let audio: HTMLAudioElement;
      let blobUrl: string | null = null;
      
      // En Capacitor (Android), descargar audio con CapacitorHttp (sin CORS)
      // Usar fetch para descargar audio (CORS configurado en servidor)
      // Nota: En Capacitor se usa fetch normal (CapacitorHttp está deshabilitado)
      audio = new Audio(audioUrl);
      audio.preload = 'auto';
      
      this.audioServidor = audio;
      const generacion = this.generacionVoz;
      audio.onended = () => {
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (this.audioServidor === audio) this.audioServidor = null;
        if (generacion !== this.generacionVoz) return;
        onEnd();
      };
      audio.onerror = () => {
        // SOLO limpiar recursos. NO llamar onError() aquí porque el catch de
        // audio.play() ya maneja el fallback. Si onError() se dispara aquí Y en
        // el catch, se lanzan 2 reproducciones en paralelo (doble voz).
        if (blobUrl) URL.revokeObjectURL(blobUrl);
        if (this.audioServidor === audio) this.audioServidor = null;
      };
      this.ultimoDisparoVozMs = Date.now();
      try {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        await audio.play();
      } catch {
        // Autoplay bloqueado: intentar con AudioContext (byppasea autoplay policy)
        // IMPORTANTE: limpiar el <audio> ANTES para que su onerror no dispare
        // el fallback de voz del navegador encima de Piper.
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          audio.src = '';
          if (blobUrl) URL.revokeObjectURL(blobUrl);
          this.audioServidor = null;
          await this.reproducirConAudioContext(audioUrl, generacion, onEnd);
        } catch {
          onError();
        }
      }
    } catch {
      onError();
    }
  }

  /**
   * Reproduce audio usando AudioContext (Web Audio API).
   * Funciona cuando HTMLAudioElement.play() está bloqueado por autoplay policy.
   */
  private async reproducirConAudioContext(url: string, generacion: number, onEnd: () => void): Promise<void> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext no disponible');

    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const arrayBuffer = await resp.arrayBuffer();

    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // IMPORTANTE: NO resetear sintetizandoTTS aquí. Debe permanecer true
    // mientras AudioContext suena para que motorVozOcupado() returne true
    // y el ciclo de 10s no lance otra reproducción encima.
    source.onended = () => {
      this.sintetizandoTTS = false;
      if (generacion !== this.generacionVoz) return;
      ctx.close();
      onEnd();
    };
    source.start();
  }

  /**
   * Reproduce un ArrayBuffer de audio usando AudioContext.
   * Usado cuando el audio viene de un blob (POST /api/tts) y audio.play() falla.
   */
  private async reproducirBlobConAudioContext(arrayBuffer: ArrayBuffer, generacion: number, onEnd: () => void): Promise<void> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext no disponible');

    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);

    // IMPORTANTE: NO resetear sintetizandoTTS aquí. Debe permanecer true
    // mientras AudioContext suena para que motorVozOcupado() returne true
    // y no se lance otra reproducción encima.
    source.onended = () => {
      this.sintetizandoTTS = false;
      if (generacion !== this.generacionVoz) return;
      ctx.close();
      onEnd();
    };
    source.start();
  }

  /**
   * Reproduce un texto usando la Web Speech API del navegador (fallback).
   */
  private reproducirTextoNavegador(texto: string, onExito: () => void, onError: (msg?: string) => void): void {
    if (!('speechSynthesis' in window)) {
      onError('SpeechSynthesis no soportado');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    this.aplicarVoz(utterance);
    utterance.rate = 0.9;
    // onstart NO llama onExito: hacerlo liberaba sintetizandoTTS y el motor
    // antes de que la locución terminara, permitiendo que el polling disparara
    // una nueva reproducción que cancelaba la actual (se escuchaba solo "pa").
    utterance.onend = () => {
      this.isBrowserTTSSpeaking = false;
      onExito();
    };
    utterance.onerror = (e) => {
      this.isBrowserTTSSpeaking = false;
      // Aunque sea una cancelación intencional, liberar el motor para que el
      // siguiente anuncio en cola pueda procesarse.
      if (e.error === 'interrupted' || e.error === 'canceled') {
        onError();
        return;
      }
      onError(`SpeechSynthesis error: ${e.error}`);
    };
    if (window.speechSynthesis.paused) window.speechSynthesis.resume();
    this.ultimoDisparoVozMs = Date.now();
    this.isBrowserTTSSpeaking = true;
    window.speechSynthesis.speak(utterance);
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
    // Guardar estado del motor ANTES de modificar, para decidir si cerrar modal.
    const motorActivoAntes = this.sintetizandoTTS;
    if (idAtencion !== undefined) {
      const a = this.anunciosActivos.get(idAtencion);
      if (a) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
        this.anunciosActivos.delete(idAtencion);
        // Sacar de la cola si estaba esperando
        const idx = this.colaVoz.findIndex(x => x.idAtencion === idAtencion);
        if (idx >= 0) this.colaVoz.splice(idx, 1);
        // Si este anuncio había reservado el motor y nunca llegó a sonar
        // (timer cancelado antes de disparar), liberar la reserva para que el
        // siguiente anuncio en cola (p. ej. el paciente del doctor B) pueda
        // sonar de inmediato.
        this.sintetizandoTTS = false;
      }
    } else {
      // Detener todos
      for (const a of this.anunciosActivos.values()) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
      }
      this.anunciosActivos.clear();
      this.colaVoz.length = 0;
      this.detenerAudioServidor();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      // Invalida los callbacks de audio en vuelo del anuncio anterior
      this.generacionVoz++;
    }
    // Reiniciar guardias para permitir re-llamado inmediato del mismo paciente
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
    // Cerrar modal de llamado visual SOLO si la voz ya no estaba sonando
    // ANTES de esta detención. Si la voz sigue activa (AudioContext reproduciendo),
    // el onExito la cerrará cuando termine.
    if (!motorActivoAntes) {
      this.cerrarModalLlamado();
    } else {
      // Respaldo: cerrar el modal tras 10s si la voz no terminó
      // (generacionVoz++ invalidó los callbacks onExito/onError).
      if (this.modalLlamadoTimer) clearTimeout(this.modalLlamadoTimer);
      this.modalLlamadoTimer = setTimeout(() => {
        this.modalLlamadoTimer = null;
        this.sintetizandoTTS = false;
        this.cerrarModalLlamado();
      }, 10000);
    }
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
    readonly cdr: ChangeDetectorRef,
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
    // Detectar modo TV: pantalla grande (TV) pero viewport estrecho (navegador de TV).
    // En este caso, forzar viewport ancho para que las clases md: de Tailwind se activen.
    // Se detecta Android TV por user agent para no confundir con phones/tablets normales.
    if (typeof window !== 'undefined') {
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
          // Usar 1366 para que coincida con la resolución real del TV (1366×768)
          // y las clases md: de Tailwind se activen correctamente
          meta.setAttribute('content', 'width=1366');
        }
        // Agregar clase CSS al body para estilos específicos de TV
        document.body.classList.add('tv-mode');
      }
      // SIEMPRE mostrar splash en TV y móvil para desbloquear audio.
      // Esto garantiza que el usuario toque la pantalla en cada carga.
      // El navegador requiere una interacción del usuario (touch/click)
      // para permitir reproducción de audio.
      this.showSplash = true;
    }
    // Marca de versión para verificar en consola (F12) que este turnero corre
    // el código con la guardia anti-doble (un anuncio por ciclo de 10s).
    // El contador de instancias detecta turneros duplicados en la misma pestaña.
    try {
      (window as any).__turnero_instancias = ((window as any).__turnero_instancias || 0) + 1;
    } catch {
      // El contador de instancias es solo informativo; el turnero funciona igual sin él.
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
      this.detenerAudioServidor();
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
    this.verificarSub = interval(2000).subscribe(() => {
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
    if (this.sonidoConfirmado) return;
    this.audioDesbloqueado = true;
    try {
      sessionStorage.setItem('turnero_audio_unlocked', 'true');
    } catch {
    }
    // Solo desbloquear audio (AudioContext + speechSynthesis).
    // NO reproducir anuncios aquí: el socket y el ciclo de 10s ya los
    // manejan. Reproducir aquí causaría doble voz (el mismo audio suena
    // dos veces: una por desbloquearAudio y otra por el socket/ciclo).
    desbloquearVozNavegador();
    this.sonidoConfirmado = true;
    this.quitarListenersDesbloqueo();
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
  }  private verificarUltimoLlamado() {
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
                !!data.inicio_ms && Math.abs(data.inicio_ms - this.ultimoAnuncioInicioMs) < 5000;
              const anclaLocal = this.inicioMsActual - this.deltaRelojMs;
              const elapsed = Date.now() - anclaLocal;
              if (esMismoLlamado && elapsed >= -3000 && elapsed < 120000) {
                // Reanudar usando el inicio_ms ORIGINAL (guardado en sessionStorage)
                // para que la grilla de 10s siga alineada con el ciclo anterior.
                data.inicio_ms = this.ultimoAnuncioInicioMs!;
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
    // Restaurar viewport original si se modificó para modo TV
    if (this.tvMode && this.originalViewport) {
      const meta = document.querySelector('meta[name="viewport"]');
      if (meta) {
        meta.setAttribute('content', this.originalViewport);
      }
    }
    // Cerrar modal de llamado visual
    this.cerrarModalLlamado();
  }

  /** Oculta el splash de TV y desbloquea el audio con la interacción del usuario. */
  iniciarTurnero() {
    this.showSplash = false;
    this.desbloquearAudio();
    // Reproducir el anuncio más reciente que llegó mientras el splash estaba
    // visible (el usuario aún no había tocado la pantalla, así que el audio
    // fue silenciado). Si hay varios, solo reproducimos el más nuevo; los
    // demás quedarán en la cola si el motor está ocupado.
    const pendientes = Array.from(this.anunciosActivos.values())
      .filter(a => a.idAtencion !== this.ultimoIdAnunciado)
      .sort((a, b) => (b.inicioMs || 0) - (a.inicioMs || 0));
    if (pendientes.length > 0) {
      this.reproducirAudio(pendientes[0]);
    }
  }

  cambiarSala(sala: SalaMode) {
    this.router.navigate([], { queryParams: { sala }, replaceUrl: true });
  }

  volverASedes() {
    sessionStorage.removeItem('turnero_sede');
    this.router.navigate(['/turnero'], { replaceUrl: true });
  }

  /**
   * Muestra el modal de llamado visual con el nombre del paciente y el destino.
   * Si ya hay un modal visible, cambia los datos con una transición suave.
   */
  mostrarModalLlamado(a: AnuncioActivo): void {
    const destino = this.calcularDestinoVisual(a.consultorio, a.piso);
    
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

  /**
   * Cierra el modal de llamado visual con animación de salida.
   */
  cerrarModalLlamado(): void {
    if (!this.showModalLlamado || this.modalLlamadoClosing) return;
    this.modalLlamadoClosing = true;
    this.cdr.detectChanges();
    setTimeout(() => {
      this.showModalLlamado = false;
      this.modalLlamadoClosing = false;
      this.cdr.detectChanges();
    }, 300);
  }

  /**
   * Calcula el destino legible para el modal visual.
   * Misma lógica que construirTexto() pero solo la parte del destino.
   */
  private calcularDestinoVisual(consultorio: string, piso?: string | null): string {
    const destinoConsultorio = this.formatearConsultorioConPiso(consultorio, piso);
    const c = consultorio.toLowerCase();

    if (c.includes('laboratorio')) {
      return 'RECEPCIÓN DE LABORATORIO';
    } else if (c.includes('imagen') || c.includes('imagenes')) {
      return 'RECEPCIÓN DE IMÁGENES';
    } else if (c.includes('consulta')) {
      return 'CONSULTA';
    } else if (c.startsWith('consultorio')) {
      return `CONSULTORIO ${destinoConsultorio}`;
    } else if (this.esAnuncioAPS(consultorio)) {
      return 'RECEPCIÓN DE APS';
    }
    // Si hay piso, mostrar consultorio con piso antepuesto (ej. "02" en piso "1" => "102")
    return destinoConsultorio.toUpperCase() || (consultorio || 'DESTINO').toUpperCase();
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

  /** Modo TV: pantalla grande (≥1280px) pero viewport estrecho (<768px). */
  tvMode: boolean = false;
  /** Splash de inicio en modo TV: requiere una interacción para desbloquear audio. */
  showSplash: boolean = false;
  private originalViewport: string | null = null;

  // Modal de llamado visual
  showModalLlamado = false;
  modalLlamadoClosing = false;
  modalLlamadoCambiando = false;
  modalLlamadoPaciente = '';
  modalLlamadoApellido = '';
  modalLlamadoDestino = '';
  modalLlamadoTurno = '';
  private modalLlamadoTimer: any = null;

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
   * Prefiere: femenina es-419 → es-419 → femenina es-MX → es-MX → femenina es-* → cualquier es-*.
   * es-419 es el código ISO para español latinoaméricano general.
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
    const es419 = (v: SpeechSynthesisVoice) => {
      const langLower = v.lang.toLowerCase();
      return langLower === 'es-419' || langLower === 'es_419';
    };
    const esMX = (v: SpeechSynthesisVoice) => {
      const langLower = v.lang.toLowerCase();
      return langLower === 'es-mx' || langLower === 'es_mx';
    };

    return voces.find(v => es419(v) && esFemale(v))
        || voces.find(es419)
        || voces.find(v => esMX(v) && esFemale(v))
        || voces.find(esMX)
        || voces.find(esFemale)
        || voces.find(v => v.lang.toLowerCase().startsWith('es'))
        || null;
  }

  /**
   * Aplica a la utterance la mejor voz en español disponible.
   *
   * Si NO existe ninguna voz en español, se fuerza `utterance.lang = 'es-419'`
   * (español latinoaméricano general) para que el navegador use su voz por
   * defecto con acento latino. En Android, si el paquete de voz latino no está
   * instalado, Chrome puede deletrear el texto letra por letra; en ese caso
   * el usuario debe instalar el paquete de voz español desde la configuración
   * del sistema.
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
    } else {
      utterance.lang = 'es-419';
    }
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