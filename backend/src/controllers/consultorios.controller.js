const pool = require('../config/db');
const logger = require('../config/logger');
const servicioRepo = require('../repositories/servicio.repository');
const atencionRepo = require('../repositories/atencion.repository');
const consultorioRepo = require('../repositories/consultorio.repository');
const historialRepo = require('../repositories/historial.repository');

const obtenerMiEstado = async (req, res) => {
  if (!req.usuario) {
    return res.status(401).json({ mensaje: 'No hay usuario autenticado' });
  }
  
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;

  try {
    // Lab/Imagenes: siempre por servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) {
        const nombreServicio = rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes';
        return res.json({
          estado: 'LIBRE', servicio_id: null, nombre: nombreServicio, servicio_nombre: nombreServicio,
          turno_id: null, turno_numero: null, turno_estado: null,
          nombre_paciente: null, apellido_paciente: null, documento_paciente: null, turno_hora_llegada: null
        });
      }
      const estadoAtencion = await atencionRepo.getEstadoDeAtencionPorServicio(servicioId);
      return res.json(estadoAtencion || { estado: 'LIBRE', servicio_id: servicioId, nombre: rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes', servicio_nombre: rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes', turno_id: null, turno_numero: null, turno_estado: null, nombre_paciente: null, apellido_paciente: null, documento_paciente: null, turno_hora_llegada: null });
    }

    // Otros roles: requieren consultorio
    if (!consultorioId) {
      return res.status(400).json({ mensaje: 'No tiene consultorio asignado' });
    }

    const result = await atencionRepo.getEstadoDeAtencionPorConsultorio(consultorioId);
    
    if (!result) {
      return res.status(404).json({ mensaje: 'Información no encontrada' });
    }
    res.json(result);
  } catch (error) {
    logger.error('Error en obtenerMiEstado:', error);
    res.status(500).json({ mensaje: 'Error al obtener estado' });
  }
};

const resolverServicioId = async (rol, servicioId) => {
  if (servicioId) return servicioId;
  const nombreBuscar = rol === 'laboratorio' ? '%laboratorio%' : '%imagen%';
  const result = await servicioRepo.findByNameLike(nombreBuscar);
  return result ? result.id_servicio : null;
};

const llamarSiguiente = async (req, res) => {
  console.log('[LLAMAR SIGUIENTE] Usuario:', req.usuario);
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;

  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    
    let servicioNombre = '';

    // Lab/Imagenes: siempre por servicio, ignorar consultorio
    if (rol === 'laboratorio' || rol === 'imagenes') {
      const sid = await resolverServicioId(rol, servicioId);
      if (!sid) { 
          // Log explicitly why it failed
          logger.error(`Servicio no encontrado para rol: ${rol}, servicioId: ${servicioId}`);
          await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); 
      }
      servicioId = sid;
      const servicio = await servicioRepo.getNombre(sid);
      servicioNombre = servicio || (rol === 'laboratorio' ? 'Laboratorio' : 'Imágenes');
    } else {
      // Otros roles: requieren consultorio
      if (!consultorioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Usuario sin consultorio' }); }
      const consultorio = await consultorioRepo.getConsultorioById(consultorioId);
      if (!consultorio) throw new Error('Consultorio no encontrado');
      if (consultorio.estado !== 'LIBRE') { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'El consultorio debe estar LIBRE para llamar' }); }
      servicioId = consultorio.servicio_id;
      servicioNombre = consultorio.nombre;
    }

    if (!req.usuario || !req.usuario.id_sede) {
      await client.query('ROLLBACK');
      return res.status(400).json({ mensaje: 'Datos de usuario insuficientes' });
    }
    
    const idEspecialidad = req.usuario.id_especialidad;
    const turno = await atencionRepo.getEnEsperaPorServicio(client, servicioId, req.usuario.id_sede, idEspecialidad);

    if (!turno) {
      await client.query('ROLLBACK');
      return res.json({ mensaje: 'No hay pacientes en espera de este servicio', turno: null });
    }

    await atencionRepo.llamarAtencion(client, turno.id, rol === 'laboratorio' || rol === 'imagenes' ? null : consultorioId);

    await historialRepo.insert(client, turno.id, 4);

    if (consultorioId && rol !== 'laboratorio' && rol !== 'imagenes') {
      await consultorioRepo.setEstadoFisico(client, consultorioId, 'OCUPADO');
    }

    await client.query('COMMIT');

    if (req.io) {
      req.io.emit('estado-actualizado', { tipo: 'llamado', id_atencion: turno.id });
      req.io.emit('nuevo-llamado', { 
        tipo: 'llamado',
        id_atencion: turno.id,
        turno: turno.numero, 
        consultorio: servicioNombre,
        paciente: turno.nombre_paciente,
        apellido: turno.apellido_paciente || '',
        id_sede: req.usuario.id_sede
      });
    }

    res.json({
      mensaje: 'Paciente llamado exitosamente',
      turno: {
        id: turno.id,
        numero: turno.numero,
        estado: 'LLAMADO',
        hora_llegada: turno.hora_llegada,
        paciente: {
          nombre: turno.nombre_paciente,
          apellido: turno.apellido_paciente,
          documento: turno.documento_paciente,
          telefono: turno.telefono_paciente
        }
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en llamarSiguiente:', error);
    res.status(500).json({ mensaje: 'Error al procesar el llamado' });
  } finally {
    client.release();
  }
};

const iniciarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;
  const client = await pool.connect();
  
  try {
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); }
    } else if (!consultorioId) {
      return res.status(400).json({ mensaje: 'Usuario sin consultorio' });
    }

    await client.query('BEGIN');
    
    let atencion;
    if (rol === 'laboratorio' || rol === 'imagenes') {
      atencion = await atencionRepo.iniciarAtencionPorServicio(client, servicioId);
    } else {
      atencion = await atencionRepo.iniciarAtencionPorConsultorio(client, consultorioId);
    }

    if (!atencion) {
      await client.query('ROLLBACK');
      return res.status(404).json({ mensaje: 'No hay paciente llamado esperando para iniciar atención' });
    }

    const atencionId = atencion.id_atencion;

    await atencionRepo.setAtencionEstado(client, atencionId, 5);
    await historialRepo.insert(client, atencionId, 5);
    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { tipo: 'liberacion', id_atencion: atencionId });

    res.json({ mensaje: 'Atención iniciada correctamente', id_atencion: atencionId });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en iniciarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al iniciar atención' });
  } finally {
    client.release();
  }
};

const finalizarAtencion = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  let servicioId = req.usuario.servicio_id;
  const rol = req.usuario.rol;
  const client = await pool.connect();
  
  try {
    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      if (!servicioId) { await client.query('ROLLBACK'); return res.status(400).json({ mensaje: 'Servicio no encontrado' }); }
    } else if (!consultorioId) {
      return res.status(400).json({ mensaje: 'Usuario sin consultorio' });
    }

    await client.query('BEGIN');
    
    let atencion;
    if (rol === 'laboratorio' || rol === 'imagenes') {
      atencion = await atencionRepo.finalizarPorServicio(client, servicioId);
    } else {
      atencion = await atencionRepo.finalizarPorConsultorio(client, consultorioId);
    }

    if (!atencion) {
      await client.query('ROLLBACK');
      return res.status(200).json({ mensaje: 'No hay pacientes en espera de este servicio', turno: null });
    }

    const atencionId = atencion.id_atencion;
    await historialRepo.insert(client, atencionId, 6);

    if (consultorioId && rol !== 'laboratorio' && rol !== 'imagenes') {
      await consultorioRepo.setEstadoFisico(client, consultorioId, 'LIBRE');
    }

    await client.query('COMMIT');

    if (req.io) req.io.emit('estado-actualizado', { id_atencion: atencionId });

    res.json({ mensaje: 'Atención finalizada' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en finalizarAtencion:', error);
    res.status(500).json({ mensaje: 'Error al finalizar atención' });
  } finally {
    client.release();
  }
};

const liberarConsultorio = async (req, res) => {
  const consultorioId = req.usuario.consultorio_id;
  const rol = req.usuario.rol;
  let servicioId = req.usuario.servicio_id;
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    if (consultorioId && rol !== 'laboratorio' && rol !== 'imagenes') {
      await consultorioRepo.setEstadoFisico(client, consultorioId, 'LIBRE');
    }

    if (rol === 'laboratorio' || rol === 'imagenes') {
      servicioId = await resolverServicioId(rol, servicioId);
      await atencionRepo.liberarEnServicio(client, servicioId);
    } else if (consultorioId) {
      await atencionRepo.liberarEnConsultorio(client, consultorioId);
    }

    await client.query('COMMIT');
    if (req.io) req.io.emit('estado-actualizado', { tipo: 'liberacion' });
    
    res.json({ mensaje: 'Consultorio liberado correctamente' });
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Error en liberarConsultorio:', error);
    res.status(500).json({ mensaje: 'Error al liberar consultorio' });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerMiEstado,
  llamarSiguiente,
  iniciarAtencion,
  finalizarAtencion,
  liberarConsultorio,
};
