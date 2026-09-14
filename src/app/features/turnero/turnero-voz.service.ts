import { Injectable } from '@angular/core';
import { isCapacitor, getBackendUrl, desbloquearVozNavegador, limpiarGuardiaGlobalAntiDoble } from './voz.util';
import { formatearConsultorioConPiso, esAnuncioAPS } from './turnero-formato.util';

/** Guardia global anti-doble compartida por todas las instancias del turnero. */
let ultimoAnuncioGlobal: { texto: string; ts: number; sonado: boolean } | null = null;
const VENTANA_ANTIDOBLE_MS = 9000;

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

@Injectable({ providedIn: 'root' })
export class TurneroVozService {
  /** Anuncios activos por id_atencion */
  anunciosActivos = new Map<number, AnuncioActivo>();
  colaVoz: AnuncioActivo[] = [];

  /** Estado del motor de voz */
  audioServidor: HTMLAudioElement | null = null;
  sintetizandoTTS = false;
  isBrowserTTSSpeaking = false;
  generacionVoz = 0;
  ttsServidorDisponible: boolean | null = null;

  /** Memoria anti-voz-doble */
  ultimoIdAnunciado: number | null = null;
  ultimaVezAnunciado = 0;
  ultimoAnuncioInicioMs: number | null = null;
  ultimoLlamadoProcesadoId: number | null = null;
  ultimoLlamadoProcesadoHora = 0;
  ultimoDisparoVozMs = 0;
  sonidoConfirmado = false;

  /** Delta de reloj con el servidor */
  deltaRelojMs = 0;
  contadorDeltaReloj = 0;
  inicioMsActual: number | null = null;

  constructor() {
    this.ultimoIdAnunciado = this.loadFromSession('turnero_ultimo_anuncio_id', Number);
    this.ultimaVezAnunciado = this.loadFromSession('turnero_ultimo_anuncio_ts', Number) || 0;
    this.ultimoAnuncioInicioMs = this.loadFromSession('turnero_ultimo_anuncio_inicio_ms', Number);
  }

  motorVozOcupado(): boolean {
    return this.audioServidor !== null || this.sintetizandoTTS || this.isBrowserTTSSpeaking;
  }

  actualizarDeltaReloj(serverNow: number | undefined) {
    if (typeof serverNow !== 'number' || !Number.isFinite(serverNow)) return;
    const muestra = serverNow - Date.now();
    this.contadorDeltaReloj++;
    if (this.contadorDeltaReloj === 1) {
      this.deltaRelojMs = muestra;
    } else {
      this.deltaRelojMs += 0.25 * (muestra - this.deltaRelojMs);
    }
  }

  detenerAudioServidor(): void {
    this.sintetizandoTTS = false;
    if (this.audioServidor) {
      this.audioServidor.pause();
      this.audioServidor.src = '';
      this.audioServidor = null;
    }
  }

  detenerRepeticion(idAtencion?: number, preservarSesion = false): void {
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
    if (!preservarSesion) {
      this.clearSession('turnero_ultimo_anuncio_id');
      this.clearSession('turnero_ultimo_anuncio_ts');
      this.clearSession('turnero_ultimo_anuncio_inicio_ms');
    }
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

  reanudarCiclosPausados(callbackIniciar: (a: AnuncioActivo) => void): void {
    for (const [, a] of this.anunciosActivos) {
      if (a.pausado) {
        a.pausado = false;
        callbackIniciar(a);
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
    } catch { /* sessionStorage unavailable */ }
  }

  /** Reproduce audio usando AudioContext (bypass autoplay policy). */
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

  async reproducirConServidor(texto: string, onEnd: () => void): Promise<boolean> {
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
      utterance.lang = 'es-419';
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

  elegirVozEspañola(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
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

  limpiarUltimoAnuncio(): void {
    this.ultimoIdAnunciado = null;
    this.ultimaVezAnunciado = 0;
    ultimoAnuncioGlobal = null;
    limpiarGuardiaGlobalAntiDoble();
  }

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
