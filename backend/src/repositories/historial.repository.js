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

module.exports = {
  insert,
  insertSinTransaccion,
};
