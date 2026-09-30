/**
 * Prueba manual de la integración con el sistema externo de cola MQ.
 *
 * Envía un paciente de ejemplo (o uno real de la BD) a
 * POST {INTEGRACION_COLA_URL} con el header X-Api-Key y reporta la respuesta.
 *
 * Uso:
 *   node backend/scripts/test-integracion-cola.js
 *   node backend/scripts/test-integracion-cola.js --cedula 12345678
 *   npm run test:integracion
 *
 * Salida esperada: HTTP 201 + created:true (paciente nuevo) o
 * HTTP 200 + created:false (cedula ya existente => upsert).
 */
const armarPayload = require('../src/services/integracionCola.service').armarPayload;
const enviarPaciente = require('../src/services/integracionCola.service').enviarPaciente;

// Paciente de ejemplo (mismo formato que el ejemplo del Swagger).
const PACIENTE_EJEMPLO = {
  cedula: '12345678',
  tipo_documento: 'v',
  primer_nombre: 'JUAN',
  segundo_nombre: 'CARLOS',
  primer_apellido: 'PEREZ',
  segundo_apellido: null,
  fecha_nacimiento: '1985-04-12',
  sexo: 'M',
  estado_civil: 'S',
  direccion: 'Av. Libertador, Caracas',
  telefono: '04121234567',
  email: 'jperez@correo.com',
  parentesco_representante: null,
  cedula_representante: null,
  nombre_representante: null,
};

/**
 * Carga un paciente real de la base de datos local por cédula.
 *
 * @param {string} cedula - Cédula a buscar
 * @returns {Promise<object|null>} Registro de la tabla "Pacientes"
 */
const cargarDesdeBase = async (cedula) => {
  const pool = require('../src/config/db');
  const result = await pool.query(
    'SELECT * FROM "Pacientes" WHERE cedula = $1 ORDER BY id_paciente DESC LIMIT 1',
    [cedula]
  );
  await pool.end();
  return result.rows[0] || null;
};

const main = async () => {
  const argCedula = process.argv.indexOf('--cedula');
  const cedula = argCedula !== -1 ? process.argv[argCedula + 1] : null;

  let paciente = PACIENTE_EJEMPLO;
  if (cedula) {
    paciente = await cargarDesdeBase(cedula);
    if (!paciente) {
      console.error(`No se encontró ningún paciente con cédula ${cedula}`);
      process.exitCode = 1;
      return;
    }
    console.log(`Usando paciente real de la BD: ${paciente.primer_nombre} ${paciente.primer_apellido}`);
  }

  const { payload, faltantes } = armarPayload(paciente);

  console.log('--- URL ---');
  console.log(process.env.INTEGRACION_COLA_URL || '(INTEGRACION_COLA_URL sin definir)');
  console.log('--- Headers ---');
  console.log('Content-Type: application/json');
  console.log(`X-Api-Key: ${(process.env.INTEGRACION_COLA_API_KEY || '').split(':')[0]}:***`);
  console.log('--- Payload ---');
  console.log(JSON.stringify(payload, null, 2));

  if (faltantes.length > 0) {
    console.error(`\nFALTAN campos obligatorios: ${faltantes.join(', ')}`);
    console.error('El sistema externo rechazaría esta ficha; no se envía.');
    process.exitCode = 1;
    return;
  }

  const resultado = await enviarPaciente(payload);

  console.log('--- Respuesta ---');
  console.log(`ok=${resultado.ok} status=${resultado.status} created=${resultado.created}`);
  console.log(resultado.detalle);

  if (!resultado.ok) {
    process.exitCode = 1;
  }
};

main().catch((error) => {
  console.error('Error inesperado:', error.message);
  process.exitCode = 1;
});
