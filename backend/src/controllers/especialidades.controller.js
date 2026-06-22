const db = require('../config/db');
const logger = require('../config/logger');
const espRepo = require('../repositories/especialidad.repository');

const getSede = (req) => {
  const sede = req.usuario?.id_sede;
  console.log(`DEBUG: Especialidades - Usuario ${req.usuario?.cedula} accediendo a Sede: ${sede}`);
  return sede !== undefined && sede !== null ? Number(sede) : null;
};

const getEspecialidades = async (req, res) => {
  try {
    const sede = getSede(req);
    if (!sede) {
      return res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    }
    const especialidades = await espRepo.getAll(sede);
    const relaciones = await espRepo.getConsultoriosByEspecialidad();

    const consultoriosPorEsp = {};
    for (const row of relaciones) {
      if (!consultoriosPorEsp[row.id_especialidad]) {
        consultoriosPorEsp[row.id_especialidad] = [];
      }
      consultoriosPorEsp[row.id_especialidad].push(row.id_consultorio);
    }

    const rows = especialidades.map((e) => ({
      ...e,
      consultorios_ids: consultoriosPorEsp[e.id_especialidad] || [],
    }));

    res.json(rows);
  } catch (err) {
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const createEspecialidad = async (req, res) => {
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const esp = await espRepo.create(client, { nombre, prefijo, id_servicio, id_sede, piso, activo });
    const espId = esp.id_especialidad;

    if (consultorios_ids && consultorios_ids.length > 0) {
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, espId, conId);
      }
    }

    await client.query('COMMIT');
    res.status(201).json({ ...esp, consultorios_ids: consultorios_ids || [] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const updateEspecialidad = async (req, res) => {
  const { id } = req.params;
  const { nombre, prefijo, id_servicio, id_sede, piso, consultorios_ids, activo } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const sets = [];
    const values = [];
    let idx = 1;

    if (nombre !== undefined) { sets.push(`nombre = $${idx++}`); values.push(nombre); }
    if (prefijo !== undefined) { sets.push(`prefijo = $${idx++}`); values.push(prefijo); }
    if (id_servicio !== undefined) { sets.push(`id_servicio = $${idx++}`); values.push(id_servicio); }
    if (id_sede !== undefined) { sets.push(`id_sede = $${idx++}`); values.push(id_sede); }
    if (piso !== undefined) { sets.push(`piso = $${idx++}`); values.push(piso); }
    if (activo !== undefined) { sets.push(`activo = $${idx++}`); values.push(activo); }

    if (sets.length > 0) {
      await espRepo.update(client, id, sets, values, idx);
    }

    if (consultorios_ids !== undefined) {
      await espRepo.deleteConsultorioRelations(client, id);
      for (const conId of consultorios_ids) {
        await espRepo.insertConsultorioRelation(client, id, conId);
      }
    }

    await client.query('COMMIT');

    const result = await espRepo.getById(id);
    const consultoriosIds = await espRepo.getConsultorioIdsByEspecialidad(id);
    res.json({
      ...result,
      consultorios_ids: consultoriosIds,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  } finally {
    client.release();
  }
};

const deleteEspecialidad = async (req, res) => {
  const { id } = req.params;
  try {
    await espRepo.remove(id);
    res.json({ mensaje: 'Especialidad eliminada' });
  } catch (err) {
    if (err.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar: hay médicos o registros de atención asociados a esta especialidad.' });
    }
    logger.error(err);
    res.status(500).json({ mensaje: 'Error interno del servidor' });
  }
};

const importarEspecialidades = async (req, res) => {
  const { rows } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ mensaje: 'No hay datos para importar' });
  }

  let importados = 0;
  let omitidos = 0;
  let errores = 0;

  // Obtener mapeo de sedes: { "nombre": id } (Normalizado: minúsculas y sin acentos)
  const sedesResult = await db.query('SELECT id_sede, nombre FROM "Sedes"');
  const mapaSedes = {};
  sedesResult.rows.forEach(s => {
    const nombreNormalizado = s.nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
    mapaSedes[nombreNormalizado] = s.id_sede;
  });

  // Obtener nombres existentes para evitar duplicados
  const nombresExcel = rows.map(r =>
    (r.nombre || r.Nombre || r.NOMBRE || '').toString().toUpperCase().trim()
  ).filter(n => n);
  const existentes = await db.query(
    `SELECT nombre FROM "Especialidades" WHERE nombre = ANY($1)`,
    [nombresExcel],
  );
  const nombresExistentes = new Set(existentes.rows.map((r) => r.nombre));

  for (const row of rows) {
    try {
      const nombre = (row.nombre || row.Nombre || row.NOMBRE || '').toString().toUpperCase().trim();
      const prefijo = (row.prefijo || row.Prefijo || row.PREFIJO || '').toString().toUpperCase().trim();
      const piso = (row.piso || row.Piso || row.PISO || '').toString().replace(/\D/g, '');
      
      // Lógica inteligente para la sede (Normalizada)
      const nombreSedeRaw = (row.sede || row.Sede || row.SEDE || '').toString();
      const nombreSedeNormalizado = nombreSedeRaw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      const idSede = mapaSedes[nombreSedeNormalizado] || 1; 

      // Lógica inteligente para el estado activo (Normalizada)
      const valorActivoRaw = (row.activo || row.Activo || row.ACTIVO || true).toString();
      const valorActivoNormalizado = valorActivoRaw
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
      
      const esActivo = valorActivoNormalizado === 'verdadero' || valorActivoNormalizado === 'true';

      if (!nombre) {
        errores++;
        continue;
      }

      if (nombresExistentes.has(nombre)) {
        omitidos++;
        continue;
      }

      const client = await db.connect();
      try {
        await client.query(
          `INSERT INTO "Especialidades" (nombre, prefijo, id_servicio, id_sede, piso, activo)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [nombre, prefijo || null, 1, Number(idSede), piso || null, esActivo],
        );
        importados++;
      } finally {
        client.release();
      }
    } catch (error) {
      logger.error('Error al importar especialidad:', { error: error.message, row });
      errores++;
    }
  }

  res.json({
    mensaje: `Importación completada: ${importados}, ${omitidos} ya existían, ${errores} errores`,
    importados,
    omitidos,
    errores,
  });
};

module.exports = { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad, importarEspecialidades };
