const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'clinica_colas',
  port: process.env.DB_PORT || 5432,
});

async function run() {
  const client = await pool.connect();
  try {
    console.log('--- Iniciando Reset de Base de Datos ---');
    await client.query('BEGIN');

    // 1. Limpieza total
    console.log('Limpiando tablas...');
    await client.query(`
      TRUNCATE TABLE 
        "Historial_Atencion", "Atencion", "Pacientes", "Usuarios", 
        "Consultorios", "Servicio", "Sedes", "cliente", "tipo_cliente", 
        "Responsable_Pago", "Estado", "configuraciones" 
      RESTART IDENTITY CASCADE
    `);

    // 2. Sedes
    console.log('Insertando Sedes...');
    await client.query(`
      INSERT INTO "Sedes" (id_sede, nombre) VALUES
      (1, 'SANTA MÓNICA'),
      (2, 'PLAZA SUCRE')
    `);

    // 3. Estados fundamentales
    console.log('Insertando Estados...');
    await client.query(`
      INSERT INTO "Estado" (id_estado, nombre_estado) VALUES
      (1, 'Registro'),
      (2, 'Sala de Espera'),
      (3, 'Llamado'),
      (4, 'En Atención'),
      (5, 'Atendido'),
      (6, 'Cancelado')
    `);

    // 4. Responsables de Pago
    console.log('Insertando Responsables de Pago...');
    await client.query(`
      INSERT INTO "Responsable_Pago" (id_responsable, nombre) VALUES
      (1, 'PARTICULAR'),
      (2, 'ASEGURADORA')
    `);

    // 5. Servicios básicos (necesarios para los médicos)
    console.log('Insertando Servicios...');
    await client.query(`
      INSERT INTO "Servicio" (id_servicio, id_sede, nombre_servicio, prefijo, piso) VALUES
      (1, 1, 'MEDICINA GENERAL', 'MED', '1'),
      (2, 2, 'PEDIATRÍA', 'PED', '1')
    `);

    // 6. Tipos de Cliente (Estructura de aseguradoras)
    await client.query(`
      INSERT INTO "tipo_cliente" (id_tipo_cliente, nombre) VALUES (1, 'Particular'), (2, 'Aseguradora')
    `);

    // Aseguradoras de Prueba
    await client.query(`
      INSERT INTO "cliente" (id_tipo_cliente, nombre, id_sede) VALUES 
      (2, 'SEGUROS CARACAS (SM)', 1),
      (2, 'ASEGURADORA FEDERAL (SM)', 1),
      (2, 'SEGUROS MERCANTIL (PS)', 2),
      (2, 'VIDA PLUS (PS)', 2)
    `);

    // 7. Usuarios solicitados
    console.log('Insertando Usuarios de Prueba...');
    const hAdmin = await bcrypt.hash('admin123', 10);
    const hRecep = await bcrypt.hash('recep123', 10);
    const hDoc = await bcrypt.hash('doc123', 10);

    // Asegurar que la columna username existe antes de insertar si queremos usarla
    await client.query('ALTER TABLE "Usuarios" ADD COLUMN IF NOT EXISTS username varchar');

    const usuarios = [
      // Sede 1: Santa Mónica
      [1, 'admin', 'admin', hAdmin, 'admin', 'ADMIN', 'SANTA MONICA', null],
      [1, '20000001', '20000001', hRecep, 'recepcionista', 'RECEPCIONISTA', 'SANTA MONICA', null],
      [1, '10000001', '10000001', hDoc, 'medico', 'DR. JUAN', 'PEREZ', 1],
      [1, '30000001', '30000001', hDoc, 'aps', 'CAJA', 'APS SANTA MONICA', null],
      
      // Sede 2: Plaza Sucre
      [2, 'admin_ps', 'admin_ps', hAdmin, 'admin', 'ADMIN', 'PLAZA SUCRE', null],
      [2, '20000002', '20000002', hRecep, 'recepcionista', 'RECEPCIONISTA', 'PLAZA SUCRE', null],
      [2, '10000002', '10000002', hDoc, 'medico', 'DR. PEDRO', 'GOMEZ', 2]
    ];

    for (const u of usuarios) {
      await client.query(
        `INSERT INTO "Usuarios" (id_sede, cedula, username, password_hash, rol, nombre, apellido, id_servicio, status) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)`,
        u
      );
    }

    await client.query('COMMIT');
    console.log('--- Base de Datos Reseteda Correctamente ---');
    console.log('Usuarios creados con éxito según lista solicitada.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error durante el reset:', error);
  } finally {
    client.release();
    process.exit();
  }
}

run();
