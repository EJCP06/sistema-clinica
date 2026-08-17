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

// ---------------------------------------------------------------------------
// GUARDIA GLOBAL ANTI-DOBLE (a nivel de window)
// ---------------------------------------------------------------------------
// El problema: aunque el turnero tenga su propia lógica anti-doble, si en la
// MISMA pestaña existen DOS instancias del componente (p. ej. por HMR del
// dev server que deja la instancia vieja viva, o por un chunk viejo en caché
// que monta otra copia), CADA instancia llama a speechSynthesis.speak() con
// su propio estado interno, y la lógica de una no ve la de la otra → dos
// voces. La guardia anterior solo cubría UNA instancia.
//
// Solución definitiva: envolver `speechSynthesis.speak` UNA sola vez por
// pestaña (marcador en window). Solo se descarta el MISMO texto (mismo
// paciente + consultorio) si ya está sonando o sonó hace menos de 9s en esta
// pestaña, SIN importar cuántas instancias ni qué lógica lo llame. Un texto
// DISTINTO (otro paciente, otro consultorio: dos doctores con la misma
// especialidad) NUNCA se bloquea, aunque otra voz esté sonando: el navegador
// lo encola y ambas voces se escuchan. La repetición legítima cada 10s
// siempre pasa (10s > 9s). La guardia es solo intra-pestaña: no se comparte
// entre pestañas ni dispositivos, así cada pantalla anuncia por separado
// (las voces se sincronizan por la hora absoluta `inicio_ms` del backend).
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
    // Si no se puede marcar, la guardia se reinstala (inofensivo).
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
    // Almacenamiento no disponible: se ignora.
  }
}

function limpiarUltimoSpeak() {
  try {
    delete (window as any)[ULTIMO_SPEAK_KEY];
  } catch {
    // Almacenamiento no disponible: se ignora.
  }
}

/**
 * Envuelve `speechSynthesis.speak` UNA sola vez por pestaña con una guardia
 * global: el MISMO texto no puede reproducirse dos veces en menos de 9s.
 * Esto hace físicamente imposible el doble anuncio aunque existan dos
 * instancias del turnero (HMR, chunks viejos, doble montaje), porque todas
 * pasan por este mismo envoltorio.
 */
export function instalarGuardiaGlobalAntiDoble() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (guardiaYaInstalada()) return; // Ya se envolvió en esta pestaña.

  const synth = window.speechSynthesis;
  const speakOriginal = synth.speak.bind(synth);

  synth.speak = function (utterance: SpeechSynthesisUtterance) {
    const texto = (utterance && utterance.text || '').trim();
    if (texto) {
      const ahora = Date.now();
      const ultimo = getUltimoSpeak();
      const esElMismoTexto = !!ultimo && ultimo.texto === texto;

      // Solo se bloquea el MISMO texto (mismo paciente + consultorio) si ya
      // está sonando o sonó hace menos de 9s en esta pestaña. La repetición
      // legítima cada 10s siempre pasa (10s > 9s). Un texto DISTINTO (dos
      // doctores con la misma especialidad pero consultorios diferentes) NUNCA
      // se bloquea, aunque otra voz esté sonando: el navegador lo encola y
      // ambas voces se escuchan. La guardia es solo intra-pestaña: no se
      // comparte entre pestañas ni dispositivos, así cada pantalla anuncia.
      const hablandoElMismo = esElMismoTexto && synth.speaking;
      const sonóReciente = esElMismoTexto && ahora - ultimo!.ts < VENTANA_ANTIDOBLE_MS;
      if (hablandoElMismo || sonóReciente) {
        return; // Doble del mismo anuncio: se descarta en el origen.
      }
      setUltimoSpeak(texto);
    }
    return speakOriginal(utterance);
  };

  marcarInstalada();
}

/**
 * Limpia el registro del último speak (se usa al detener la repetición con
 * Iniciar/Ausente/Retirar: si el mismo paciente se vuelve a llamar justo
 * después, debe sonar de inmediato).
 */
export function limpiarGuardiaGlobalAntiDoble() {
  limpiarUltimoSpeak();
}
