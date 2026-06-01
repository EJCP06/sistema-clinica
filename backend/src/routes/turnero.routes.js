const express = require('express');
const router = express.Router();
const pool = require('../config/db');

router.get('/pacientes', async (req, res) => {
  try {
    const { estados, servicios } = req.query;

    const condiciones = [`a.hora_llegada >= CURRENT_DATE`];
    const params = [];
    let paramIndex = 1;

    if (estados) {
      const ids = estados.split(',').map(Number).filter(n => !isNaN(n));
      if (ids.length > 0) {
        const placeholders = ids.map((id) => {
          params.push(id);
          return `$${paramIndex++}`;
        });
        condiciones.push(`a.id_estado_actual IN (${placeholders.join(',')})`);
      }
    }

    if (servicios) {
      const ids = servicios.split(',').map(Number).filter(n => !isNaN(n));
      if (ids.length > 0) {
        const placeholders = ids.map((id) => {
          params.push(id);
          return `$${paramIndex++}`;
        });
        condiciones.push(`a.id_servicio IN (${placeholders.join(',')})`);
      }
    }

    const where = condiciones.length > 0 ? `WHERE ${condiciones.join(' AND ')}` : '';

    const result = await pool.query(
      `SELECT DISTINCT ON (a.id_atencion)
        a.id_atencion, a.numero,
        a.hora_llegada,
        a.hora_salida,
        a.id_estado_actual,
        p.nombre, p.apellido, p.cedula,
        s.nombre_servicio, s.prefijo, s.id_servicio,
        e.nombre_estado,
        c.nombre as consultorio_nombre
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
      LEFT JOIN "Historial_Atencion" h ON a.id_atencion = h.id_atencion
      ${where}
      ORDER BY a.id_atencion, h.fecha_hora DESC NULLS LAST
      LIMIT 20`,
      params
    );

    const pacientes = result.rows.map(r => ({
      id_atencion: r.id_atencion,
      numero: r.numero,
      hora_llegada: r.hora_llegada,
      estado: r.nombre_estado,
      id_estado_actual: r.id_estado_actual,
      nombre_servicio: r.nombre_servicio,
      id_servicio: r.id_servicio,
      consultorio_nombre: r.consultorio_nombre,
      paciente: {
        nombre: r.nombre,
        apellido: r.apellido,
        documento: r.cedula,
      }
    }));

    res.json(pacientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener datos del turnero' });
  }
});

// Mantiene compatibilidad con código anterior (estado=7, todos los servicios)
router.get('/sala-espera', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT DISTINCT ON (a.id_atencion)
        a.id_atencion, a.numero,
        a.hora_llegada,
        a.hora_salida,
        a.id_estado_actual,
        p.nombre, p.apellido, p.cedula,
        s.nombre_servicio, s.prefijo, s.id_servicio,
        e.nombre_estado,
        c.nombre as consultorio_nombre
      FROM "Atencion" a
      JOIN "Pacientes" p ON a.id_paciente = p.id_paciente
      JOIN "Servicio" s ON a.id_servicio = s.id_servicio
      JOIN "Estado" e ON a.id_estado_actual = e.id_estado
      LEFT JOIN "Consultorios" c ON a.id_consultorio = c.id_consultorio
      LEFT JOIN "Historial_Atencion" h ON a.id_atencion = h.id_atencion
      WHERE a.hora_llegada >= CURRENT_DATE
        AND a.id_estado_actual = 7
      ORDER BY a.id_atencion, h.fecha_hora DESC NULLS LAST
      LIMIT 20`
    );

    const pacientes = result.rows.map(r => ({
      id_atencion: r.id_atencion,
      numero: r.numero,
      hora_llegada: r.hora_llegada,
      estado: r.nombre_estado,
      id_estado_actual: r.id_estado_actual,
      nombre_servicio: r.nombre_servicio,
      id_servicio: r.id_servicio,
      consultorio_nombre: r.consultorio_nombre,
      paciente: {
        nombre: r.nombre,
        apellido: r.apellido,
        documento: r.cedula,
      }
    }));

    res.json(pacientes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ mensaje: 'Error al obtener datos del turnero' });
  }
});

module.exports = router;

