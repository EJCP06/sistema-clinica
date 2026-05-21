const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'clinica_colas',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  try {
    const sedesRes = await pool.query('SELECT id_sede FROM "Sedes"');
    for (const sede of sedesRes.rows) {
      console.log(`Verificando sede ${sede.id_sede}`);
      
      const checkLab = await pool.query('SELECT 1 FROM "Servicio" WHERE nombre_servicio = \'LABORATORIO\' AND id_sede = $1', [sede.id_sede]);
      if (checkLab.rowCount === 0) {
        await pool.query('INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede, status, piso) VALUES ($1, $2, $3, $4, $5)', ['LABORATORIO', 'LAB', sede.id_sede, true, '1']);
      }

      const checkImg = await pool.query('SELECT 1 FROM "Servicio" WHERE nombre_servicio = \'IMÁGENES\' AND id_sede = $1', [sede.id_sede]);
      if (checkImg.rowCount === 0) {
        await pool.query('INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede, status, piso) VALUES ($1, $2, $3, $4, $5)', ['IMÁGENES', 'IMG', sede.id_sede, true, '1']);
      }
    }
    console.log('Sincronización completada');
  } catch (e) {
    console.error(e);
  } finally {
    await pool.end();
  }
}
run();
