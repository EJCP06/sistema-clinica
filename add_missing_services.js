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
    const sedes = sedesRes.rows;

    for (const sede of sedes) {
      console.log(`Configurando servicios para sede ID: ${sede.id_sede}`);
      
      // LABORATORIO
      await pool.query(`
        INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede, status, piso)
        SELECT 'LABORATORIO', 'LAB', $1, true, '1'
        WHERE NOT EXISTS (
          SELECT 1 FROM "Servicio" WHERE nombre_servicio = 'LABORATORIO' AND id_sede = $1
        )
      `, [sede.id_sede]);

      // IMÁGENES
      await pool.query(`
        INSERT INTO "Servicio" (nombre_servicio, prefijo, id_sede, status, piso)
        SELECT 'IMÁGENES', 'IMG', $1, true, '1'
        WHERE NOT EXISTS (
          SELECT 1 FROM "Servicio" WHERE nombre_servicio = 'IMÁGENES' AND id_sede = $1
        )
      `, [sede.id_sede]);
    }
    console.log('Servicios de Laboratorio e Imágenes creados exitosamente en todas las sedes.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await pool.end();
  }
}
run();
