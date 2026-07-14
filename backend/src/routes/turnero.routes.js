const express = require('express');
const router = express.Router();
const logger = require('../config/logger');
const atencionRepo = require('../repositories/atencion.repository');

router.get('/pacientes', async (req, res) => {
  try {
    const { estados, servicios, responsable, sede } = req.query;

    const rows = await atencionRepo.getTurneroPacientes(estados, servicios, responsable, sede);

    const pacientes = rows.map(r => ({
      id_atencion: r.id_atencion,
      numero: r.numero,
      hora_llegada: r.hora_llegada,
      estado: r.nombre_estado,
      id_estado_actual: r.id_estado_actual,
      id_responsable: r.id_responsable,
      modalidad_pago: r.modalidad_pago,
      nombre_servicio: r.nombre_servicio,
      id_servicio: r.id_servicio,
      consultorio_nombre: r.consultorio_nombre,
      especialidad_nombre: r.nombre_especialidad,
      paciente: {
        nombre: r.nombre,
        apellido: r.apellido,
      }
    }));

    res.json(pacientes);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener datos del turnero' });
  }
});

router.get('/sala-espera', async (req, res) => {
  try {
    const rows = await atencionRepo.getSalaEspera();

    const pacientes = rows.map(r => ({
      id_atencion: r.id_atencion,
      numero: r.numero,
      hora_llegada: r.hora_llegada,
      estado: r.nombre_estado,
      id_estado_actual: r.id_estado_actual,
      nombre_servicio: r.nombre_servicio,
      id_servicio: r.id_servicio,
      consultorio_nombre: r.consultorio_nombre,
      especialidad_nombre: r.nombre_especialidad,
      paciente: {
        nombre: r.nombre,
        apellido: r.apellido,
      }
    }));

    res.json(pacientes);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener datos del turnero' });
  }
});

module.exports = router;

