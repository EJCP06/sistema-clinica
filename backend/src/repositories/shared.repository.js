const pool = require('../config/db');

const getResponsablesPago = async () => {
  const result = await pool.query(
    'SELECT id_responsable, nombre, status FROM "Responsable_Pago" WHERE status = true ORDER BY id_responsable',
  );
  return result.rows;
};

const getAseguradoras = async (sede) => {
  const result = await pool.query(
    `SELECT id_cliente, nombre as aseguradora, id_sede
     FROM "cliente"
     WHERE id_tipo_cliente = 2 AND id_sede = $1
     ORDER BY nombre`,
    [sede],
  );
  return result.rows;
};

const crearAseguradora = async (nombre, sede) => {
  const result = await pool.query(
    `INSERT INTO "cliente" (id_tipo_cliente, nombre, id_sede) VALUES (2, $1, $2) RETURNING id_cliente`,
    [nombre, sede],
  );
  return result.rows[0];
};

const eliminarAseguradora = async (id, sede) => {
  const result = await pool.query(
    'DELETE FROM "cliente" WHERE id_cliente = $1 AND id_sede = $2 RETURNING id_cliente',
    [id, sede],
  );
  return result.rowCount > 0;
};

const importarAseguradoras = async (nombres, sede) => {
  const existentes = await pool.query(
    `SELECT nombre FROM "cliente" WHERE id_tipo_cliente = 2 AND id_sede = $1 AND nombre = ANY($2)`,
    [sede, nombres],
  );
  const nombresExistentes = new Set(existentes.rows.map((r) => r.nombre));

  let importados = 0;
  let omitidos = 0;

  for (const nombre of nombres) {
    if (nombresExistentes.has(nombre)) {
      omitidos++;
      continue;
    }
    await pool.query(
      `INSERT INTO "cliente" (id_tipo_cliente, nombre, id_sede) VALUES (2, $1, $2)`,
      [nombre, sede],
    );
    importados++;
  }

  return { importados, omitidos };
};

const getSedes = async () => {
  const result = await pool.query(`SELECT id_sede, nombre FROM "Sedes" ORDER BY id_sede`);
  return result.rows;
};

const getSedeById = async (id) => {
  const result = await pool.query(`SELECT id_sede, nombre FROM "Sedes" WHERE id_sede = $1`, [id]);
  return result.rows[0] || null;
};

module.exports = {
  getResponsablesPago,
  getAseguradoras,
  crearAseguradora,
  eliminarAseguradora,
  importarAseguradoras,
  getSedes,
  getSedeById,
};
