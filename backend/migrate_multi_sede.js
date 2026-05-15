const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('1. Creando tabla Sedes...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS "Sedes" (
        "id_sede" SERIAL PRIMARY KEY,
        "nombre" VARCHAR NOT NULL
      )
    `);

    const sedesRes = await client.query('SELECT count(*) FROM "Sedes"');
    if (parseInt(sedesRes.rows[0].count) === 0) {
      await client.query(`INSERT INTO "Sedes" (nombre) VALUES ('Santa Mónica'), ('Plaza Sucre')`);
      console.log('   Sedes insertadas.');
    }

    const tablesToMigrate = [
      { name: 'Servicio', id_col: 'id_servicio' },
      { name: 'Consultorios', id_col: 'id_consultorio' },
      { name: 'Usuarios', id_col: 'id_usuario' },
      { name: 'Pacientes', id_col: 'id_paciente' },
      { name: 'Atencion', id_col: 'id_atencion' },
      { name: 'turnos', id_col: 'id' }
    ];

    for (const table of tablesToMigrate) {
      console.log(`2. Procesando tabla ${table.name}...`);
      
      // Añadir columna si no existe
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = '${table.name}' AND column_name = 'id_sede') THEN
            ALTER TABLE "${table.name}" ADD COLUMN id_sede INTEGER REFERENCES "Sedes"("id_sede");
          END IF;
        END $$;
      `);

      // Asignar sede 1 a los que no tengan
      await client.query(`UPDATE "${table.name}" SET id_sede = 1 WHERE id_sede IS NULL`);
      
      // Hacerla NOT NULL después de asignar valores
      await client.query(`ALTER TABLE "${table.name}" ALTER COLUMN id_sede SET NOT NULL`);
      
      console.log(`   Tabla ${table.name} actualizada.`);
    }

    await client.query('COMMIT');
    console.log('MIGRACIÓN EXITOSA');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('ERROR EN MIGRACIÓN:', e);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
