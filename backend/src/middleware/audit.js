const pool = require('../config/db');

const auditar = async ({ userId, accion, recurso, recursoId, detalle, ip }) => {
  try {
    await pool.query(
      `INSERT INTO "Audit_Log" (id_usuario, accion, recurso, id_recurso_afectado, detalle, ip)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, accion, recurso, recursoId, detalle ? JSON.stringify(detalle) : null, ip],
    );
  } catch (err) {
    // nunca romper el flujo principal por un error de auditoría
  }
};

module.exports = { auditar };