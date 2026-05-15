const pool = require('./backend/src/config/db');
const bcrypt = require('bcryptjs');

async function seed() {
  try {
    console.log('--- Iniciando limpieza de base de datos ---');
    await pool.query('TRUNCATE TABLE "Sedes", "Usuarios", "Servicio", "Consultorios", "Pacientes", turnos, "Atencion", "Historial_Atencion", "Estado", "Responsable_Pago" RESTART IDENTITY CASCADE');

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
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada, hora_inicio, hora_fin) 
      VALUES ('ANA GARCIA', '12345678', '04121111111', $1, 1, 'ATENDIDO', 'MG-001', NOW() - interval '2 hours', NOW() - interval '1 hour', NOW() - interval '30 minutes')`, [idSerMG_SM]);
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada, hora_fin) 
      VALUES ('LUIS LOPEZ', '87654321', '04142222222', $1, 1, 'AUSENTE', 'MG-002', NOW() - interval '1.5 hours', NOW() - interval '1 hour')`, [idSerMG_SM]);
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada) 
      VALUES ('JOSE PEREZ', '11223344', '04163333333', $1, 1, 'EN_ESPERA', 'MG-003', NOW() - interval '15 minutes')`, [idSerMG_SM]);
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada) 
      VALUES ('ELENA MARTINEZ', '55667788', '04244444444', $1, 1, 'EN_ESPERA', 'MG-004', NOW() - interval '5 minutes')`, [idSerMG_SM]);

    // Sede Plaza Sucre (ID 2)
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada, hora_inicio, hora_fin) 
      VALUES ('PEDRITO PEREZ', '99887766', '04120000000', $1, 2, 'ATENDIDO', 'PED-001', NOW() - interval '1 hour', NOW() - interval '45 minutes', NOW() - interval '20 minutes')`, [idSerPED_PS]);
    await pool.query(`INSERT INTO turnos (nombre_paciente, documento_paciente, telefono_paciente, servicio_id, id_sede, estado, numero, hora_llegada) 
      VALUES ('MARIA SOSA', '77665544', '04140000000', $1, 2, 'EN_ESPERA', 'PED-002', NOW() - interval '10 minutes')`, [idSerPED_PS]);

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
