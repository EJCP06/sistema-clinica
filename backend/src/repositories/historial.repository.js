/**
 * Repositorio del historial de estados de atención (tabla "Historial_Atencion").
 *
 * Registra cada cambio de estado por el que pasa una atención (registrado,
 * en sala, llamada, en consulta, finalizada...). Esto permite reconstruir la
 * trazabilidad completa de un paciente. insert() se usa dentro de transacciones
 * (recibe client); insertSinTransaccion() usa el pool directo.
 */
const pool = require('../config/db');

const insert = async (client, idAtencion, idEstado) => {
  await client.query(
    'INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)',
    [idAtencion, idEstado],
  );
};

const insertSinTransaccion = async (idAtencion, idEstado) => {
  await pool.query(
    'INSERT INTO "Historial_Atencion" (id_atencion, id_estado) VALUES ($1, $2)',
    [idAtencion, idEstado],
  );
};

const deleteByAtencion = async (client, idAtencion) => {
  await client.query('DELETE FROM "Historial_Atencion" WHERE id_atencion = $1', [idAtencion]);
};

/**
 * Elimina todo el historial de un paciente (borrado en cascada manual, ya que
 * la tabla no define FK a "Atencion"). Usado al eliminar un paciente.
 */
const deleteByPaciente = async (client, idPaciente, sede) => {
  await client.query(
    `DELETE FROM "Historial_Atencion"
     WHERE id_atencion IN (
       SELECT id_atencion FROM "Atencion" WHERE id_paciente = $1 AND id_sede = $2
     )`,
    [idPaciente, sede],
  );
};

module.exports = {
  insert,
  insertSinTransaccion,
  deleteByAtencion,
  deleteByPaciente,
};
