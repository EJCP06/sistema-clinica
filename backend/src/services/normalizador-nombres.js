/**
 * NORMALIZADOR FONÉTICO DE NOMBRES PARA TTS
 * 
 * Aplica reglas de pronunciación reales del español venezolano/caribeño
 * a nombres que NO están en el diccionario.
 * 
 * Flujo:
 *   1. Buscar en diccionario (coincidencia exacta)
 *   2. Si no está → aplicar reglas fonéticas automáticas
 *   3. Enviar resultado a Piper TTS
 * 
 * Las reglas están basadas en cómo se pronuncian REALMENTE los nombres
 * en Venezuela, no en reglas gramaticales teóricas.
 */

/**
 * Aplica reglas fonéticas a un nombre para hacerlo más legible por TTS.
 * @param {string} nombre - Nombre original (ej: "JHOAN", "Yeimerson")
 * @returns {string} Nombre normalizado para TTS (ej: "Yohan", "Ieimerson")
 */
function normalizarNombre(nombre) {
  if (!nombre || typeof nombre !== 'string') return nombre;
  
  let resultado = nombre.trim();
  
  // 1. NO eliminar tildes: Piper pronuncia mejor con acentos.
  //    'diríjase' suena correcto con tilde; sin ella suena plano.
  //    'ñ' se mantiene como ñ (Piper lo maneja como sonido nasal palatal).
  
  // 2. PRIMERO: Reglas para JH al inicio → Y (ANTES de eliminar H)
  //    Jhon → Yon, Jhonny → Yonny, Jheison → Yeison
  const empiezaConJH = /^Jh/i.test(resultado);
  resultado = resultado.replace(/^Jh/i, 'Y');
  
  // 3. SEGUNDO: H es muda (eliminar en cualquier posición, pero cuidado con CH)
  //    Hector → Ector, Hugo → Ugo, pero Chocolate se mantiene
  resultado = resultado.replace(/([^Cc])h/gi, '$1'); // H después de consonante que no sea C
  resultado = resultado.replace(/^h/i, ''); // H al inicio
  
  // 4. Reglas para Y al inicio → I (en nombres venezolanos)
  //    Yhoander → Ioander, Yaritza → Iaritza
  //    PERO: si venía de JH, NO aplicar Y→I (Jhon debe ser Yon, no Ion)
  if (!empiezaConJH) {
    resultado = resultado.replace(/^Y/i, 'I');
  }
  
  // 5. Reglas para W al inicio → U (no existe en español)
  //    William → Uilliam, Whitney → Uhitney
  resultado = resultado.replace(/^Wh/i, 'U'); // WH primero
  resultado = resultado.replace(/^W/i, 'U');  // W solo
  
  // 6. Reglas para KH al inicio → C o K
  //    Khristian → Christian
  resultado = resultado.replace(/^Kh/i, 'C');
  
  // 7. Reglas para PH → F
  //    Philip → Filib
  resultado = resultado.replace(/^Ph/i, 'F');
  
  // 8. Z → S (en Latinoamérica)
  //     Yoselandra → Yoselandra, Zulema → Sulema
  resultado = resultado.replace(/z/gi, 's');
  
  // 9. C antes de E/I → S (en Latinoamérica)
  //     Cecilia → Sesilia, Cesar → Seser
  resultado = resultado.replace(/ce/gi, 'se');
  resultado = resultado.replace(/ci/gi, 'si');
  
  // 10. QU → K (la U es muda)
  //     Quintero → Kintero, Queila → Keila
  resultado = resultado.replace(/qu/gi, 'k');
  
  // 11. GU antes de E/I → G (la U es muda)
  //     Guillermo → Gillermo, Guillermina → Guillermina
  resultado = resultado.replace(/gue/gi, 'ge');
  resultado = resultado.replace(/gui/gi, 'gi');
  
  // 12. V → B (en Latinoamérica suenan igual)
  //     Vicente → Bicente, Valencia → Balencia
  resultado = resultado.replace(/v/gi, 'b');
  
  // Mantener primera letra en mayúscula
  resultado = resultado.charAt(0).toUpperCase() + resultado.slice(1).toLowerCase();
  
  return resultado;
}

/**
 * Normaliza múltiples nombres de una vez.
 * @param {string[]} nombres - Array de nombres
 * @returns {string[]} Array de nombres normalizados
 */
function normalizarNombres(nombres) {
  return nombres.map(n => normalizarNombre(n));
}

/**
 * Normaliza un nombre completo (nombre + apellido).
 * @param {string} nombre - Nombre
 * @param {string} apellido - Apellido (opcional)
 * @returns {string} Nombre completo normalizado
 */
function normalizarNombreCompleto(nombre, apellido) {
  const nombreNorm = normalizarNombre(nombre);
  const apellidoNorm = apellido ? normalizarNombre(apellido) : '';
  return [nombreNorm, apellidoNorm].filter(Boolean).join(' ');
}

module.exports = {
  normalizarNombre,
  normalizarNombres,
  normalizarNombreCompleto
};
