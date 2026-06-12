const pool = require('./src/config/db');

const nuevosPermisos = [
  // ADMISIÓN
  { key: 'admision_crear', nombre: 'Crear Paciente', descripcion: 'Crear pacientes en admisión' },
  { key: 'admision_editar', nombre: 'Editar Paciente', descripcion: 'Editar pacientes en admisión' },
  { key: 'admision_eliminar', nombre: 'Eliminar Paciente', descripcion: 'Eliminar pacientes en admisión' },
  { key: 'admision_asignar_turno', nombre: 'Asignar Turno', descripcion: 'Asignar turnos en admisión' },

  // APS
  { key: 'aps_enviar_presupuesto', nombre: 'Enviar Presupuesto', descripcion: 'Enviar a presupuesto en APS' },
  { key: 'aps_solicitar_clave', nombre: 'Solicitar Clave', descripcion: 'Solicitar clave de aseguradora' },
  { key: 'aps_enviar_sala_espera', nombre: 'Enviar Sala Espera', descripcion: 'Enviar a sala de espera desde APS' },
  { key: 'aps_aprobar_clave', nombre: 'Aprobar Clave', descripcion: 'Aprobar clave de aseguradora' },
  { key: 'aps_reincorporar', nombre: 'Reincorporar', descripcion: 'Reincorporar paciente en APS' },

  // LABORATORIO
  { key: 'laboratorio_registrar_caja', nombre: 'Registrar Caja', descripcion: 'Registrar en caja en laboratorio' },
  { key: 'laboratorio_pasar_sala_espera', nombre: 'Pasar Sala Espera', descripcion: 'Pasar a sala de espera en laboratorio' },
  { key: 'laboratorio_marcar_ausente', nombre: 'Marcar Ausente', descripcion: 'Marcar ausente en laboratorio' },
  { key: 'laboratorio_reincorporar', nombre: 'Reincorporar', descripcion: 'Reincorporar en laboratorio' },

  // IMÁGENES
  { key: 'imagenes_registrar_caja', nombre: 'Registrar Caja', descripcion: 'Registrar en caja en imágenes' },
  { key: 'imagenes_pasar_sala_espera', nombre: 'Pasar Sala Espera', descripcion: 'Pasar a sala de espera en imágenes' },
  { key: 'imagenes_marcar_ausente', nombre: 'Marcar Ausente', descripcion: 'Marcar ausente en imágenes' },
  { key: 'imagenes_reincorporar', nombre: 'Reincorporar', descripcion: 'Reincorporar en imágenes' },

  // LLAMADO
  { key: 'llamado_laboratorio', nombre: 'Llamar Laboratorio', descripcion: 'Llamar paciente de laboratorio' },
  { key: 'llamado_imagenes', nombre: 'Llamar Imágenes', descripcion: 'Llamar paciente de imágenes' },

  // ASEGURADORAS
  { key: 'aseguradoras_crear', nombre: 'Crear Aseguradora', descripcion: 'Crear aseguradora' },
  { key: 'aseguradoras_editar', nombre: 'Editar Aseguradora', descripcion: 'Editar aseguradora' },
  { key: 'aseguradoras_eliminar', nombre: 'Eliminar Aseguradora', descripcion: 'Eliminar aseguradora' },
  { key: 'aseguradoras_importar_excel', nombre: 'Importar Excel', descripcion: 'Importar aseguradoras desde Excel' },

  // ATENCIÓN MÉDICA
  { key: 'atencion_medica_llamar_siguiente', nombre: 'Llamar Siguiente', descripcion: 'Llamar siguiente paciente' },
  { key: 'atencion_medica_liberar_consultorio', nombre: 'Liberar Consultorio', descripcion: 'Liberar consultorio' },
  { key: 'atencion_medica_iniciar', nombre: 'Iniciar Atención', descripcion: 'Iniciar atención médica' },
  { key: 'atencion_medica_marcar_ausente', nombre: 'Marcar Ausente', descripcion: 'Marcar paciente como ausente' },
  { key: 'atencion_medica_finalizar', nombre: 'Finalizar Atención', descripcion: 'Finalizar atención médica' },
];

async function migrar() {
  let insertados = 0;
  let existentes = 0;

  for (const p of nuevosPermisos) {
    try {
      const result = await pool.query(
        'INSERT INTO "Permisos" (key, nombre, descripcion) VALUES ($1, $2, $3) ON CONFLICT (key) DO NOTHING',
        [p.key, p.nombre, p.descripcion]
      );
      if (result.rowCount > 0) {
        insertados++;
        console.log(`  [+] ${p.key}`);
      } else {
        existentes++;
        console.log(`  [=] ${p.key} (ya existe)`);
      }
    } catch (err) {
      console.error(`  [!] Error insertando ${p.key}: ${err.message}`);
    }
  }

  console.log(`\nResultado: ${insertados} insertados, ${existentes} ya existentes`);

  const r = await pool.query('SELECT key, nombre FROM "Permisos" ORDER BY key');
  console.log(`\nTotal permisos en DB: ${r.rows.length}`);
  r.rows.forEach(p => console.log(`  ${p.key} -> ${p.nombre}`));

  process.exit();
}

migrar().catch(e => { console.error(e); process.exit(1); });
