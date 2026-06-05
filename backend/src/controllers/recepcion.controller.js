const logger = require('../config/logger');
const pacienteRepo = require('../repositories/paciente.repository');
const atencionRepo = require('../repositories/atencion.repository');
const sharedRepo = require('../repositories/shared.repository');
const historialRepo = require('../repositories/historial.repository');

const getSede = (req) => req.usuario?.id_sede;

// GET /recepcion/responsables-pago
const getResponsablesPago = async (req, res) => {
  try {
    const rows = await sharedRepo.getResponsablesPago();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener responsables de pago' });
  }
};

// GET /recepcion/ultimas-admisiones
const getUltimasAdmisiones = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const rows = await atencionRepo.getUltimasAdmisiones(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener últimas admisiones' });
  }
};

// GET /recepcion/pacientes/:cedula
const buscarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { termino } = req.params;
    const { filtro } = req.query;

    const rows = await pacienteRepo.buscarPaciente(termino, filtro, sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al buscar paciente' });
  }
};

// POST /recepcion/pacientes
const crearPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { cedula, nombre, apellido, telefono, status } = req.body;

    if (!cedula || !nombre || !apellido) {
      return res.status(400).json({ mensaje: 'Cédula, nombre y apellido son requeridos' });
    }

    const paciente = await pacienteRepo.crearPaciente({ cedula, nombre, apellido, telefono, status, sede });
    res.status(201).json(paciente);
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe un paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear paciente' });
  }
};

// PUT /recepcion/pacientes/:id
const actualizarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { cedula, nombre, apellido, telefono } = req.body;

    const paciente = await pacienteRepo.actualizarPaciente(id, sede, { cedula, nombre, apellido, telefono });

    if (!paciente) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json(paciente);
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(400).json({ mensaje: 'Ya existe otro paciente con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar paciente' });
  }
};

// DELETE /recepcion/pacientes/:id
const eliminarPaciente = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const eliminado = await pacienteRepo.eliminarPaciente(id, sede);

    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Paciente no encontrado' });
    }

    res.json({ mensaje: 'Paciente eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar paciente' });
  }
};

// PUT /recepcion/atencion/:id
const actualizarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_servicio, id_responsable, id_cliente, id_especialidad } = req.body;

    if (id_servicio !== undefined) {
      const current = await atencionRepo.getAtencionEstado(id, sede);

      if (!current) {
        return res.status(404).json({ mensaje: 'Atención no encontrada' });
      }

      const estadoActual = current.id_estado_actual;
      if ([4, 5, 6, 7].includes(estadoActual)) {
        return res.status(400).json({
          mensaje: 'No se puede cambiar el servicio porque el paciente ya está en Llamado, En Atención, Atendido o Ausente',
        });
      }

      await atencionRepo.actualizarAtencionConServicio(id, sede, { id_servicio, id_responsable, id_cliente });
    } else {
      await atencionRepo.actualizarAtencionSimple(id, sede, { id_responsable, id_cliente, id_especialidad });
    }

    res.json({ mensaje: 'Atención actualizada' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar atención' });
  }
};

// DELETE /recepcion/atencion/:id
const eliminarAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    await atencionRepo.eliminarAtencion(id, sede);
    res.json({ mensaje: 'Atención eliminada' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar atención' });
  }
};

// PUT /recepcion/atencion/:id/estado
const actualizarEstadoAtencion = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });

  try {
    const { id } = req.params;
    const { id_estado_nuevo } = req.body;

    const result = await atencionRepo.actualizarEstadoAtencion(id, sede, id_estado_nuevo);

    if (!result) {
      return res.status(404).json({ mensaje: 'Atención no encontrada' });
    }

    if (req.io) req.io.emit('estado-actualizado', { id_atencion: id });

    await historialRepo.insertSinTransaccion(id, id_estado_nuevo);

    res.json({ mensaje: 'Estado actualizado', id_estado_actual: id_estado_nuevo });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar estado de atención' });
  }
};

// POST /recepcion/generar-turno
const generarTurno = async (req, res) => {
  const sede = getSede(req);
  if (!sede) return res.status(401).json({ mensaje: 'Sin sede' });
  const usuarioId = req.usuario?.id;

  try {
    const { id_paciente, id_servicio, id_responsable, id_cliente, id_especialidad } = req.body;

    if (!id_paciente || !id_servicio) {
      return res.status(400).json({ mensaje: 'Paciente y servicio son requeridos' });
    }

    const { prefijo, next } = await atencionRepo.getPrefijoYConteo(id_servicio, sede);
    const numero = `${prefijo}-${String(next).padStart(2, '0')}`;

    const turno = await atencionRepo.insertarAtencion({ id_paciente, id_servicio, id_responsable, sede, usuarioId, numero, id_cliente, id_especialidad });

    if (req.io) req.io.emit('estado-actualizado', { tipo: 'nuevo-turno', id_atencion: turno.id_atencion });

    res.status(201).json(turno);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al generar turno' });
  }
};

module.exports = {
  getResponsablesPago,
  getUltimasAdmisiones,
  buscarPaciente,
  crearPaciente,
  actualizarPaciente,
  eliminarPaciente,
  actualizarAtencion,
  eliminarAtencion,
  actualizarEstadoAtencion,
  generarTurno,
};
