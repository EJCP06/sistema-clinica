const pool = require('../src/config/db');

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

async function resetDB() {
  console.log('=== [TEST] Resetting Database ===');
  // Truncate and reload seed data
  await pool.query('TRUNCATE TABLE "Historial_Atencion" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Atencion" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Pacientes" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Usuarios" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Consultorios" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Servicio" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Responsable_Pago" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Estado" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "Sedes" RESTART IDENTITY CASCADE;');
  await pool.query('TRUNCATE TABLE "configuraciones" CASCADE;');

  // Load Seed
  await pool.query("INSERT INTO \"Sedes\" (id_sede, nombre) VALUES (1, 'Santa Mónica'), (2, 'Plaza Sucre');");
  await pool.query(`INSERT INTO "Estado" (nombre_estado) VALUES 
    ('Registro'),       -- id 1
    ('Sala de Espera'), -- id 2
    ('Llamado'),        -- id 3
    ('En Atención'),    -- id 4
    ('Atendido'),       -- id 5
    ('Cancelado');      -- id 6`);
  await pool.query("INSERT INTO \"Servicio\" (nombre_servicio, id_sede) VALUES ('Medicina General', 1), ('Pediatría', 1);");
  await pool.query("INSERT INTO \"Responsable_Pago\" (nombre) VALUES ('Particular'), ('Seguro Humano');");
  await pool.query("INSERT INTO \"Consultorios\" (nombre, id_servicio, id_sede) VALUES ('Consultorio 101', 1, 1);");
  
  // Hash for '123456': $2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa
  await pool.query(`
    INSERT INTO "Usuarios" (cedula, password_hash, nombre, apellido, rol, status, id_sede, id_servicio, id_consultorio) 
    VALUES 
      ('21', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'MARIA', 'RECEPCION', 'recepcionista', true, 1, null, null),
      ('31', '$2b$10$NyGIcK6PGYTz/uV2rigXEe6SRB0DEGuRxuA3.iA0bRw7YzvJDhFXa', 'DR. JUAN', 'PEREZ', 'medico', true, 1, 1, 1);
  `);
  console.log('✅ Database reset completed successfully.');
}

async function runTest() {
  const report = {
    steps: [],
    success: true,
    error: null
  };

  function logStep(name, success, details = '') {
    console.log(`[STEP] ${name}: ${success ? '✅ OK' : '❌ FAILED'} ${details}`);
    report.steps.push({ name, success, details });
    if (!success) report.success = false;
  }

  try {
    // 1. Reset DB
    await resetDB();
    logStep('1. Inicializar Base de Datos', true, 'Semillas de prueba insertadas correctamente');

    // 2. Login Recepcionista
    console.log('\n--- Login Recepcionista ---');
    let resLoginRec = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '21',
        password: '123456'
      })
    });
    
    if (!resLoginRec.ok) {
      throw new Error(`Login recepcionista falló con status: ${resLoginRec.status}`);
    }
    
    const loginRecData = await resLoginRec.json();
    const tokenRec = loginRecData.token;
    logStep('2. Login Recepcionista', tokenRec !== undefined, `Token recibido: ${tokenRec ? 'Sí' : 'No'}`);

    const headersRec = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenRec}` 
    };

    // 3. Crear Paciente Nuevo
    console.log('\n--- Crear Paciente ---');
    let resPaciente = await fetch(`${API_BASE}/recepcion/pacientes`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({
        cedula: '99',
        nombre: 'Test',
        apellido: 'Paciente',
        telefono: '1234567890',
        status: true
      })
    });
    
    if (!resPaciente.ok) {
      const errTxt = await resPaciente.text();
      throw new Error(`Crear paciente falló: ${errTxt}`);
    }
    
    const paciente = await resPaciente.json();
    logStep('3. Registrar Paciente en Admisión', paciente.id_paciente !== undefined, `Paciente creado: ID ${paciente.id_paciente}, Cédula ${paciente.cedula}`);

    // 4. Crear Atención Inicial (Estado 1 - Registro)
    console.log('\n--- Generar Atención ---');
    let resAtencion = await fetch(`${API_BASE}/recepcion/atencion`, {
      method: 'POST',
      headers: headersRec,
      body: JSON.stringify({
        id_paciente: paciente.id_paciente,
        id_servicio: 1, // Medicina General
        id_responsable: 1 // Particular
      })
    });
    
    if (!resAtencion.ok) {
      const errTxt = await resAtencion.text();
      throw new Error(`Registrar atención falló: ${errTxt}`);
    }
    
    const atencionData = await resAtencion.json();
    const atencionId = atencionData.id_atencion;
    logStep('4. Generar Ficha de Atención (Estado 1)', atencionId !== undefined, `ID de Atención generado: ${atencionId}`);

    // Verify state 1
    const verifyAtencionInit = await pool.query('SELECT id_estado_actual FROM "Atencion" WHERE id_atencion = $1', [atencionId]);
    logStep('4.b Verificar Estado Inicial en DB', verifyAtencionInit.rows[0].id_estado_actual === 1, 'Estado inicial es 1 (Registro)');

    // 5. Simular APS: Avanzar a Sala de Espera (Estado 2)
    console.log('\n--- Avanzar a Sala de Espera ---');
    let resAvanzar = await fetch(`${API_BASE}/recepcion/atencion/${atencionId}/estado`, {
      method: 'PUT',
      headers: headersRec,
      body: JSON.stringify({
        id_estado_nuevo: 2 // Sala de Espera
      })
    });
    
    if (!resAvanzar.ok) {
      const errTxt = await resAvanzar.text();
      throw new Error(`Avanzar estado falló: ${errTxt}`);
    }
    
    const avanzarData = await resAvanzar.json();
    logStep('5. APS: Avanzar Paciente a Sala de Espera (Estado 2)', resAvanzar.ok, `Respuesta: ${avanzarData.mensaje}`);

    // Verify state 2
    const verifyAtencionEsp = await pool.query('SELECT id_estado_actual FROM "Atencion" WHERE id_atencion = $1', [atencionId]);
    logStep('5.b Verificar Estado de Espera en DB', verifyAtencionEsp.rows[0].id_estado_actual === 2, 'Estado es 2 (Sala de Espera)');

    // 6. Login Médico
    console.log('\n--- Login Médico ---');
    let resLoginMed = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: '31',
        password: '123456'
      })
    });
    
    if (!resLoginMed.ok) {
      throw new Error(`Login médico falló con status: ${resLoginMed.status}`);
    }
    
    const loginMedData = await resLoginMed.json();
    const tokenMed = loginMedData.token;
    logStep('6. Login Médico', tokenMed !== undefined, `Token recibido: ${tokenMed ? 'Sí' : 'No'}`);

    const headersMed = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenMed}` 
    };

    // 7. Médico consulta lista de espera
    console.log('\n--- Lista de Espera del Médico ---');
    let resCola = await fetch(`${API_BASE}/medico/espera?id_servicio=1`, {
      method: 'GET',
      headers: headersMed
    });
    
    if (!resCola.ok) {
      const errTxt = await resCola.text();
      throw new Error(`Obtener pacientes de médico falló: ${errTxt}`);
    }
    
    const colaData = await resCola.json();
    const pacienteEnCola = colaData.find(p => p.id_atencion === atencionId);
    logStep('7. Cola Médica: Encontrar Paciente en Lista', pacienteEnCola !== undefined, `Paciente encontrado en cola de Medicina General: ${pacienteEnCola ? 'Sí' : 'No'}`);

    // 8. Médico Llama al Paciente (Estado 4 - En Atención)
    console.log('\n--- Médico Llama Paciente ---');
    let resLlamar = await fetch(`${API_BASE}/medico/llamar`, {
      method: 'POST',
      headers: headersMed,
      body: JSON.stringify({
        id_atencion: atencionId
      })
    });
    
    if (!resLlamar.ok) {
      const errTxt = await resLlamar.text();
      throw new Error(`Llamar paciente falló: ${errTxt}`);
    }
    
    const llamarData = await resLlamar.json();
    logStep('8. Médico: Llamar e Iniciar Consulta', resLlamar.ok, `Respuesta: ${llamarData.mensaje}`);

    // Verify state 4
    const verifyAtencionAt = await pool.query('SELECT id_estado_actual FROM "Atencion" WHERE id_atencion = $1', [atencionId]);
    logStep('8.b Verificar Estado en DB (En Consulta/Atención)', verifyAtencionAt.rows[0].id_estado_actual === 4, 'Estado es 4 (En Atención)');

    // 9. Médico Finaliza la Atención (Estado 5 - Atendido)
    console.log('\n--- Médico Finaliza Consulta ---');
    let resFinalizar = await fetch(`${API_BASE}/medico/finalizar`, {
      method: 'POST',
      headers: headersMed,
      body: JSON.stringify({
        id_atencion: atencionId
      })
    });
    
    if (!resFinalizar.ok) {
      const errTxt = await resFinalizar.text();
      throw new Error(`Finalizar atencion falló: ${errTxt}`);
    }
    
    const finalizarData = await resFinalizar.json();
    logStep('9. Médico: Finalizar Consulta y Archivar', resFinalizar.ok, `Respuesta: ${finalizarData.mensaje}`);

    // Verify state 5 and hora_salida
    const verifyAtencionFin = await pool.query('SELECT id_estado_actual, hora_salida FROM "Atencion" WHERE id_atencion = $1', [atencionId]);
    const finalStateIs5 = verifyAtencionFin.rows[0].id_estado_actual === 5;
    const hasHoraSalida = verifyAtencionFin.rows[0].hora_salida !== null;
    logStep('9.b Verificar Estado Final en DB', finalStateIs5 && hasHoraSalida, `Estado es 5 (Atendido), hora_salida registrada: ${hasHoraSalida ? 'Sí' : 'No'}`);

    // 10. Verificar Historial
    const historyResult = await pool.query('SELECT id_estado FROM "Historial_Atencion" WHERE id_atencion = $1 ORDER BY id_historial ASC', [atencionId]);
    const states = historyResult.rows.map(r => r.id_estado);
    const validHistory = states.includes(1) && states.includes(2) && states.includes(4) && states.includes(5);
    logStep('10. Verificar Historial de Estados en DB', validHistory, `Secuencia de estados registrados: ${states.join(' -> ')}`);

  } catch (err) {
    console.error('❌ Error durante la ejecución de la prueba:', err);
    report.success = false;
    report.error = err.message;
  }

  // End pool connection
  await pool.end();
  
  console.log('\n=== [TEST RESULT] ===');
  console.log(JSON.stringify(report, null, 2));
  return report;
}

runTest();
