import { Injectable } from '@angular/core';
import { isCapacitor, getBackendUrl, desbloquearVozNavegador, limpiarGuardiaGlobalAntiDoble } from './voz.util';
import {
  esAnuncioAPS,
  construirTextoAnuncio,
  aNombreNatural,
  retardoHastaInicioAnuncio,
  retardoHastaSiguienteMarca,
} from './turnero-formato.util';

// ---------------------------------------------------------------------------
// GUARDIA GLOBAL ANTI-DOBLE (nivel archivo = compartida por todas las
// instancias del turnero en la misma pestaña)
// ---------------------------------------------------------------------------
let ultimoAnuncioGlobal: { texto: string; ts: number; sonado: boolean } | null = null;
const VENTANA_ANTIDOBLE_MS = 9000;

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------

export interface AnuncioActivo {
  idAtencion: number;
  numeroTurno: string | null;
  paciente: string;
  apellido: string;
  consultorio: string;
  piso: string | null;
  destinoInmediato: boolean;
  primerTickInmediato: boolean;
  inicioMs: number | null;
  baseLocal: number;
  timerId: any | null;
  speakTimerId: any | null;
  ultimaVozMs: number;
  audioUrl?: string;
  audioBlobUrl?: string;
  audioPreload?: Promise<string | undefined>;
  pausado?: boolean;
}

/**
 * Callbacks que el componente Turnero provee al servicio para operaciones
 * de UI (modal de llamado, splash, listeners de desbloqueo).
 * Se inyectan una sola vez vía `setUICallbacks`.
 */
export interface TurneroUICallbacks {
  isSplashVisible(): boolean;
  mostrarModalLlamado(a: AnuncioActivo): void;
  cerrarModalLlamado(): void;
}

// ---------------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------------

@Injectable({ providedIn: 'root' })
export class TurneroVozService {
  // -- UI callbacks (set by the component in ngOnInit) --
  private ui: TurneroUICallbacks | null = null;

  // -- Anuncios activos por id_atencion --
  anunciosActivos = new Map<number, AnuncioActivo>();
  colaVoz: AnuncioActivo[] = [];

  // -- Estado del motor de voz --
  audioServidor: HTMLAudioElement | null = null;
  sintetizandoTTS = false;
  isBrowserTTSSpeaking = false;
  generacionVoz = 0;
  ttsServidorDisponible: boolean | null = null;

  // -- Memoria anti-voz-doble --
  ultimoIdAnunciado: number | null = null;
  ultimaVezAnunciado = 0;
  ultimoAnuncioInicioMs: number | null = null;
  ultimoLlamadoProcesadoId: number | null = null;
  ultimoLlamadoProcesadoHora = 0;
  ultimoDisparoVozMs = 0;
  sonidoConfirmado = false;

  // -- Delta de reloj con el servidor --
  deltaRelojMs = 0;
  contadorDeltaReloj = 0;
  inicioMsActual: number | null = null;

  // -- Modal timer (gestionado internamente) --
  private modalLlamadoTimer: any = null;

  // -- Anuncio general por megáfono (p. ej. recordatorio de silencio) --
  private anuncioGeneralTimer: any = null;
  private anuncioGeneralIntentos = 0;
  private ultimoAnuncioGeneralTexto = '';
  private ultimoAnuncioGeneralTs = 0;

  // -- Audio unlock listeners --
  private unlockHandlerClick: (() => void) | null = null;
  private unlockHandlerKeydown: (() => void) | null = null;
  private unlockHandlerTouch: (() => void) | null = null;

  // -- Voz/resume/beforeunload listeners --
  private resumeHandler: (() => void) | null = null;
  private beforeUnloadHandler: (() => void) | null = null;
  private visibilityHandler: (() => void) | null = null;

  constructor() {
    this.ultimoIdAnunciado = this.loadFromSession('turnero_ultimo_anuncio_id', Number);
    this.ultimaVezAnunciado = this.loadFromSession('turnero_ultimo_anuncio_ts', Number) || 0;
    this.ultimoAnuncioInicioMs = this.loadFromSession('turnero_ultimo_anuncio_inicio_ms', Number);
  }

  // =========================================================================
  //  UI Callbacks
  // =========================================================================

  setUICallbacks(callbacks: TurneroUICallbacks): void {
    this.ui = callbacks;
  }

  // =========================================================================
  //  Motor de voz
  // =========================================================================

  motorVozOcupado(): boolean {
    return this.audioServidor !== null || this.sintetizandoTTS || this.isBrowserTTSSpeaking;
  }

  detenerAudioServidor(): void {
    this.sintetizandoTTS = false;
    if (this.audioServidor) {
      this.audioServidor.pause();
      this.audioServidor.src = '';
      this.audioServidor = null;
    }
  }

  // =========================================================================
  //  Ciclo de repetición / cola
  // =========================================================================

  /**
   * Inicia/reinicia el ciclo de repetición de 10s para un anuncio.
   * Usa setTimeout recursivo (NO setInterval) para auto-corregir deriva.
   */
  iniciarRepeticionAnuncio(a: AnuncioActivo): void {
    if (a.timerId) {
      clearTimeout(a.timerId);
      a.timerId = null;
    }
    const hablar = (): boolean => {
      if (!this.anunciosActivos.has(a.idAtencion)) return false;
      if (a.pausado) return true;
      const esMegafono = a.destinoInmediato || esAnuncioAPS(a.consultorio);
      if (!esMegafono && this.colaVoz.some(x => x.destinoInmediato || esAnuncioAPS(x.consultorio))) {
        return true;
      }
      return this.reproducirAudio(a);
    };

    const esDestino = a.destinoInmediato || esAnuncioAPS(a.consultorio);
    let delay: number | null;
    if (esDestino) {
      delay = retardoHastaInicioAnuncio(a, 0);
    } else if (a.primerTickInmediato) {
      delay = retardoHastaInicioAnuncio(a, 0);
      a.primerTickInmediato = false;
    } else {
      delay = retardoHastaSiguienteMarca(a, 500);
    }
    if (delay === null) {
      this.anunciosActivos.delete(a.idAtencion);
      return;
    }
    a.timerId = setTimeout(() => {
      try {
        hablar();
      } catch (e) {
        console.error('[Turnero v7] Error en anuncio repetido:', e);
      }
      if (esDestino) {
        if (this.colaVoz.some(x => x.idAtencion === a.idAtencion)) {
          // encolado, esperando motor
        } else {
          this.anunciosActivos.delete(a.idAtencion);
        }
      } else if (this.anunciosActivos.has(a.idAtencion) && !a.pausado) {
        this.iniciarRepeticionAnuncio(a);
      } else {
        if (!a.pausado) {
          this.anunciosActivos.delete(a.idAtencion);
        }
      }
    }, delay);
  }

  /**
   * Procesa un llamado (socket o polling): crea el anuncio si no existe y arranca su ciclo.
   */
  procesarLlamado(data: any): void {
    const id = data.id_atencion;
    if (!id) return;
    if (data.forzar) {
      this.reanunciarInmediato(data);
      return;
    }
    if (this.anunciosActivos.has(id)) return;
    this.crearAnuncio(data);
  }

  /**
   * Crea el anuncio de un llamado nuevo y arranca su ciclo de voz.
   */
  crearAnuncio(data: any): void {
    const id = data.id_atencion;
    if (this.anunciosActivos.has(id)) return;

    this.actualizarDeltaReloj(data.server_now);
    if (data.inicio_ms) {
      this.inicioMsActual = data.inicio_ms;
    }
    const anuncio: AnuncioActivo = {
      idAtencion: id,
      numeroTurno: data.turno || null,
      paciente: aNombreNatural(data.paciente || ''),
      apellido: aNombreNatural(data.apellido || ''),
      consultorio: data.consultorio,
      piso: data.piso || null,
      destinoInmediato: data.forzar === true,
      primerTickInmediato: data.inicio_inmediato === true,
      inicioMs: data.inicio_ms ?? this.inicioMsActual,
      baseLocal: (data.inicio_ms ?? this.inicioMsActual) - this.deltaRelojMs,
      timerId: null,
      speakTimerId: null,
      ultimaVozMs: 0,
      audioUrl: data.audio_url || undefined,
    };
    this.anunciosActivos.set(id, anuncio);

    // Pre-descargar el WAV de forma INMEDIATA
    if (anuncio.audioUrl) {
      const url = anuncio.audioUrl;
      const fullUrl = url.startsWith('http') ? url : getBackendUrl(url);
      anuncio.audioPreload = fetch(fullUrl)
        .then(r => r.ok ? r.blob() : Promise.reject(new Error(`HTTP ${r.status}`)))
        .then(blob => {
          anuncio.audioBlobUrl = URL.createObjectURL(blob);
          return anuncio.audioBlobUrl;
        })
        .catch(() => undefined);
    }

    this.ttsServidorDisponible = null;
    this.iniciarRepeticionAnuncio(anuncio);
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();
  }

  /**
   * Re-llamado explícito (botón "Llamar" de APS pulsado de nuevo).
   */
  reanunciarInmediato(data: any): void {
    const id = data.id_atencion;
    // Anti-doble megáfono
    try {
      const ultimoMegafono = (window as any).__turnero_megafono_ultimo;
      const ahoraMegafono = Date.now();
      if (ultimoMegafono && ultimoMegafono.id === id && ahoraMegafono - ultimoMegafono.ts < 2500) {
        return;
      }
      (window as any).__turnero_megafono_ultimo = { id, ts: ahoraMegafono };
    } catch { /* ignore */ }

    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
    this.ultimoLlamadoProcesadoId = id;
    this.ultimoLlamadoProcesadoHora = data.inicio_ms || data.server_now || Date.now();

    if (this.anunciosActivos.has(id)) {
      this.detenerRepeticion(id);
    }
    this.crearAnuncio(data);
  }

  /**
   * Reproduce un anuncio GENERAL por el megáfono del turnero (sin paciente
   * asociado), p. ej. el recordatorio de silencio lanzado desde APS.
   * Se locuta UNA sola vez, sin el ciclo de repetición de 10 s de los
   * llamados de pacientes. Si el motor de voz está ocupado o el turnero
   * aún está en la pantalla de inicio, reintenta a los pocos segundos.
   */
  reproducirAnuncioGeneral(data: any): void {
    const texto = String(data?.texto || '').trim();
    if (!texto) return;

    // Anti-doble: no repetir el mismo texto en una ventana corta.
    const ahora = Date.now();
    if (this.ultimoAnuncioGeneralTexto === texto && ahora - this.ultimoAnuncioGeneralTs < 8000) return;

    // Esperar a que el turnero esté iniciado y el motor de voz esté libre.
    if (this.motorVozOcupado() || !!this.ui?.isSplashVisible()) {
      if (this.anuncioGeneralTimer) return;
      if (this.anuncioGeneralIntentos >= 10) { this.anuncioGeneralIntentos = 0; return; }
      this.anuncioGeneralIntentos++;
      this.anuncioGeneralTimer = setTimeout(() => {
        this.anuncioGeneralTimer = null;
        this.reproducirAnuncioGeneral(data);
      }, 3000);
      return;
    }
    this.anuncioGeneralIntentos = 0;
    this.ultimoAnuncioGeneralTexto = texto;
    this.ultimoAnuncioGeneralTs = ahora;

    ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
    this.sintetizandoTTS = true;

    const onExito = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
      this.sintetizandoTTS = false;
      this.procesarColaVoz();
    };

    const onError = () => {
      this.sintetizandoTTS = false;
      this.procesarColaVoz();
    };

    // Usa el WAV pre-sintetizado si llega; si no, TTS del servidor/navegador.
    this.reproducirTexto(texto, onExito, onError, data.audio_url || undefined);
  }

  /**
   * Detiene la repetición de un anuncio específico o de todos.
   * `preservarSesion`: true solo en recarga de página (F5).
   */
  detenerRepeticion(idAtencion?: number, preservarSesion = false): void {
    const motorActivoAntes = this.sintetizandoTTS;
    if (this.anuncioGeneralTimer) {
      clearTimeout(this.anuncioGeneralTimer);
      this.anuncioGeneralTimer = null;
      this.anuncioGeneralIntentos = 0;
    }
    if (idAtencion !== undefined) {
      const a = this.anunciosActivos.get(idAtencion);
      if (a) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
        this.anunciosActivos.delete(idAtencion);
        const idx = this.colaVoz.findIndex(x => x.idAtencion === idAtencion);
        if (idx >= 0) this.colaVoz.splice(idx, 1);
        this.sintetizandoTTS = false;
      }
    } else {
      for (const a of this.anunciosActivos.values()) {
        if (a.timerId) { clearTimeout(a.timerId); a.timerId = null; }
        if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
      }
      this.anunciosActivos.clear();
      this.colaVoz.length = 0;
      this.detenerAudioServidor();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
      this.generacionVoz++;
    }

    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();

    // Cerrar modal de llamado visual
    if (!motorActivoAntes) {
      this.ui?.cerrarModalLlamado();
    } else {
      if (this.modalLlamadoTimer) clearTimeout(this.modalLlamadoTimer);
      this.modalLlamadoTimer = setTimeout(() => {
        this.modalLlamadoTimer = null;
        this.sintetizandoTTS = false;
        this.ui?.cerrarModalLlamado();
      }, 10000);
    }

    if (preservarSesion) return;
    this.clearSession('turnero_ultimo_anuncio_id');
    this.clearSession('turnero_ultimo_anuncio_ts');
    this.clearSession('turnero_ultimo_anuncio_inicio_ms');
  }

  detenerSoloCiclosMedicos(): void {
    for (const [id, a] of this.anunciosActivos) {
      const esMegafono = a.destinoInmediato || esAnuncioAPS(a.consultorio);
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

  reanudarCiclosPausados(): void {
    for (const [, a] of this.anunciosActivos) {
      if (a.pausado) {
        a.pausado = false;
        this.iniciarRepeticionAnuncio(a);
      }
    }
  }

  persistirAnuncioEnSesion(a: AnuncioActivo): void {
    try {
      sessionStorage.setItem('turnero_ultimo_anuncio_id', String(a.idAtencion));
      sessionStorage.setItem('turnero_ultimo_anuncio_ts', String(Date.now()));
      if (a.inicioMs && Number.isFinite(a.inicioMs)) {
        sessionStorage.setItem('turnero_ultimo_anuncio_inicio_ms', String(a.inicioMs));
      }
    } catch { /* ignore */ }
  }

  limpiarUltimoAnuncio(): void {
    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
  }

  // =========================================================================
  //  Reproducción de audio
  // =========================================================================

  /**
   * Reproduce el audio de un anuncio. Devuelve true si se programó/sonó.
   * Respeta la guardia global anti-doble y serializa las voces.
   */
  reproducirAudio(a: AnuncioActivo): boolean {
    if (this.ui?.isSplashVisible()) return false;

    const texto = construirTextoAnuncio(a);
    const ahora = Date.now();

    // Deduplicación local por instancia
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
    if (bloqueaDoble) return false;

    // Si el motor está ocupado, encolar
    if (hablandoAhora) {
      if (!this.colaVoz.some(x => x.idAtencion === a.idAtencion)) {
        this.colaVoz.push(a);
      }
      return true;
    }

    ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };

    if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
    this.sintetizandoTTS = true;

    const onExito = () => {
      this.sonidoConfirmado = true;
      if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
      this.quitarListenersDesbloqueo();
      this.sintetizandoTTS = false;
      if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
      if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
      a.ultimaVozMs = Date.now();
      if (this.colaVoz.length === 0) {
        this.ui?.cerrarModalLlamado();
      }
      this.procesarColaVoz();
    };

    const onError = (msg?: string) => {
      if (msg) console.warn(msg);
      this.sintetizandoTTS = false;
      if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
      if (a.speakTimerId) { clearTimeout(a.speakTimerId); a.speakTimerId = null; }
      if (this.colaVoz.length === 0) {
        this.ui?.cerrarModalLlamado();
      }
      this.procesarColaVoz();
    };

    let retrasoSpeak = 0;
    if (!a.destinoInmediato && !a.primerTickInmediato && a.inicioMs && Number.isFinite(a.inicioMs)) {
      retrasoSpeak = Math.max(0, a.baseLocal - Date.now());
    }

    a.speakTimerId = setTimeout(async () => {
      a.speakTimerId = null;
      let audioUrlFinal: string | undefined;
      if (a.audioPreload) {
        audioUrlFinal = await a.audioPreload;
      }
      if (!audioUrlFinal) {
        audioUrlFinal = a.audioBlobUrl || a.audioUrl;
      }
      this.ui?.mostrarModalLlamado(a);
      this.reproducirTexto(texto, onExito, onError, audioUrlFinal);
    }, retrasoSpeak);

    return true;
  }

  /**
   * Saca el siguiente anuncio de la cola y lo reproduce.
   */
  procesarColaVoz(): void {
    while (this.colaVoz.length > 0) {
      const next = this.colaVoz.shift()!;
      if (this.anunciosActivos.has(next.idAtencion)) {
        const ahora = Date.now();
        const texto = construirTextoAnuncio(next);
        const estaHablando = this.motorVozOcupado();
        const bloqueaDoble = !!ultimoAnuncioGlobal && ultimoAnuncioGlobal.texto === texto && (
          estaHablando || (ultimoAnuncioGlobal.sonado && ahora - ultimoAnuncioGlobal.ts < VENTANA_ANTIDOBLE_MS)
        );
        if (bloqueaDoble) continue;

        ultimoAnuncioGlobal = { texto, ts: ahora, sonado: false };
        this.sintetizandoTTS = true;
        const esAnuncioUnico = next.destinoInmediato || esAnuncioAPS(next.consultorio);

        const onExito = () => {
          this.sonidoConfirmado = true;
          if (ultimoAnuncioGlobal) ultimoAnuncioGlobal.sonado = true;
          this.quitarListenersDesbloqueo();
          this.sintetizandoTTS = false;
          if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
          if (esAnuncioUnico) this.anunciosActivos.delete(next.idAtencion);
          next.ultimaVozMs = Date.now();
          if (this.colaVoz.length === 0) {
            this.ui?.cerrarModalLlamado();
          }
          this.procesarColaVoz();
        };

        const onError = (msg?: string) => {
          if (msg) console.warn(msg);
          this.sintetizandoTTS = false;
          if (this.modalLlamadoTimer) { clearTimeout(this.modalLlamadoTimer); this.modalLlamadoTimer = null; }
          if (esAnuncioUnico) this.anunciosActivos.delete(next.idAtencion);
          if (this.colaVoz.length === 0) {
            this.ui?.cerrarModalLlamado();
          }
          this.procesarColaVoz();
        };

        setTimeout(() => this.ui?.mostrarModalLlamado(next), 0);
        const audioUrlCola = next.audioUrl;
        next.audioUrl = undefined;
        this.reproducirTexto(texto, onExito, onError, audioUrlCola);
        return;
      }
    }
    // Cola vacía: reanudar ciclos de médicos
    this.reanudarCiclosPausados();
  }

  /**
   * Reproduce texto usando servidor TTS con fallback a Web Speech API.
   */
  async reproducirTexto(texto: string, onExito: () => void, onError: (msg?: string) => void, audioUrl?: string): Promise<void> {
    if (audioUrl) {
      this.reproducirAudioURL(audioUrl, onExito, async () => {
        let fallbackLlamado = false;
        const fallbackNavegador = () => {
          if (fallbackLlamado) return;
          fallbackLlamado = true;
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
          this.reproducirTextoNavegador(texto, onExito, onError);
        };
        const ok = await this.reproducirConServidor(texto, onExito, fallbackNavegador);
        if (!ok) fallbackNavegador();
      });
      return;
    }
    if (this.ttsServidorDisponible === false) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      this.reproducirTextoNavegador(texto, onExito, onError);
      return;
    }
    let fallbackLlamado = false;
    const fallbackNavegador = () => {
      if (fallbackLlamado) return;
      fallbackLlamado = true;
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      this.reproducirTextoNavegador(texto, onExito, onError);
    };
    const ok = await this.reproducirConServidor(texto, onExito, fallbackNavegador);
    if (!ok) fallbackNavegador();
  }

  async reproducirConServidor(texto: string, onEnd: () => void, _onError?: () => void): Promise<boolean> {
    this.sintetizandoTTS = true;
    try {
      const ttsUrl = getBackendUrl('/api/tts');
      const resp = await fetch(ttsUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto }),
      });
      if (!resp.ok) { this.sintetizandoTTS = false; return false; }
      const blob = await resp.blob();
      this.ttsServidorDisponible = true;
      const url = URL.createObjectURL(blob);
      if (this.audioServidor) {
        this.audioServidor.pause();
        this.audioServidor.src = '';
        URL.revokeObjectURL(this.audioServidor.src);
        this.audioServidor = null;
      }
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audioServidor = audio;
      const generacion = this.generacionVoz;
      audio.onended = () => {
        URL.revokeObjectURL(url);
        this.sintetizandoTTS = false;
        if (this.audioServidor === audio) this.audioServidor = null;
        if (generacion !== this.generacionVoz) return;
        onEnd();
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        if (this.audioServidor === audio) this.audioServidor = null;
        this.sintetizandoTTS = false;
      };
      this.ultimoDisparoVozMs = Date.now();
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        if (isCapacitor()) {
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

  async reproducirAudioURL(url: string, onEnd: () => void, onError: () => void): Promise<void> {
    try {
      if (this.audioServidor) {
        this.audioServidor.pause();
        this.audioServidor.src = '';
        URL.revokeObjectURL(this.audioServidor.src);
        this.audioServidor = null;
      }
      const audioUrl = (url.startsWith('http') || url.startsWith('blob:')) ? url : getBackendUrl(url);
      const audio = new Audio(audioUrl);
      audio.preload = 'auto';
      this.audioServidor = audio;
      const generacion = this.generacionVoz;
      audio.onended = () => {
        if (this.audioServidor === audio) this.audioServidor = null;
        if (generacion !== this.generacionVoz) return;
        onEnd();
      };
      audio.onerror = () => {
        if (this.audioServidor === audio) this.audioServidor = null;
      };
      this.ultimoDisparoVozMs = Date.now();
      try {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        await audio.play();
      } catch {
        try {
          audio.onended = null;
          audio.onerror = null;
          audio.pause();
          audio.src = '';
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

  async reproducirConAudioContext(url: string, generacion: number, onEnd: () => void): Promise<void> {
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
    source.onended = () => {
      this.sintetizandoTTS = false;
      if (generacion !== this.generacionVoz) return;
      ctx.close();
      onEnd();
    };
    source.start();
  }

  async reproducirBlobConAudioContext(arrayBuffer: ArrayBuffer, generacion: number, onEnd: () => void): Promise<void> {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) throw new Error('AudioContext no disponible');
    const ctx = new AudioCtx();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    source.onended = () => {
      this.sintetizandoTTS = false;
      if (generacion !== this.generacionVoz) return;
      ctx.close();
      onEnd();
    };
    source.start();
  }

  /**
   * Reproduce texto usando Web Speech API del navegador.
   * Auto-selecciona la mejor voz española si no se provee una.
   */
  reproducirTextoNavegador(texto: string, onExito: () => void, onError: (msg?: string) => void, voz?: SpeechSynthesisVoice | null): void {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      onError('SpeechSynthesis no soportado');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(texto);
    if (voz) {
      utterance.voice = voz;
      utterance.lang = voz.lang;
    } else {
      const vozAuto = this.elegirVozEspañola();
      if (vozAuto) {
        utterance.voice = vozAuto;
        utterance.lang = vozAuto.lang;
      } else {
        utterance.lang = 'es-419';
      }
    }
    utterance.rate = 0.9;
    utterance.onend = () => {
      this.isBrowserTTSSpeaking = false;
      onExito();
    };
    utterance.onerror = (e) => {
      this.isBrowserTTSSpeaking = false;
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

  // =========================================================================
  //  Voz española
  // =========================================================================

  elegirVozEspañola(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
    const voces = window.speechSynthesis.getVoices();
    if (!voces.length) return null;
    const femaleKeywords = [
      'female', 'femenina', 'mujer', 'girl', 'sabina', 'paulina', 'helena',
      'monica', 'mónica', 'siri', 'luz', 'marisol', 'rosa', 'alicia', 'elena',
      'carmen', 'valeria', 'sofia', 'sofía', 'maria', 'maría', 'lucia', 'lucía',
      'irene', 'cristina', 'sara', 'laura', 'patricia', 'silvia', 'yolanda',
      'gloria', 'marta', 'ana', 'rebeca', 'victoria', 'julia', 'claudia',
    ];
    const esFemale = (v: SpeechSynthesisVoice) => {
      if (!v.lang.toLowerCase().startsWith('es')) return false;
      return femaleKeywords.some(k => v.name.toLowerCase().includes(k));
    };
    const es419 = (v: SpeechSynthesisVoice) => v.lang.toLowerCase() === 'es-419' || v.lang.toLowerCase() === 'es_419';
    const esMX = (v: SpeechSynthesisVoice) => v.lang.toLowerCase() === 'es-mx' || v.lang.toLowerCase() === 'es_mx';
    return voces.find(v => es419(v) && esFemale(v))
      || voces.find(es419)
      || voces.find(v => esMX(v) && esFemale(v))
      || voces.find(esMX)
      || voces.find(esFemale)
      || voces.find(v => v.lang.toLowerCase().startsWith('es'))
      || null;
  }

  // =========================================================================
  //  Delta de reloj
  // =========================================================================

  actualizarDeltaReloj(serverNow: number | undefined): void {
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return;
    const muestra = serverNow - Date.now();
    this.contadorDeltaReloj++;
    if (this.contadorDeltaReloj === 1) {
      this.deltaRelojMs = muestra;
    } else {
      this.deltaRelojMs += 0.25 * (muestra - this.deltaRelojMs);
    }
  }

  // =========================================================================
  //  Audio unlock
  // =========================================================================

  registrarDesbloqueoAudio(): void {
    if (this.sonidoConfirmado || typeof document === 'undefined') return;
    const desbloquear = () => this.desbloquearAudio();
    this.unlockHandlerClick = desbloquear;
    this.unlockHandlerKeydown = desbloquear;
    this.unlockHandlerTouch = desbloquear;
    document.addEventListener('click', desbloquear);
    document.addEventListener('keydown', desbloquear);
    document.addEventListener('touchstart', desbloquear);
  }

  quitarListenersDesbloqueo(): void {
    if (typeof document === 'undefined') return;
    if (this.unlockHandlerClick) document.removeEventListener('click', this.unlockHandlerClick);
    if (this.unlockHandlerKeydown) document.removeEventListener('keydown', this.unlockHandlerKeydown);
    if (this.unlockHandlerTouch) document.removeEventListener('touchstart', this.unlockHandlerTouch);
    this.unlockHandlerClick = null;
    this.unlockHandlerKeydown = null;
    this.unlockHandlerTouch = null;
  }

  desbloquearAudio(): void {
    if (this.sonidoConfirmado) return;
    try {
      sessionStorage.setItem('turnero_audio_unlocked', 'true');
    } catch { /* private browsing */ }
    desbloquearVozNavegador();
    this.sonidoConfirmado = true;
    this.quitarListenersDesbloqueo();
  }

  // =========================================================================
  //  Listeners de voz (resume / beforeunload / visibility)
  // =========================================================================

  registrarListenersVoz(): void {
    if (typeof document === 'undefined') return;
    this.resumeHandler = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
    };
    document.addEventListener('click', this.resumeHandler);

    this.visibilityHandler = () => {
      if (document.visibilityState === 'visible' && 'speechSynthesis' in window) {
        if (window.speechSynthesis.paused) {
          window.speechSynthesis.resume();
        }
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.beforeUnloadHandler = () => {
      this.detenerAudioServidor();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
    window.addEventListener('beforeunload', this.beforeUnloadHandler);
    window.addEventListener('pagehide', this.beforeUnloadHandler);
  }

  quitarListenersVoz(): void {
    if (typeof document === 'undefined') return;
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

  // =========================================================================
  //  Private helpers
  // =========================================================================

  private loadFromSession<T>(key: string, transform: (v: string) => T): T | null {
    try {
      const v = sessionStorage.getItem(key);
      return v ? transform(v) : null;
    } catch { return null; }
  }

  private clearSession(key: string): void {
    try { sessionStorage.removeItem(key); } catch { /* ignore */ }
  }
}
