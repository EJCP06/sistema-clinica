const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logger');
const usuarioRepo = require('../repositories/usuario.repository');
const { auditar } = require('../middleware/audit');
const cache = require('../config/cache');
const { getUserId, getSede } = require('./_helpers');

const getPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const { rol } = req.query;
    const rows = await usuarioRepo.getPersonal(sede, rol);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener personal' });
  }
};

const crearPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;
  try {
    const { cedula, primer_nombre, segundo_nombre, primer_apellido, segundo_apellido, telefono, email, password, rol, id_consultorio, id_servicio, id_especialidad, status, id_sede } = req.body;
    if (!cedula || !primer_nombre || !rol) {
      return res.status(400).json({ mensaje: 'Cédula, nombre y rol son requeridos' });
    }
    const sedeFinal = id_sede ? Number(id_sede) : sedeToken;
    const existe = await usuarioRepo.findByCedulaSede(cedula, sedeFinal);
    if (existe) {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula en esta sede' });
    }
    const password_hash = password ? await bcrypt.hash(password, 10) : await bcrypt.hash(crypto.randomBytes(6).toString('hex'), 10);
    const emailFinal = email ? email.toLowerCase().trim() : null;
    const result = await usuarioRepo.crearPersonal({
      cedula, primer_nombre, segundo_nombre: segundo_nombre || null,
      primer_apellido: primer_apellido || '', segundo_apellido: segundo_apellido || null,
      telefono: telefono || '', email: emailFinal, password_hash, rol,
      id_consultorio: id_consultorio || null, id_servicio: id_servicio || null,
      id_especialidad: id_especialidad || null, sede: sedeFinal, status: status !== false,
    });
    auditar({ userId: getUserId(req), accion: 'crear', recurso: 'personal', recursoId: result.id_usuario, ip: req.ip });
    res.status(201).json({ mensaje: 'Personal creado', id: result.id_usuario });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al crear personal' });
  }
};

const actualizarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const { id } = req.params;
    const fields = { ...req.body };
    delete fields.id;
    if (fields.email) fields.email = fields.email.toLowerCase().trim();
    if (fields.password) {
      fields.password_hash = await bcrypt.hash(fields.password, 10);
      delete fields.password;
    }
    if (fields.id_sede !== undefined) fields.id_sede = Number(fields.id_sede);
    const allowed = ['cedula', 'primer_nombre', 'segundo_nombre', 'primer_apellido', 'segundo_apellido', 'telefono', 'email', 'password_hash', 'rol', 'id_consultorio', 'id_servicio', 'id_especialidad', 'status', 'id_sede'];
    const safeFields = {};
    for (const key of Object.keys(fields)) {
      if (allowed.includes(key) && fields[key] !== undefined) safeFields[key] = fields[key];
    }
    if (Object.keys(safeFields).length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }
    await usuarioRepo.actualizarPersonal(id, sede, safeFields);
    await cache.del(`usuario:${id}`);
    auditar({ userId: getUserId(req), accion: 'editar', recurso: 'personal', recursoId: Number(id), detalle: { campos: Object.keys(safeFields) }, ip: req.ip });
    if (safeFields.status === false && req.io) {
      for (const socket of req.io.sockets.sockets.values()) {
        if (socket.usuario && Number(socket.usuario.id) === Number(id)) {
          socket.emit('usuario-desactivado');
          break;
        }
      }
    }
    res.json({ mensaje: 'Personal actualizado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un usuario con esa cédula' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar personal' });
  }
};

const eliminarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;
  try {
    const { id } = req.params;
    const eliminado = await usuarioRepo.eliminarPersonal(id, sede);
    if (!eliminado) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    auditar({ userId: getUserId(req), accion: 'eliminar', recurso: 'personal', recursoId: Number(id), ip: req.ip });
    res.json({ mensaje: 'Personal eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar personal' });
  }
};

const importarPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;
  const { rows, rol: rolGlobal } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ mensaje: 'No hay datos para importar' });
  }
  let importados = 0, omitidos = 0, errores = 0;
  const cedulasExcel = rows.map(r => String(r.cedula || r.Cedula || r.CÉDULA || r.documento || r.Documento || '').replace(/\D/g, '')).filter(c => c);
  const existentes = await usuarioRepo.findByCedulas(cedulasExcel);
  const cedulasExistentes = new Set(existentes.map((u) => u.cedula));
  const normalizarRol = (r) => {
    if (!r) return null;
    return String(r).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "").trim();
  };
  for (const row of rows) {
    try {
      const cedula = String(row.cedula || row.Cedula || row.CÉDULA || row.documento || row.Documento || '').replace(/\D/g, '');
      const telefono = (row.telefono || row.Teléfono || row.TELEFONO || row.Telefono || row.telefono || '').toString().replace(/\D/g, '');
      const email = (row.email || row.Email || row.EMAIL || row.correo || row.Correo || '').toString().toLowerCase().trim() || null;
      let primerNombre, segundoNombre, primerApellido, segundoApellido;
      if (row.primer_nombre) {
        primerNombre = (row.primer_nombre || '').toString().toUpperCase().trim();
        segundoNombre = (row.segundo_nombre || '').toString().toUpperCase().trim() || null;
        primerApellido = (row.primer_apellido || '').toString().toUpperCase().trim();
        segundoApellido = (row.segundo_apellido || '').toString().toUpperCase().trim() || null;
      } else {
        const nombre = (row.nombre || row.Nombre || row.NOMBRE || '').toString().toUpperCase().trim();
        const apellido = (row.apellido || row.Apellido || row.APELLIDO || '').toString().toUpperCase().trim();
        const [pn, ...rn] = nombre.split(' ');
        const [pa, ...ra] = apellido.split(' ');
        primerNombre = pn; segundoNombre = rn.join(' ') || null;
        primerApellido = pa; segundoApellido = ra.join(' ') || null;
      }
      const rolFila = row.rol || row.Rol || row.ROL || row.puesto || row.Puesto || row.cargo || row.Cargo || null;
      const rolFinal = normalizarRol(rolFila) || normalizarRol(rolGlobal) || 'medico';
      if (!cedula || !primerNombre) { errores++; continue; }
      if (cedulasExistentes.has(cedula)) { omitidos++; continue; }
      const password_hash = await bcrypt.hash(crypto.randomBytes(6).toString('hex'), 10);
      const sedeFinal = row.id_sede || row.sede || sedeToken;
      const idConsultorio = row.id_consultorio || row.consultorio_id || null;
      const idServicio = row.id_servicio || row.servicio_id || null;
      const idEspecialidad = row.id_especialidad || row.especialidad_id || null;
      await usuarioRepo.crearPersonal({
        cedula, primer_nombre: primerNombre, segundo_nombre: segundoNombre,
        primer_apellido: primerApellido || '', segundo_apellido: segundoApellido,
        telefono: telefono || '', email: email || null, password_hash, rol: rolFinal,
        id_consultorio: idConsultorio ? Number(idConsultorio) : null,
        id_servicio: idServicio ? Number(idServicio) : null,
        id_especialidad: idEspecialidad ? Number(idEspecialidad) : null,
        sede: Number(sedeFinal), status: row.status !== undefined ? !!row.status : true,
      });
      importados++;
    } catch (error) {
      logger.error('Error al importar personal:', { error: error.message, row });
      errores++;
    }
  }
  res.json({ mensaje: `Importación completada: ${importados}, ${omitidos} ya existían, ${errores} errores`, importados, omitidos, errores });
};

module.exports = { getPersonal, crearPersonal, actualizarPersonal, eliminarPersonal, importarPersonal };
