/**
 * Utilidades puras para selección de voz del navegador.
 * Sin estado, sin dependencias de Angular.
 */

const FEMALE_KEYWORDS = [
  'female', 'femenina', 'mujer', 'girl', 'sabina', 'paulina', 'helena',
  'monica', 'mónica', 'siri', 'luz', 'marisol', 'rosa', 'alicia', 'elena',
  'carmen', 'valeria', 'sofia', 'sofía', 'maria', 'maría', 'lucia', 'lucía',
  'irene', 'cristina', 'sara', 'laura', 'patricia', 'silvia', 'yolanda',
  'gloria', 'marta', 'ana', 'rebeca', 'victoria', 'julia', 'claudia',
];

function esVozFemenina(v: SpeechSynthesisVoice): boolean {
  const langLower = v.lang.toLowerCase();
  if (!langLower.startsWith('es')) return false;
  const nameLower = v.name.toLowerCase();
  return FEMALE_KEYWORDS.some(kw => nameLower.includes(kw));
}

function es419(v: SpeechSynthesisVoice): boolean {
  const l = v.lang.toLowerCase();
  return l === 'es-419' || l === 'es_419';
}

function esMX(v: SpeechSynthesisVoice): boolean {
  const l = v.lang.toLowerCase();
  return l === 'es-mx' || l === 'es_mx';
}

/**
 * Selecciona la mejor voz en español disponible.
 * Prefiere: femenina es-419 → es-419 → femenina es-MX → es-MX → femenina es-* → cualquier es-*.
 * Devuelve null si NO existe ninguna voz en español.
 */
export function elegirVozEspañola(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const voces = window.speechSynthesis.getVoices();
  if (!voces.length) return null;

  return voces.find(v => es419(v) && esVozFemenina(v))
      || voces.find(es419)
      || voces.find(v => esMX(v) && esVozFemenina(v))
      || voces.find(esMX)
      || voces.find(esVozFemenina)
      || voces.find(v => v.lang.toLowerCase().startsWith('es'))
      || null;
}

/**
 * Aplica la mejor voz en español a una utterance.
 * Si no hay voz en español, fuerza es-419 para acento latino.
 */
export function aplicarVozEspañola(utterance: SpeechSynthesisUtterance): void {
  const voz = elegirVozEspañola();
  if (voz) {
    utterance.voice = voz;
    utterance.lang = voz.lang;
  } else {
    utterance.lang = 'es-419';
  }
}
