const pool = require('../db');
const { createTurno, getTodosLosTurnos } = require('../src/controllers/turnos.controller');

async function runTest() {
  console.log('=== [TEST] Iniciando prueba de sistema de colas ===');

  try {
    // Crear un turno
    const turnoData = {
      nombre_paciente: 'Juan Pérez',
      documento_paciente: '1234567890',
      telefono_paciente: '1234567890',
      servicio_id: 1
    };
    await createTurno(turnoData);
    console.log('Turno creado exitosamente');

    // Obtener todos los turnos
    const turnos = await getTodosLosTurnos();
    console.log('Turnos disponibles:', turnos);

    // Verificar si el turno se creó correctamente
    if (turnos.length > 0) {
      console.log('Prueba exitosa: Turno creado y recuperado correctamente');
    } else {
      throw new Error('No se pudo recuperar el turno recién creado');
    }
  } catch (error) {
    console.error('Error durante la prueba:', error);
  } finally {
    console.log('=== [TEST] Prueba de sistema de colas finalizada ===');
  }
}

runTest();
