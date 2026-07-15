const ACCIONES_ESPECIALES_POR_VISTA = {
  admision: ['asignar_turno'],
  aps: ['enviar_presupuesto', 'solicitar_clave', 'enviar_sala_espera', 'aprobar_clave', 'reincorporar'],
  laboratorio: ['registrar_caja', 'pasar_sala_espera', 'marcar_ausente', 'reincorporar'],
  imagenes: ['registrar_caja', 'pasar_sala_espera', 'marcar_ausente', 'reincorporar'],
  atencion_medica: ['llamar_siguiente', 'liberar_consultorio', 'iniciar', 'marcar_ausente', 'finalizar'],
  aseguradoras: ['importar_excel'],
  personal: [],
  roles: [],
  especialidades: [],
  permisologia: [],
};

const ACCIONES_ESPECIALES_GLOBALES = ['marcar_ausente', 'reincorporar'];

/**
 * Obtiene la lista completa de acciones especiales disponibles para un recurso,
 * combinando las acciones específicas de la vista con las acciones globales.
 *
 * @param {string} recursoKey - Identificador del recurso/vista (ej. 'admision', 'laboratorio')
 * @returns {string[]} Lista deduplicada de acciones especiales aplicables
 */
function getTodasLasAccionesEspeciales(recursoKey) {
  const especificas = ACCIONES_ESPECIALES_POR_VISTA[recursoKey] || [];
  return [...new Set([...especificas, ...ACCIONES_ESPECIALES_GLOBALES])];
}

module.exports = {
  ACCIONES_ESPECIALES_POR_VISTA,
  ACCIONES_ESPECIALES_GLOBALES,
  getTodasLasAccionesEspeciales,
};
