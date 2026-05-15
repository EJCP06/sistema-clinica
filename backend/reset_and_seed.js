const pool = require('./src/config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🔄 Iniciando Vaciado y Siembra de BD...');
    await client.query('BEGIN');

    // 1. TRUNCATE ALL TABLES
    console.log('🗑️  Vaciando tablas...');
    await client.query(`
      TRUNCATE TABLE "Historial_Atencion" CASCADE;
      TRUNCATE TABLE "Atencion" CASCADE;
      TRUNCATE TABLE "turnos" CASCADE;
      TRUNCATE TABLE "Pacientes" CASCADE;
      TRUNCATE TABLE "Usuarios" CASCADE;
      TRUNCATE TABLE "Consultorios" CASCADE;
      TRUNCATE TABLE "Servicio" CASCADE;
      TRUNCATE TABLE "Estado" CASCADE;
      TRUNCATE TABLE "Responsable_Pago" CASCADE;
    `);

    // 2. CREAR ADMINISTRADOR
    console.log('👤 Creando usuario Admin...');
    const adminHash = await bcrypt.hash('123456', 10);
    await client.query(`
      INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido)
      VALUES ('123', $1, 'admin', 'Super', 'Admin')
    `, [adminHash]);

    // 3. CREAR ESPECIALIDADES (Simulando la lógica del controlador)
    console.log('🏥 Creando Especialidades y Consultorios Auto-sincronizados...');
    
    // -- CARDIOLOGÍA --
    const resCardio = await client.query(`
      INSERT INTO "Servicio" (nombre_servicio, prefijo, piso, consultorio, status)
      VALUES ('CARDIOLOGÍA', 'CARD', '1', 'Consultorio A, Consultorio B', true)
      RETURNING id_servicio as id
    `);
    const idCardio = resCardio.rows[0].id;
    // Auto-sincronizar Consultorios para Cardiología
    const consultoriosCardio = ['Consultorio A', 'Consultorio B'];
    for (const c of consultoriosCardio) {
      await client.query(
        `INSERT INTO "Consultorios" (nombre, piso, id_servicio, estado_fisico) VALUES ($1, 1, $2, 'LIBRE')`,
        [c, idCardio]
      );
    }

    // -- PEDIATRÍA --
    const resPedia = await client.query(`
      INSERT INTO "Servicio" (nombre_servicio, prefijo, piso, consultorio, status)
      VALUES ('PEDIATRÍA', 'PED', '2', 'Consultorio C', true)
      RETURNING id_servicio as id
    `);
    const idPedia = resPedia.rows[0].id;
    // Auto-sincronizar Consultorios para Pediatría
    await client.query(
      `INSERT INTO "Consultorios" (nombre, piso, id_servicio, estado_fisico) VALUES ('Consultorio C', 2, $1, 'LIBRE')`,
      [idPedia]
    );

    // 4. CREAR MÉDICOS
    console.log('👨‍⚕️ Creando Médicos de Prueba...');
    const medicoHash = await bcrypt.hash('medico123', 10);
    
    // Obtener los IDs de los consultorios generados
    const resConsulCardio = await client.query(`SELECT id_consultorio FROM "Consultorios" WHERE nombre = 'Consultorio A'`);
    const idConsultorioA = resConsulCardio.rows[0].id_consultorio;

    const resConsulPedia = await client.query(`SELECT id_consultorio FROM "Consultorios" WHERE nombre = 'Consultorio C'`);
    const idConsultorioC = resConsulPedia.rows[0].id_consultorio;

    await client.query(`
      INSERT INTO "Usuarios" (cedula, password_hash, rol, nombre, apellido, id_servicio, piso, id_consultorio)
      VALUES 
      ('1111', $1, 'medico', 'Dr. Juan', 'Pérez', $2, 1, $3),
      ('2222', $1, 'medico', 'Dra. María', 'López', $4, 2, $5)
    `, [medicoHash, idCardio, idConsultorioA, idPedia, idConsultorioC]);

    await client.query('COMMIT');
    console.log('✅ Base de datos vaciada y poblada con éxito.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error en el proceso:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

seed();
