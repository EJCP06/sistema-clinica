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

router.get('/ultimo-llamado', async (req, res) => {
  try {
    const { sede } = req.query;
    if (!sede) {
      return res.json({});
    }

    const llamado = await atencionRepo.getUltimoLlamado(Number(sede));

    if (!llamado) {
      return res.json({});
    }

    const horaLlamadoMs = llamado.hora_llamado ? new Date(llamado.hora_llamado).getTime() : null;

    res.json({
      id_atencion: llamado.id_atencion,
      turno: llamado.numero,
      paciente: llamado.primer_nombre,
      apellido: llamado.primer_apellido || '',
      consultorio: llamado.consultorio_nombre || llamado.nombre_servicio,
      hora_llamado: llamado.hora_llamado || null,
      hora_llamado_epoch: horaLlamadoMs,
      // Mismo ancla que el evento por socket de consultorios.controller.js:
      // `inicio_ms` = hora del llamado (sin margen) e `inicio_inmediato` para
      // que un turnero que se conecta tarde anuncie YA y siga el mismo ciclo
      // de repetición de 10s que el resto de pantallas.
      inicio_ms: horaLlamadoMs || null,
      inicio_inmediato: horaLlamadoMs ? true : false,
      server_now: Date.now(),
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener último llamado' });
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
