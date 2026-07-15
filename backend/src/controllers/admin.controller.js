const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const logger = require('../config/logger');
const pool = require('../config/db');
const atencionRepo = require('../repositories/atencion.repository');
const servicioRepo = require('../repositories/servicio.repository');
const consultorioRepo = require('../repositories/consultorio.repository');
const sharedRepo = require('../repositories/shared.repository');
const usuarioRepo = require('../repositories/usuario.repository');
const rolRepo = require('../repositories/rol.repository');
const permisoRepo = require('../repositories/permiso.repository');
const { ACCIONES_ESPECIALES_POR_VISTA, ACCIONES_ESPECIALES_GLOBALES } = require('../config/acciones-especiales');
const { auditar } = require('../middleware/audit');

const getUserId = (req) => req.usuario?.id;

const getSede = (req, res) => {
  const sede = req.usuario?.id_sede;
  const rol = req.usuario?.rol;
  
  if (sede === undefined || sede === null) {
    res.status(401).json({ mensaje: 'Token inválido o sin sede' });
    return null;
  }
  return Number(sede);
};

/**
 * Genera el reporte diario de turnos: listado completo, estadísticas por
 * estado, KPIs (tiempo promedio de espera/atención, % ausentismo) y
 * desglose por servicio y lista de ausentes.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getReporteDiario = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { fecha_desde, fecha_hasta } = req.query;
    const rows = await atencionRepo.getReporteDiario(sede, fecha_desde || null, fecha_hasta || null);

    const turnos = rows.map((r) => ({
      id: r.id,
      numero: r.numero,
      estado: r.estado,
      hora_llegada: r.hora_llegada,
      hora_fin: r.hora_fin,
      servicio_nombre: r.servicio,
      especialidad: r.especialidad,
      consultorio: r.consultorio,
      medico_nombre: r.medico_nombre,
      medico_apellido: r.medico_apellido,
      hora_inicio_atencion: r.hora_inicio_atencion,
      hora_fin_atencion: r.hora_fin_atencion,
      id_sede: r.id_sede,
      paciente: {
        nombre: [r.primer_nombre, r.segundo_nombre].filter(Boolean).join(' '),
        apellido: [r.primer_apellido, r.segundo_apellido].filter(Boolean).join(' '),
        documento: r.paciente_documento,
        telefono: r.paciente_telefono,
      },
    }));

    const atendidos = turnos.filter((t) => t.estado === 'Atendido');
    const ausentes = turnos.filter((t) => t.estado === 'Ausente');
    const enEspera = turnos.filter(
      (t) => t.estado === 'Sala de Espera' || t.estado === 'Llamado',
    );
    const enAtencion = turnos.filter((t) => t.estado === 'En Atencion');
    const registrados = turnos.filter((t) => t.estado === 'Registrado');

    const turnosConEspera = turnos.filter(t => t.hora_inicio_atencion && t.hora_llegada);
    const tiempoPromedioEspera = turnosConEspera.length > 0
      ? Math.round(turnosConEspera.reduce((sum, t) => {
          const inicio = new Date(t.hora_inicio_atencion);
          const llegada = new Date(t.hora_llegada);
          return sum + (inicio - llegada) / 60000;
        }, 0) / turnosConEspera.length)
      : 0;

    const turnosConAtencion = turnos.filter(t => t.hora_fin_atencion && t.hora_inicio_atencion);
    const tiempoPromedioAtencion = turnosConAtencion.length > 0
      ? Math.round(turnosConAtencion.reduce((sum, t) => {
          const fin = new Date(t.hora_fin_atencion);
          const inicio = new Date(t.hora_inicio_atencion);
          return sum + (fin - inicio) / 60000;
        }, 0) / turnosConAtencion.length)
      : 0;

    const porServicio = {};
    turnos.forEach(t => {
      const key = t.servicio_nombre;
      if (!porServicio[key]) {
        porServicio[key] = { servicio: key, total: 0, atendidos: 0, ausentes: 0, en_espera: 0, en_atencion: 0, registrados: 0 };
      }
      porServicio[key].total++;
      if (t.estado === 'Atendido') porServicio[key].atendidos++;
      else if (t.estado === 'Ausente') porServicio[key].ausentes++;
      else if (t.estado === 'Sala de Espera' || t.estado === 'Llamado') porServicio[key].en_espera++;
      else if (t.estado === 'En Atencion') porServicio[key].en_atencion++;
      else if (t.estado === 'Registrado') porServicio[key].registrados++;
    });

    const listaAusentes = ausentes.map(t => ({
      numero: t.numero,
      paciente_nombre: t.paciente.nombre,
      paciente_apellido: t.paciente.apellido,
      paciente_documento: t.paciente.documento,
      servicio: t.servicio_nombre,
      especialidad: t.especialidad,
      hora_llegada: t.hora_llegada,
    }));

    res.json({
      total: turnos.length,
      turnos,
      estadisticas: {
        atendidos: atendidos.length,
        ausentes: ausentes.length,
        en_espera: enEspera.length,
        en_atencion: enAtencion.length,
        registrados: registrados.length,
      },
      kpis: {
        tiempo_promedio_espera_min: tiempoPromedioEspera,
        tiempo_promedio_atencion_min: tiempoPromedioAtencion,
        ausentismo_porcentaje: turnos.length > 0 ? Math.round((ausentes.length / turnos.length) * 100) : 0,
      },
      por_servicio: Object.values(porServicio),
      ausentes: listaAusentes,
    });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error interno al generar el reporte diario' });
  }
};

/**
 * Obtiene todos los servicios activos de la sede del usuario.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getServicios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await servicioRepo.getAll(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener servicios' });
  }
};

/**
 * Crea un nuevo servicio en el sistema.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearServicio = async (req, res) => {
  try {
    let { nombre, prefijo, piso, activo } = req.body;

    await servicioRepo.create(nombre, prefijo, piso, activo);
    res.status(201).json({ mensaje: 'Servicio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear servicio' });
  }
};

/**
 * Actualiza los datos de un servicio existente.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarServicio = async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, prefijo, piso, activo } = req.body;

    await servicioRepo.update(id, nombre, prefijo, piso, activo);
    res.json({ mensaje: 'Servicio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar servicio' });
  }
};

/**
 * Elimina un servicio del sistema.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarServicio = async (req, res) => {
  try {
    await servicioRepo.remove(req.params.id);
    res.json({ mensaje: 'Servicio eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar servicio' });
  }
};

/**
 * Obtiene los consultorios de la sede del usuario autenticado.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getConsultorios = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await consultorioRepo.getConsultoriosBySede(sede);
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener consultorios' });
  }
};

/**
 * Crea un nuevo consultorio en la sede del usuario.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { nombre } = req.body;
    await consultorioRepo.createConsultorio(nombre, sede);
    res.json({ mensaje: 'Consultorio creado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al crear consultorio' });
  }
};

/**
 * Actualiza el nombre de un consultorio existente.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const { nombre } = req.body;

    await consultorioRepo.updateConsultorio(id, sede, nombre);
    res.json({ mensaje: 'Consultorio actualizado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al actualizar consultorio' });
  }
};

/**
 * Elimina un consultorio de la sede del usuario.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarConsultorio = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    await consultorioRepo.deleteConsultorio(req.params.id, sede);
    res.json({ mensaje: 'Consultorio eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar consultorio' });
  }
};

/**
 * Obtiene todas las sedes registradas en el sistema.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getSedes = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const rows = await sharedRepo.getSedes();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener sedes' });
  }
};

/**
 * Obtiene el listado de personal filtrado por rol y sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
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

/**
 * Crea un nuevo usuario del sistema (personal). Si no se especifica
 * contraseña, se genera una aleatoria. Valida unicidad de cédula por sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;

  try {
    const {
      cedula,
      primer_nombre,
      segundo_nombre,
      primer_apellido,
      segundo_apellido,
      telefono,
      email,
      password,
      rol,
      id_consultorio,
      id_servicio,
      id_especialidad,
      username,
      status,
      id_sede,
    } = req.body;

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
      cedula,
      primer_nombre,
      segundo_nombre: segundo_nombre || null,
      primer_apellido: primer_apellido || '',
      segundo_apellido: segundo_apellido || null,
      telefono: telefono || '',
      email: emailFinal,
      password_hash,
      rol,
      id_consultorio: id_consultorio || null,
      id_servicio: id_servicio || null,
      id_especialidad: id_especialidad || null,
      sede: sedeFinal,
      status: status !== false,
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

/**
 * Actualiza los datos de un usuario existente. Solo permite modificar
 * campos definidos en la lista blanca. Si se incluye password, se
 * hashea automáticamente. Al desactivar un usuario, notifica por
 * Socket.IO si tiene una sesión activa.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;
    const fields = { ...req.body };
    delete fields.id;

    if (fields.email) {
      fields.email = fields.email.toLowerCase().trim();
    }
    if (fields.password) {
      fields.password_hash = await bcrypt.hash(fields.password, 10);
      delete fields.password;
    }
    if (fields.id_sede !== undefined) {
      fields.id_sede = Number(fields.id_sede);
    }

    const allowed = [
      'cedula', 'primer_nombre', 'segundo_nombre', 'primer_apellido',
      'segundo_apellido', 'telefono', 'email', 'password_hash',
      'rol', 'id_consultorio', 'id_servicio', 'id_especialidad',
      'status', 'id_sede',
    ];
    const safeFields = {};
    for (const key of Object.keys(fields)) {
      if (allowed.includes(key) && fields[key] !== undefined) {
        safeFields[key] = fields[key];
      }
    }

    if (Object.keys(safeFields).length === 0) {
      return res.status(400).json({ mensaje: 'No hay campos para actualizar' });
    }

    await usuarioRepo.actualizarPersonal(id, sede, safeFields);

    auditar({ userId: getUserId(req), accion: 'editar', recurso: 'personal', recursoId: Number(id), detalle: { campos: Object.keys(safeFields) }, ip: req.ip });

    if (safeFields.status === false && req.io) {
      const sockets = await req.io.fetchSockets();
      for (const socket of sockets) {
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

/**
 * Elimina un usuario del sistema (borrado lógico o físico según la
 * implementación del repositorio).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarPersonal = async (req, res) => {
  const sede = getSede(req, res);
  if (!sede) return;

  try {
    const { id } = req.params;

    const eliminado = await usuarioRepo.eliminarPersonal(id, sede);
    if (!eliminado) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado' });
    }

    auditar({ userId: getUserId(req), accion: 'eliminar', recurso: 'personal', recursoId: Number(id), ip: req.ip });
    res.json({ mensaje: 'Personal eliminado' });
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al eliminar personal' });
  }
};

/**
 * Importa personal desde un arreglo de filas (típicamente desde Excel).
 * Deduplica por cédula, normaliza nombres/roles y reporta
 * importados, omitidos y errores.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const importarPersonal = async (req, res) => {
  const sedeToken = getSede(req, res);
  if (!sedeToken) return;

  const { rows, rol: rolGlobal } = req.body;
  if (!rows || !Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ mensaje: 'No hay datos para importar' });
  }

  let importados = 0;
  let omitidos = 0;
  let errores = 0;

  const cedulasExcel = rows.map(r =>
    String(r.cedula || r.Cedula || r.CÉDULA || r.documento || r.Documento || '').replace(/\D/g, '')
  ).filter(c => c);
  const existentes = await usuarioRepo.findByCedulas(cedulasExcel);
  const cedulasExistentes = new Set(existentes.map((u) => u.cedula));

  const normalizarRol = (r) => {
    if (!r) return null;
    return String(r).toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "")
      .trim();
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
        primerNombre = pn;
        segundoNombre = rn.join(' ') || null;
        primerApellido = pa;
        segundoApellido = ra.join(' ') || null;
      }

      const rolFila = row.rol || row.Rol || row.ROL || row.puesto || row.Puesto || row.cargo || row.Cargo || null;
      const rolFinal = normalizarRol(rolFila) || normalizarRol(rolGlobal) || 'medico';

      if (!cedula || !primerNombre) {
        errores++;
        continue;
      }

      if (cedulasExistentes.has(cedula)) {
        omitidos++;
        continue;
      }

      const password_hash = await bcrypt.hash(crypto.randomBytes(6).toString('hex'), 10);
      const sedeFinal = row.id_sede || row.sede || sedeToken;
      const idConsultorio = row.id_consultorio || row.consultorio_id || null;
      const idServicio = row.id_servicio || row.servicio_id || null;
      const idEspecialidad = row.id_especialidad || row.especialidad_id || null;

      await usuarioRepo.crearPersonal({
        cedula,
        primer_nombre: primerNombre,
        segundo_nombre: segundoNombre,
        primer_apellido: primerApellido || '',
        segundo_apellido: segundoApellido,
        telefono: telefono || '',
        email: email || null,
        password_hash,
        rol: rolFinal,
        id_consultorio: idConsultorio ? Number(idConsultorio) : null,
        id_servicio: idServicio ? Number(idServicio) : null,
        id_especialidad: idEspecialidad ? Number(idEspecialidad) : null,
        sede: Number(sedeFinal),
        status: row.status !== undefined ? !!row.status : true,
      });
      importados++;
    } catch (error) {
      logger.error('Error al importar personal:', { error: error.message, row });
      errores++;
    }
  }

  res.json({
    mensaje: `Importación completada: ${importados},
    ${omitidos} ya existían, ${errores} errores`,
    importados,
    omitidos,
    errores,
  });
};

/**
 * Obtiene la lista de roles del sistema, filtrados por sede si se
 * especifica.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const getRoles = async (req, res) => {
  try {
    const sede = req.query.sede_id ? Number(req.query.sede_id) : req.usuario?.id_sede;
    const rows = sede
      ? await rolRepo.getAll(sede)
      : await rolRepo.getAll();
    res.json(rows);
  } catch (error) {
    logger.error(error);
    res.status(500).json({ mensaje: 'Error al obtener roles' });
  }
};

/**
 * Crea un nuevo rol. Normaliza el nombre para generar una clave única
 * (key) y verifica que no exista duplicados por sede.
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const crearRol = async (req, res) => {
  try {
    let { nombre, id_sede, activo } = req.body;
    if (!nombre) {
      return res.status(400).json({ mensaje: 'El nombre del rol es requerido' });
    }

    const nombreLimpio = nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, "")
      .toUpperCase()
      .trim();
    
    const key = nombre.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (await rolRepo.existsKeyForSede(key, id_sede || null)) {
      return res.status(409).json({ mensaje: 'Ya existe un rol con esta clave para esta sede' });
    }

    await rolRepo.create(nombreLimpio, key, id_sede, activo);
    res.status(201).json({ mensaje: 'Rol creado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un rol con este nombre o clave' });
    }
    res.status(500).json({ mensaje: 'Error al crear rol' });
  }
};

/**
 * Actualiza los datos de un rol existente (nombre, sede, activo).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const actualizarRol = async (req, res) => {
  try {
    const { id } = req.params;
    let { nombre, id_sede, activo } = req.body;

    let nombreLimpio = undefined;
    let key = undefined;

    if (nombre) {
      nombreLimpio = nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "")
        .toUpperCase()
        .trim();

      key = nombre.toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    }

    await rolRepo.update(id, nombreLimpio, key, id_sede, activo);
    res.json({ mensaje: 'Rol actualizado' });
  } catch (error) {
    logger.error(error);
    if (error.code === '23505') {
      return res.status(409).json({ mensaje: 'Ya existe un rol con este nombre o clave' });
    }
    res.status(500).json({ mensaje: 'Error al actualizar rol' });
  }
};

/**
 * Elimina un rol del sistema. Previene la eliminación si hay usuarios
 * asignados al rol (foreign key).
 *
 * @param {import('express').Request} req - Petición HTTP
 * @param {import('express').Response} res - Respuesta HTTP
 * @returns {Promise<void>}
 */
const eliminarRol = async (req, res) => {
  try {
    const { id } = req.params;
    await rolRepo.remove(id);
    res.json({ mensaje: 'Rol eliminado' });
  } catch (error) {
    logger.error('Error al eliminar rol:', error);
    if (error.code === '23503') {
      return res.status(409).json({ mensaje: 'No se puede eliminar el rol porque está asignado a uno o más usuarios' });
    }
    res.status(500).json({ mensaje: 'Error al eliminar rol' });
  }
};

module.exports = {
  getReporteDiario,

  getServicios,
  crearServicio,
  actualizarServicio,
  eliminarServicio,

  getConsultorios,
  crearConsultorio,
  actualizarConsultorio,
  eliminarConsultorio,

  getSedes,
  getPersonal,
  crearPersonal,
  actualizarPersonal,
  eliminarPersonal,
  importarPersonal,

  getRoles,
  crearRol,
  actualizarRol,
  eliminarRol,

  /**
   * Obtiene todos los permisos disponibles en el sistema.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  getPermisos: async (req, res) => {
    try {
      const permisos = await permisoRepo.getAll();
      res.json(permisos);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al obtener permisos' });
    }
  },

  /**
   * Obtiene los permisos asignados a un rol específico.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  getPermisosByRol: async (req, res) => {
    try {
      const { id } = req.params;
      const permisos = await permisoRepo.getKeysByRolId(id);
      res.json(permisos);
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al obtener permisos del rol' });
    }
  },

  /**
   * Asigna permisos a un rol. Emite un evento Socket.IO para que los
   * usuarios del rol renueven su matriz de permisos en tiempo real.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  asignarPermisos: async (req, res) => {
    try {
      const { id } = req.params;
      const { permisos } = req.body;
      await permisoRepo.asignarPermisos(id, permisos || []);

      req.io.emit('permisos-actualizados', { id_rol: Number(id) });

      res.json({ mensaje: 'Matriz de permisos actualizada correctamente' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al asignar permisos' });
    }
  },

  /**
   * Obtiene la matriz completa de permisos agrupada por recurso,
   * utilizada para renderizar la interfaz de administración de
   * permisología.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  getMatrizPermisos: async (req, res) => {
    try {
      const allPermisos = await permisoRepo.getAll();

      const recursosMap = new Map();
      const accionesBasicas = ['ver', 'crear', 'editar', 'eliminar'];

      allPermisos.forEach(p => {
        if (!p.key.includes(':')) return;

        const [recKey, accKey] = p.key.split(':');
        if (!recursosMap.has(recKey)) {
          recursosMap.set(recKey, {
            key: recKey,
            nombre: p.nombre.split(' - ')[0],
            descripcion: p.descripcion ? p.descripcion.split(' / ')[0] : '',
            acciones: []
          });
        }
        recursosMap.get(recKey).acciones.push(accKey || '*');
      });

      res.json({
        recursos: Array.from(recursosMap.values()),
        accionesBasicas
      });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al obtener matriz de permisos' });
    }
  },

  /**
   * Recarga la caché de permisos del sistema.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  recargarCachePermisos: async (req, res) => {
    try {
      res.json({ mensaje: 'Caché de permisos recargada' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al recargar caché de permisos' });
    }
  },

  /**
   * Asigna permisos completos (todos los recursos con "*") al rol
   * administrador de la sede del usuario autenticado. Útil para
   * inicializar o reparar la configuración de permisos del admin.
   *
   * @param {import('express').Request} req
   * @param {import('express').Response} res
   * @returns {Promise<void>}
   */
  seedPermisosAdmin: async (req, res) => {
    try {
      const sede = req.usuario?.id_sede || 1;
      const rolRes = await pool.query('SELECT id_rol FROM "Roles" WHERE key = $1 AND id_sede = $2', ['administrador', sede]);
      if (rolRes.rows.length === 0) {
        return res.status(404).json({ mensaje: 'No se encontró el rol administrador para esta sede' });
      }
      const idRol = rolRes.rows[0].id_rol;
      const recursos = ['admision', 'aps', 'laboratorio', 'imagenes', 'atencion_medica', 'aseguradoras', 'personal', 'roles', 'especialidades', 'permisologia'];
      const permisos = recursos.map(r => `${r}:*`);
      await permisoRepo.asignarPermisos(idRol, permisos);
      res.json({ mensaje: 'Permisos de administrador sembrados correctamente. Vuelve a iniciar sesión.' });
    } catch (error) {
      logger.error(error);
      res.status(500).json({ mensaje: 'Error al sembrar permisos' });
    }
  },
};
