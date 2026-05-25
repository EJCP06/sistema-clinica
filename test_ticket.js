const { Pool } = require('pg');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || `postgresql://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`
});

async function runTest() {
  try {
    console.log('--- INICIANDO PRUEBA TÉCNICA ---');
    
    // 1. Buscar IDs necesarios
    const servRes = await pool.query("SELECT id_servicio FROM \"Servicio\" WHERE UPPER(nombre_servicio) = 'CONSULTA' LIMIT 1");
    const idServicio = servRes.rows[0]?.id_servicio;
    
    const espRes = await pool.query("SELECT id_especialidad FROM \"Especialidades\" WHERE UPPER(nombre) = 'CARDIOLOGÍA' OR UPPER(nombre) = 'CARDIOLOGIA' LIMIT 1");
    const idEspecialidad = espRes.rows[0]?.id_especialidad;
    
    console.log(`IDs encontrados: Servicio=${idServicio}, Especialidad=${idEspecialidad}`);

    if (!idServicio || !idEspecialidad) {
      console.error('Error: No se encontró el servicio de CONSULTA o la especialidad de CARDIOLOGÍA.');
      return;
    }

    // 2. Buscar o crear paciente Mónica
    let pacRes = await pool.query("SELECT id_paciente FROM \"Pacientes\" WHERE UPPER(nombre) = 'MONICA' LIMIT 1");
    let idPaciente;
    
    if (pacRes.rows.length === 0) {
      const insPac = await pool.query(
        "INSERT INTO \"Pacientes\" (cedula, nombre, apellido, id_sede) VALUES ('99999999', 'MONICA', 'TEST', 1) RETURNING id_paciente"
      );
      idPaciente = insPac.rows[0].id_paciente;
      console.log('Paciente Mónica creado con ID:', idPaciente);
    } else {
      idPaciente = pacRes.rows[0].id_paciente;
      console.log('Paciente Mónica encontrado con ID:', idPaciente);
    }

    // 3. Simular creación de ticket (registrarYContinuar -> generarTurno)
    const numero = `C-999`;
    const insAtencion = await pool.query(
      "INSERT INTO \"Atencion\" (id_paciente, id_servicio, id_especialidad, id_responsable, id_estado_actual, id_sede, numero) VALUES ($1, $2, $3, 1, 1, 1, $4) RETURNING id_atencion",
      [idPaciente, idServicio, idEspecialidad, numero]
    );
    const idAtencion = insAtencion.rows[0].id_atencion;
    console.log('Ticket creado con ID:', idAtencion);

    // DEBUG: Ver estados disponibles
    const estados = await pool.query('SELECT * FROM "Estado"');
    console.log('Estados en DB:', estados.rows);

    // DEBUG: Ver ticket creado
    const ticketCreated = await pool.query('SELECT * FROM "Atencion" WHERE id_atencion = $1', [idAtencion]);
    console.log('Ticket en DB:', ticketCreated.rows[0]);

    // 4. Simular consulta del médico (getPacientesEnEspera)
    // Query que usa el controlador ahora:
    const queryMedico = `
      SELECT 
        a.id_atencion, 
        p.nombre, 
        e.nombre_estado, 
        esp.nombre as nombre_especialidad
      FROM "Atencion" a
      INNER JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      INNER JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Especialidades" esp ON a.id_especialidad = esp.id_especialidad
      WHERE a.id_sede = 1 AND a.hora_salida IS NULL
      AND a.id_especialidad = $1
      AND UPPER(e.nombre_estado) IN ('SALA DE ESPERA', 'LLAMADO', 'EN ATENCIÓN', 'EN ATENCION', 'REGISTRADO')
    `;
    
    const medicoRes = await pool.query(queryMedico, [idEspecialidad]);
    
    console.log('\n--- RESULTADOS EN EL PANEL DEL MÉDICO ---');
    if (medicoRes.rows.length > 0) {
      console.log(`ÉXITO: Se encontraron ${medicoRes.rows.length} pacientes.`);
      medicoRes.rows.forEach(r => {
        console.log(`- Paciente: ${r.nombre}, Estado: ${r.nombre_estado}, Especialidad: ${r.nombre_especialidad}`);
      });
      
      const monica = medicoRes.rows.find(r => r.nombre.toUpperCase() === 'MONICA');
      if (monica) {
        console.log('\nVERIFICACIÓN FINAL: Mónica aparece correctamente en la lista de Cardiología.');
      } else {
        console.log('\nVERIFICACIÓN FALLIDA: Mónica no está en los resultados.');
      }
    } else {
      console.log('ERROR: El panel del médico no devolvió resultados.');
    }

    // Limpieza (opcional, para no llenar de basura, pero lo dejamos por ahora)
    // await pool.query("DELETE FROM \"Atencion\" WHERE id_atencion = $1", [idAtencion]);

  } catch (err) {
    console.error('Error durante la prueba:', err);
  } finally {
    await pool.end();
  }
}

runTest();
