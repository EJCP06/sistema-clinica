/**
 * Desbloquea la síntesis de voz del navegador y el Audio HTML5.
 *
 * Los navegadores (especialmente Chrome) bloquean `speechSynthesis.speak()`
 * y `audio.play()` hasta que el usuario interactúa con la página. Hablar un
 * texto en silencio y reproducir un audio silencioso dentro de un gesto de
 * usuario (click/touch/keydown) desbloquea ambos motores para llamadas
 * posteriores que vienen de contextos asíncronos (eventos de socket, timers,
 * polling, etc.).
 */
export function desbloquearVozNavegador() {
  if (typeof window === 'undefined') return;

  // Desbloquear speechSynthesis
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(' ');
      utterance.volume = 0;
      utterance.rate = 1;
      window.speechSynthesis.speak(utterance);
    } catch {
    }
  }

  // Desbloquear HTML5 Audio (para Piper TTS)
  try {
    const silent = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=');
    silent.volume = 0;
    silent.play().catch(() => {});
  } catch {
  }
}

/**
 * Detecta si la app corre en Capacitor (Android/iOS) o en un navegador.
 */
export function isCapacitor(): boolean {
  return typeof window !== 'undefined' && !!(window as any).Capacitor;
}

/**
 * Construye la URL completa del backend.
 * En navegador usa URL relativa (mismo dominio).
 * En Capacitor usa la URL del capacitor.config.ts.
 */
export function getBackendUrl(path: string): string {
  if (isCapacitor()) {
    // En Capacitor, usar la URL configurada en capacitor.config.ts
    const config = (window as any).__CAPACITOR_CONFIG__;
    const baseUrl = config?.server?.url || 'https://cola-cat.clinicanuevacaracas.net';
    return `${baseUrl}${path}`;
  }
  // En navegador, URL relativa
  return path;
}

/**
 * Descarga audio usando CapacitorHttp (sin CORS) y lo reproduce.
 * Esta es la solución para Android donde HTML5 Audio no funciona con URLs externas.
 *
 * Flujo:
 *   1. CapacitorHttp.fetch() descarga el WAV sin restricciones CORS
 *   2. Se convierte a Blob
 *   3. Se crea un blob URL
 *   4. Se reproduce con HTML5 Audio
 */
export async function descargarYReproducirAudio(url: string): Promise<HTMLAudioElement> {
  // Importar Capacitor dinámicamente
  const { CapacitorHttp } = await import('@capacitor/core');

  // 1. Descargar audio con CapacitorHttp (sin CORS)
  const response = await CapacitorHttp.get({
    url: url,
    responseType: 'blob',
  });

  // 2. Convertir a Blob
  const blob = new Blob([response.data], { type: 'audio/wav' });
  const blobUrl = URL.createObjectURL(blob);

  // 3. Reproducir
  const audio = new Audio(blobUrl);
  audio.volume = 1.0;

  return new Promise((resolve, reject) => {
    audio.onended = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(audio);
    };
    audio.onerror = (err) => {
      URL.revokeObjectURL(blobUrl);
      reject(err);
    };
    audio.play().catch(reject);
  });
}

/**
 * Descarga audio usando CapacitorHttp y retorna el blob URL.
 * El caller es responsable de reproducir y limpiar.
 */
export async function descargarAudioBlob(url: string): Promise<string> {
  const { CapacitorHttp } = await import('@capacitor/core');

  const response = await CapacitorHttp.get({
    url: url,
    responseType: 'blob',
  });

  const blob = new Blob([response.data], { type: 'audio/wav' });
  return URL.createObjectURL(blob);
}

/**
 * Usa Text-to-Speech nativo de Capacitor (Android).
 */
export async function hablarNativo(texto: string): Promise<void> {
  try {
    const { TextToSpeech } = await import('@capacitor-community/text-to-speech');
    await TextToSpeech.speak({
      text: texto,
      lang: 'es-VE',
      rate: 1.0,
      pitch: 1.0,
      volume: 1.0,
    });
  } catch (err) {
    console.error('Error en TTS nativo:', err);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// GUARDIA GLOBAL ANTI-DOBLE (a nivel de window)
// ---------------------------------------------------------------------------
const VENTANA_ANTIDOBLE_MS = 9000;

const GUARDIA_KEY = '__turnero_guardia_instalada';
const ULTIMO_SPEAK_KEY = '__turnero_ultimo_speak';

interface UltimoSpeak {
  texto: string;
  ts: number;
}

function guardiaYaInstalada(): boolean {
  try {
    return !!(window as any)[GUARDIA_KEY];
  } catch {
    return false;
  }
}

function marcarInstalada() {
  try {
    (window as any)[GUARDIA_KEY] = true;
  } catch {
  }
}

function getUltimoSpeak(): UltimoSpeak | null {
  try {
    return (window as any)[ULTIMO_SPEAK_KEY] || null;
  } catch {
    return null;
  }
}

function setUltimoSpeak(texto: string) {
  try {
    (window as any)[ULTIMO_SPEAK_KEY] = { texto, ts: Date.now() };
  } catch {
  }
}

function limpiarUltimoSpeak() {
  try {
    delete (window as any)[ULTIMO_SPEAK_KEY];
  } catch {
  }
}

/**
 * Envuelve `speechSynthesis.speak` UNA sola vez por pestaña con una guardia
 * global: el MISMO texto no puede reproducirse dos veces en menos de 9s.
 */
export function instalarGuardiaGlobalAntiDoble() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (guardiaYaInstalada()) return;

  const synth = window.speechSynthesis;
  const speakOriginal = synth.speak.bind(synth);

  synth.speak = function (utterance: SpeechSynthesisUtterance) {
    const texto = (utterance && utterance.text || '').trim();
    if (texto) {
      const ahora = Date.now();
      const ultimo = getUltimoSpeak();
      const esElMismoTexto = !!ultimo && ultimo.texto === texto;

      const hablandoElMismo = esElMismoTexto && synth.speaking;
      const sonóReciente = esElMismoTexto && ahora - ultimo!.ts < VENTANA_ANTIDOBLE_MS;
      if (hablandoElMismo || sonóReciente) {
        return;
      }
      setUltimoSpeak(texto);
    }
    return speakOriginal(utterance);
  };

  marcarInstalada();
}

/**
 * Limpia el registro del último speak.
 */
export function limpiarGuardiaGlobalAntiDoble() {
  limpiarUltimoSpeak();
}
