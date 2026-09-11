/**
 * Utilidades PURAS del turnero: formato del destino (consultorio + piso) y
 * matemática de tiempos de la grilla de anuncios por voz.
 *
 * No tienen estado, no dependen de Angular y no producen efectos secundarios,
 * así que se pueden probar y reutilizar de forma aislada. La parte con estado
 * (cola de voz, audio, sockets, countdowns) sigue viviendo en el componente.
 */

/** Ciclo con el que se repiten los anuncios del turnero (10 s). */
export const CICLO_VOZ_MS = 10000;

/** Datos mínimos de un turno necesarios para resolver su destino. */
export interface TurnoDestino {
  consultorio_nombre?: string | null;
  nombre_servicio?: string | null;
  especialidad_piso?: string | null;
  consultorio_piso?: string | null;
}

/** Anuncio con la información temporal usada para programar su locución. */
export interface AnuncioProgramable {
  inicioMs: number | null;
  baseLocal: number;
}

/**
 * Muestra el consultorio con el piso antepuesto en la pantalla (ej.
 * consultorio "01" en piso "1" => "101", o en mezanina con piso "M" =>
 * "M01", conservando el cero). El piso se toma de la ESPECIALIDAD del
 * turno (configurado en Especialidades) y se respalda con el del
 * consultorio físico. Puede ser numérico o una letra (M = mezanina),
 * siempre en mayúscula. Si no hay piso o el nombre no es numérico,
 * conserva el formato actual. Usado en las tarjetas de pacientes llamados.
 */
export function consultorioConPiso(t: TurnoDestino): string {
  const nombre = (t.consultorio_nombre || '').trim();
  if (!nombre) {
    // Para pacientes de laboratorio/imágenes no hay consultorio físico:
    // mostrar el nombre del servicio (ej. "Laboratorio", "Imágenes").
    const svc = (t.nombre_servicio || '').trim();
    return svc || 'Consultorio';
  }
  const piso = (t.especialidad_piso || t.consultorio_piso || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const digitos = nombre.match(/\d+/);
  if (piso && digitos) {
    // Se conserva el número original del consultorio (con su cero):
    // "M" + "01" => "M01".
    return nombre.replace(digitos[0], `${piso}${digitos[0]}`);
  }
  return nombre.replace(/\b0+(\d+)\b/g, '$1');
}

/**
 * Igual que `consultorioConPiso`, pero para el TEXTO que se dice por voz:
 * consultorio "05" en piso "1" => "101", o en mezanina con piso "M" => "M5",
 * sin el cero (se lee "eme cinco" y no "eme cero cinco"). Cuando el piso es
 * numérico se conserva el cero para que "1" + "01" siga siendo "101". El piso
 * puede ser numérico o una letra (M = mezanina), siempre en mayúscula. Si no
 * hay piso o el nombre no es numérico, conserva el formato actual.
 */
export function formatearConsultorioConPiso(consultorio: string, piso?: string | null): string {
  const nombre = (consultorio || '').trim();
  const pisoLimpio = (piso || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  const digitos = nombre.match(/\d+/);
  if (pisoLimpio && digitos) {
    // Con piso de letra (M = mezanina) se quita el cero: "M" + "05" => "M5".
    const numero = /^\d+$/.test(pisoLimpio) ? digitos[0] : digitos[0].replace(/^0+/, '');
    return nombre.replace(digitos[0], `${pisoLimpio}${numero}`);
  }
  return nombre.replace(/\b0+(\d+)\b/g, '$1');
}

/** ¿El "consultorio" es en realidad la recepción de APS? */
export function esAnuncioAPS(consultorio: string): boolean {
  return consultorio.trim().toLowerCase() === 'aps';
}

/**
 * Calcula el destino legible para el modal visual.
 * Misma lógica que `construirTexto()` pero solo la parte del destino.
 */
export function calcularDestinoVisual(consultorio: string, piso?: string | null): string {
  const destinoConsultorio = formatearConsultorioConPiso(consultorio, piso);
  const c = consultorio.toLowerCase();

  if (c.includes('laboratorio')) {
    return 'RECEPCIÓN DE LABORATORIO';
  } else if (c.includes('imagen') || c.includes('imagenes')) {
    return 'RECEPCIÓN DE IMÁGENES';
  } else if (c.includes('consulta')) {
    return 'CONSULTA';
  } else if (c.startsWith('consultorio')) {
    return `CONSULTORIO ${destinoConsultorio}`;
  } else if (esAnuncioAPS(consultorio)) {
    return 'RECEPCIÓN DE APS';
  }
  // Si hay piso, mostrar consultorio con piso antepuesto (ej. "02" en piso "1" => "102").
  return destinoConsultorio.toUpperCase() || (consultorio || 'DESTINO').toUpperCase();
}

/**
 * Calcula el retardo hasta la siguiente marca de 10 s de la grilla del
 * llamado. El ciclo sigue indefinidamente cada 10 s: se detiene únicamente
 * cuando el paciente entra en atención (o se marca ausente/libera el
 * consultorio), que dispara `detenerRepeticion()` en el turnero.
 */
export function retardoHastaSiguienteMarca(a: AnuncioProgramable, minMs: number): number | null {
  if (!a.inicioMs || !Number.isFinite(a.inicioMs)) {
    return Math.max(minMs, CICLO_VOZ_MS);
  }
  const baseLocal = a.baseLocal;
  const ahora = Date.now();
  const desfase = ahora - baseLocal;
  if (desfase < 0) return Math.max(minMs, 500);
  const periodos = Math.max(1, Math.floor(desfase / CICLO_VOZ_MS) + 1);
  const siguienteBorde = baseLocal + periodos * CICLO_VOZ_MS;
  return Math.max(minMs, siguienteBorde - ahora);
}

/**
 * Retardo hasta el instante objetivo del anuncio (`inicio_ms` en hora local).
 * Se usa para los llamados que deben sonar de INMEDIATO: los botones de módulo
 * (APS/Lab/Imágenes) y el primer tick del médico ("Llamar al Siguiente") emiten
 * `inicio_ms` en el mismo instante del clic, así que cuando el evento llega el
 * objetivo ya está en el pasado y el retardo queda en `minMs` (la voz sale YA),
 * en vez de esperar la siguiente marca de 10 s de la grilla de consultorios.
 */
export function retardoHastaInicioAnuncio(a: AnuncioProgramable, minMs: number): number | null {
  if (!a.inicioMs || !Number.isFinite(a.inicioMs)) {
    return Math.max(minMs, 500);
  }
  const baseLocal = a.baseLocal;
  const ahora = Date.now();
  const desfase = ahora - baseLocal;
  if (desfase < 0) return Math.max(minMs, baseLocal - ahora);
  return Math.max(minMs, 0);
}
