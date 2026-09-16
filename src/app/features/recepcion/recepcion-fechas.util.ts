/**
 * Utilidades PURAS de fecha y texto del módulo de recepción.
 *
 * Incluye la máscara de fecha (dd/mm/aaaa) que se aplica mientras el usuario
 * escribe: el valor se modela como "slots" para poder borrar e insertar
 * dígitos en cualquier posición sin que el cursor salte.
 *
 * Sin estado ni dependencias de Angular, así que se pueden probar aisladas.
 */

/** Posición en el texto de cada slot de dígito dentro de "dd/mm/aaaa". */
const POSICIONES_SLOT = [0, 1, 3, 4, 6, 7, 8, 9];

/** Normaliza texto para comparar sin acentos ni mayúsculas. */
export function normalizeString(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Convierte una fecha del backend (aaaa-mm-dd) al formato visible dd/mm/aaaa. */
export function fechaADisplay(fecha: string): string {
  if (!fecha || fecha.length < 10) return fecha || '';
  const partes = fecha.substring(0, 10).split('-');
  if (partes.length !== 3) return fecha;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

/** Convierte la fecha visible dd/mm/aaaa al formato del backend (aaaa-mm-dd). */
export function fechaABackend(fecha: string): string | null {
  if (!fecha || !/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) return null;
  const partes = fecha.split('/');
  return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

/** Días máximos por mes en años no bisiestos (índice 0 sin uso). */
const DIAS_POR_MES = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

/**
 * Valida que una fecha dd/mm/aaaa corresponda a un día real del calendario.
 * Devuelve null si es válida, o una cadena con el motivo del error.
 */
export function validarFechaNacimiento(fecha: string): string | null {
  if (!fecha) return null;
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(fecha)) {
    return 'La fecha de nacimiento debe tener el formato DD/MM/AAAA (ej: 15/03/1990)';
  }
  const [dd, mm, yyyy] = fecha.split('/').map(Number);
  if (mm < 1 || mm > 12) {
    return `El mes "${String(mm).padStart(2, '0')}" no existe: debe ser entre 01 y 12`;
  }
  const anioActual = new Date().getFullYear();
  if (yyyy < 1900 || yyyy > anioActual) {
    return `El año "${yyyy}" no es válido: debe estar entre 1900 y ${anioActual}`;
  }
  const maxDias = mm === 2 && esBisiesto(yyyy) ? 29 : DIAS_POR_MES[mm];
  if (dd < 1 || dd > maxDias) {
    const nombreMes = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'][mm];
    return `El mes ${nombreMes} no tiene ${dd} días: el día debe ser entre 01 y ${String(maxDias).padStart(2, '0')}`;
  }
  return null;
}

/** Extrae los 8 dígitos del display como slots (los vacíos quedan en ' '). */
export function obtenerSlots(display: string): string[] {
  if (!display) return Array(8).fill(' ');
  return POSICIONES_SLOT.map(i => display[i] ?? ' ');
}

/** Reconstruye el display dd/mm/aaaa a partir de sus slots. */
export function reconstruir(slots: string[]): string {
  return slots[0] + slots[1] + '/' + slots[2] + slots[3] + '/' + slots[4] + slots[5] + slots[6] + slots[7];
}

/** Posición en el texto del slot indicado (10 si está fuera de rango). */
export function posicionDeSlot(slotIndex: number): number {
  return POSICIONES_SLOT[slotIndex] ?? 10;
}

/** Índice de dígito (ignorando los vacíos) que corresponde al slot indicado. */
export function runIndex(slotIndex: number, viejo: string[]): number {
  let count = 0;
  for (let i = 0; i < slotIndex; i++) {
    if (/\d/.test(viejo[i])) count++;
  }
  return count;
}

/**
 * Aplica un cambio de texto sobre la máscara dd/mm/aaaa conservando la
 * posición del cursor, de modo que se pueda borrar e insertar dígitos en
 * medio del valor sin que el cursor salte de posición.
 */
export function aplicarCambioFecha(
  displayAnterior: string,
  nuevoValor: string,
  cursorPos: number,
): { valor: string; cursor: number } {
  const viejo = obtenerSlots(displayAnterior);
  const nuevoDigitos = nuevoValor.replace(/\D/g, '').substring(0, 8);
  const viejoDigitos = viejo.filter(ch => /\d/.test(ch)).join('');

  if (nuevoDigitos.length === 0) {
    return { valor: '', cursor: 0 };
  }

  if (nuevoDigitos.length < viejoDigitos.length) {
    const cuantos = viejoDigitos.length - nuevoDigitos.length;
    const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
    const slots = viejo.slice();
    for (let i = cursorDigitos; i < cursorDigitos + cuantos && i < 8; i++) slots[i] = ' ';
    return { valor: reconstruir(slots), cursor: posicionDeSlot(cursorDigitos) };
  }

  if (nuevoDigitos.length === viejoDigitos.length) {
    const slots = viejo.map((ch, i) => (/\d/.test(ch) ? nuevoDigitos[runIndex(i, viejo)] : ch));
    return { valor: reconstruir(slots), cursor: Math.min(cursorPos, 10) };
  }

  const added = nuevoDigitos.length - viejoDigitos.length;
  const cursorDigitos = nuevoValor.substring(0, cursorPos).replace(/\D/g, '').length;
  const insertSlot = Math.max(0, cursorDigitos - added);
  const slots = viejo.slice();
  let pos = insertSlot;
  let ultimoRellenado = -1;
  for (let k = insertSlot; k < insertSlot + added && k < 8; k++) {
    while (pos < 8 && /\d/.test(slots[pos])) pos++;
    if (pos >= 8) break;
    slots[pos] = nuevoDigitos[k];
    ultimoRellenado = pos;
    pos++;
  }
  const cursor = ultimoRellenado >= 0 ? posicionDeSlot(ultimoRellenado) + 1 : posicionDeSlot(insertSlot);
  return { valor: reconstruir(slots), cursor };
}
