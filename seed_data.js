const pool = require('./backend/src/config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('--- Iniciando limpieza de base de datos ---');
    await pool.query('TRUNCATE TABLE "Sedes", "Usuarios", "Servicio", "Consultorios", "Pacientes", "Atencion", "Historial_Atencion", "Estado", "Responsable_Pago" RESTART IDENTITY CASCADE');

    console.log('--- Insertando Sedes ---');
    await pool.query(`INSERT INTO "Sedes" (id_sede, nombre) VALUES (1, 'Santa Mónica'), (2, 'Plaza Sucre')`);

    console.log('--- Insertando Estados ---');
    await pool.query(`INSERT INTO "Estado" (nombre_estado) VALUES ('Registro'), ('Llamado'), ('En Atención'), ('Atendido'), ('Ausente')`);

    console.log('--- Insertando Responsables de Pago ---');
    await pool.query(`INSERT INTO "Responsable_Pago" (nombre) VALUES ('Particular'), ('Seguro'), ('Cortesía')`);

    console.log('--- Insertando Usuarios ---');
    const hashedPassAdmin = await bcrypt.hash('admin123', 10);
    const hashedPassRecep = await bcrypt.hash('recep123', 10);
    const hashedPassDoc = await bcrypt.hash('doc123', 10);

    // Admin Santa Mónica (Sede 1)
    await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'admin', 'ADMINISTRADOR', 'SANTA MONICA', 'admin', true, 1)`, [hashedPassAdmin]);

    // Admin Plaza Sucre (Sede 2)
    await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'admin', 'ADMINISTRADOR', 'PLAZA SUCRE', 'admin_ps', true, 2)`, [hashedPassAdmin]);

    await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'recepcionista', 'MARIA', 'RECEP SM', '20000001', true, 1)`, [hashedPassRecep]);
    
    const resDocSM = await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'medico', 'JUAN', 'MEDICO SM', '10000001', true, 1) RETURNING id_usuario`, [hashedPassDoc]);
    const idDocSM = resDocSM.rows[0].id_usuario;

    await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'recepcionista', 'PEDRO', 'RECEP PS', '20000002', true, 2)`, [hashedPassRecep]);
    
    const resDocPS = await pool.query(`INSERT INTO "Usuarios" (password_hash, rol, nombre, apellido, cedula, status, id_sede) 
      VALUES ($1, 'medico', 'CARLOS', 'MEDICO PS', '10000002', true, 2) RETURNING id_usuario`, [hashedPassDoc]);
    const idDocPS = resDocPS.rows[0].id_usuario;

    console.log('--- Insertando Servicios (Especialidades) ---');
    const resSer1 = await pool.query(`INSERT INTO "Servicio" (nombre_servicio, status, prefijo, piso, consultorio, id_sede) 
      VALUES ('MEDICINA GENERAL', true, 'MG', '1', '101', 1) RETURNING id_servicio`);
    const idSerMG_SM = resSer1.rows[0].id_servicio;

    const resSer2 = await pool.query(`INSERT INTO "Servicio" (nombre_servicio, status, prefijo, piso, consultorio, id_sede) 
      VALUES ('PEDIATRIA', true, 'PED', '2', '201', 2) RETURNING id_servicio`);
    const idSerPED_PS = resSer2.rows[0].id_servicio;

    console.log('--- Insertando Consultorios ---');
    await pool.query(`INSERT INTO "Consultorios" (nombre, id_servicio, id_sede, estado_fisico, piso) VALUES ('CONSULTORIO 101', $1, 1, 'LIBRE', '1')`, [idSerMG_SM]);
    await pool.query(`INSERT INTO "Consultorios" (nombre, id_servicio, id_sede, estado_fisico, piso) VALUES ('CONSULTORIO 201', $1, 2, 'LIBRE', '2')`, [idSerPED_PS]);

    await pool.query(`UPDATE "Usuarios" SET id_servicio = $1 WHERE id_usuario = $2`, [idSerMG_SM, idDocSM]);
    await pool.query(`UPDATE "Usuarios" SET id_servicio = $1 WHERE id_usuario = $2`, [idSerPED_PS, idDocPS]);

    console.log('--- Insertando Datos de Prueba para el Dashboard ---');
    
    // Sede Santa Mónica (ID 1)
    // Los datos legacy de la tabla turnos fueron removidos.
    // La nueva semilla debe usar Atencion + Historial_Atencion si se quiere precargar casos de ejemplo.

    console.log('--- SEED COMPLETADO EXITOSAMENTE ---');
    console.log('Credenciales sugeridas:');
    console.log('Admin: admin / admin123');
    console.log('--- Sede Santa Mónica ---');
    console.log('Doctor SM: 10000001 / doc123');
    console.log('Recep SM: 20000001 / recep123');
    console.log('--- Sede Plaza Sucre ---');
    console.log('Doctor PS: 10000002 / doc123');
    console.log('Recep PS: 20000002 / recep123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error durante el seed:', err);
    process.exit(1);
  }
}

seed();
