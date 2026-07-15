const pool = require('../config/db');

/**
 * Registra un evento de auditoría en la base de datos. Los errores de
 * escritura se silencian para no interrumpir el flujo de la petición.
 *
 * @param {object} params - Datos del evento
 * @param {number} params.userId - ID del usuario que realizó la acción
 * @param {string} params.accion - Tipo de acción ejecutada
 * @param {string} params.recurso - Nombre del recurso afectado
 * @param {string|number} [params.recursoId] - Identificador del registro afectado
 * @param {object} [params.detalle] - Información adicional serializable
 * @param {string} [params.ip] - Dirección IP del solicitante
 * @returns {Promise<void>}
 */
const auditar = async ({ userId, accion, recurso, recursoId, detalle, ip }) => {
  try {
    await pool.query(
      `INSERT INTO "Audit_Log" (id_usuario, accion, recurso, id_recurso_afectado, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, accion, recurso, recursoId, detalle ? JSON.stringify(detalle) : null, ip],
    );
  } catch (err) {
    /* Silenciar errores de auditoría para no interrumpir el flujo principal */
  }
};

module.exports = { auditar };
