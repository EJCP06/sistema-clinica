/**
 * Rutas de recepción/admisión.
 *
 * Cubre: gestión de pacientes (buscar, crear, actualizar, eliminar), generación
 * de turnos, actualización de atenciones y los llamados por voz hacia los
 * módulos (APS, Laboratorio, Imágenes).
 *
 * Estructura de permisos:
 *   - El grueso del router requiere los conjuntos ADMISION_TOTAL /
 *     LABORATORIO_TOTAL / IMAGENES_TOTAL (definidos en permission-sets.js).
 *   - Los llamados por voz (llamar-aps, llamar-clave, llamar-laboratorio,
 *     llamar-imagenes) usan control por ROL (analista/coordinador/admin,
 *     + laboratorio/imagenes en su propio módulo) porque el técnico de
 *     laboratorio no tiene permisos de admisión.
 *   - marcar_ausente permite además al rol coordinador directamente.
 */
const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const ctrl = require('../controllers/recepcion.controller');
const auth = require('../middleware/auth');
const { permissionMiddleware: perm } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);

router.get('/ultimas-admisiones', perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL'
), ctrl.getUltimasAdmisiones);

router.get('/responsables-pago', perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL'
), ctrl.getResponsablesPago);

// Llamados por voz hacia los módulos (APS, Laboratorio, Imágenes):
// restringidos por rol (analista / coordinador / administrador) y sin
// depender de los permisos de admisión del resto de rutas del módulo.
// Cada ruta permite los roles que operan ese módulo: analista, coordinador
// y administrador en todos; el técnico de laboratorio/imágenes solo en su
// propio módulo.
const permitirLlamado = (rolesPermitidos) => (req, res, next) => {
  const rol = req.usuario && req.usuario.rol;
  if (rolesPermitidos.includes(rol)) return next();
  return res.status(403).json({ mensaje: 'No tienes permisos para realizar esta acción' });
};

const rolesModulos = ['analista', 'coordinador', 'administrador'];

// Primer llamado hacia APS (paciente Registrado).
router.post('/atencion/:id/llamar-aps', permitirLlamado(rolesModulos), ctrl.llamarAPS);

// Segundo llamado hacia APS (aseguradora con clave aprobada, estado
// Espera de Clave): mismo criterio de rol que el primer llamado.
router.post('/atencion/:id/llamar-clave', permitirLlamado(rolesModulos), ctrl.llamarClaveAPS);

// Llamado hacia Laboratorio / Imágenes (pacientes particulares registrados).
router.post('/atencion/:id/llamar-laboratorio', permitirLlamado([...rolesModulos, 'laboratorio']), ctrl.llamarLaboratorio);
router.post('/atencion/:id/llamar-imagenes', permitirLlamado([...rolesModulos, 'imagenes']), ctrl.llamarImagenes);

// Llamado por voz desde Sala de Espera (estado 3) — anuncia sin cambiar estado.
router.post('/atencion/:id/llamar-laboratorio-se', permitirLlamado([...rolesModulos, 'laboratorio']), ctrl.llamarLaboratorioSalaEspera);
router.post('/atencion/:id/llamar-imagenes-se', permitirLlamado([...rolesModulos, 'imagenes']), ctrl.llamarImagenesSalaEspera);

// Anuncio general por voz en el turnero (megáfono): recordatorio de
// silencio lanzado desde los módulos APS, Laboratorio e Imágenes.
// No cambia estados. Cada módulo lo lanza con sus propios roles.
router.post('/anuncio-silencio', permitirLlamado([...rolesModulos, 'laboratorio', 'imagenes']), ctrl.anunciarSilencio);

router.use(perm(
  'ADMISION_TOTAL',
  'LABORATORIO_TOTAL',
  'IMAGENES_TOTAL',
  // El analista (APS) edita pacientes desde su módulo con aps:editar,
  // y los técnicos de laboratorio/imágenes con laboratorio:editar / imagenes:editar.
  'aps:editar',
  'laboratorio:editar',
  'imagenes:editar'
));

// Datos del registro de pacientes: representante. El representante solo llega
// cuando el checkbox "menor de edad" del frontend está marcado; en ese caso
// nombre y parentesco son obligatorios. La cédula del niño se envía armada
// ('31693727-1').
const validacionesRepresentante = [
  // Documento del representante: cédula de 6 a 8 dígitos o pasaporte de 10 a 12
  // caracteres (el tipo V/E/P se guarda en "tipo_documento" del paciente).
  body('cedula_representante').optional({ values: 'null' }).trim().matches(/^(\d{6,8}|[A-Za-z0-9]{10,12})$/).withMessage('El documento del representante debe ser una cédula de 6 a 8 dígitos o un pasaporte de 10 a 12 caracteres'),
  body('numero_hijo').optional({ values: 'null' }).trim().isInt({ min: 1, max: 99 }).withMessage('El número de hijo debe ser un número entre 1 y 99'),
  body('nombre_representante').optional({ values: 'null' }).trim().notEmpty().withMessage('El nombre del representante no puede estar vacío'),
  body('parentesco_representante').optional({ values: 'null' }).trim().notEmpty().withMessage('El parentesco del representante no puede estar vacío'),
  body().custom((_, { req }) => {
    const conRepresentante = (req.body.cedula_representante || '').toString().trim() !== '';
    if (conRepresentante) {
      if (!(req.body.nombre_representante || '').toString().trim()) throw new Error('El nombre del representante es obligatorio');
      if (!(req.body.parentesco_representante || '').toString().trim()) throw new Error('El parentesco del representante es obligatorio');
      const hijo = parseInt(req.body.numero_hijo, 10);
      if (!hijo || hijo < 1) throw new Error('El número de hijo es obligatorio (ej: 1 para el primer hijo)');
      // Integridad: la cédula del niño debe ser '<cedula_representante>-<numero_hijo>'.
      const cedula = (req.body.cedula || '').toString().trim();
      const esperada = `${(req.body.cedula_representante || '').toString().trim()}-${hijo}`;
      if (cedula && cedula !== esperada) throw new Error(`La cédula del menor debe ser ${esperada}`);
    }
    return true;
  }),
];

// Cédula venezolana válida: de 6 a 8 dígitos o, en menores de edad, la cédula
// armada '<cedula_representante>-<numero_hijo>' (ej: 31693727-1).
// Solo se valida cuando el cliente envía tipo_documento = 'v' (los pasaportes
// y documentos de extranjero no se tocan, y los módulos que no envían el tipo
// quedan sin esta comprobación).
const cedulaVenezolana = (cedula, { req }) => {
  const tipo = (req.body.tipo_documento || '').toString().trim().toLowerCase();
  if (tipo !== 'v') return true;
  if (!/^\d{6,8}(-\d{1,2})?$/.test(cedula)) {
    throw new Error('La cédula debe tener de 6 a 8 dígitos (los menores usan el formato 31693727-1)');
  }
  return true;
};

router.get('/pacientes/:termino', ctrl.buscarPaciente);
// Alta de paciente desde recepción: TODOS los campos del modal son obligatorios.
router.post('/pacientes', [
  body('cedula').trim().notEmpty().withMessage('La cédula del paciente es obligatoria').custom(cedulaVenezolana),
  body('tipo_documento').optional().isIn(['v', 'e', 'p', 'V', 'E', 'P']).withMessage('Tipo de documento inválido'),
  body('primer_nombre').trim().notEmpty().withMessage('El primer nombre es obligatorio'),
  body('segundo_nombre').trim().notEmpty().withMessage('El segundo nombre es obligatorio'),
  body('primer_apellido').trim().notEmpty().withMessage('El primer apellido es obligatorio'),
  body('segundo_apellido').trim().notEmpty().withMessage('El segundo apellido es obligatorio'),
  body('sexo').isIn(['M', 'F']).withMessage('Debe seleccionar el sexo'),
  body('estado_civil').isIn(['S', 'C', 'V', 'D']).withMessage('Debe seleccionar el estado civil'),
  body('telefono').trim().matches(/^\d{11,12}$/).withMessage('El teléfono debe tener entre 11 y 12 dígitos'),
  body('email').optional({ values: 'falsy' }).trim().isEmail().withMessage('El correo electrónico no es válido'),
  body('direccion').trim().notEmpty().withMessage('La dirección es obligatoria'),
  ...validacionesRepresentante,
  validar,
], ctrl.crearPaciente);
router.put('/pacientes/:id', [
  body('cedula').optional().trim().notEmpty().withMessage('La cédula no puede estar vacía').custom(cedulaVenezolana),
  body('tipo_documento').optional().isIn(['v', 'e', 'p', 'V', 'E', 'P']).withMessage('Tipo de documento inválido'),
  body('sexo').optional({ values: 'null' }).isIn(['M', 'F']).withMessage('Sexo inválido'),
  body('estado_civil').optional({ values: 'null' }).isIn(['S', 'C', 'V', 'D']).withMessage('Estado civil inválido'),
  ...validacionesRepresentante,
  validar,
], ctrl.actualizarPaciente);
router.delete('/pacientes/:id', ctrl.eliminarPaciente);
router.post('/generar-turno', [
  body('id_paciente').isInt().withMessage('El paciente es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], ctrl.generarTurno);
router.put('/atencion/:id', [
  body('id_servicio').optional().isInt().withMessage('Servicio inválido'),
  body('id_responsable').optional().isInt().withMessage('Responsable inválido'),
  body('id_especialidad').optional({ values: 'null' }).isInt().withMessage('Especialidad inválida'),
  validar,
], ctrl.actualizarAtencion);
router.put('/atencion/:id/estado', [
  body('id_estado_nuevo').isInt({ min: 1, max: 9 }).withMessage('Estado inválido'),
  validar,
], ctrl.actualizarEstadoAtencion);
router.delete('/atencion/:id', ctrl.eliminarAtencion);
router.put('/atencion/:id/marcar_ausente', (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'coordinador') return next();
  perm('*:marcar_ausente', 'laboratorio:*', 'imagenes:*')(req, res, next);
}, ctrl.marcarAusente);

// Marcar como AUSENTE (estado 7) — distinto de retirar (estado 9)
router.put('/atencion/:id/marcar-ausente-real', (req, res, next) => {
  if (req.usuario && req.usuario.rol === 'coordinador') return next();
  perm('*:marcar_ausente', 'laboratorio:*', 'imagenes:*')(req, res, next);
}, ctrl.marcarAusente7);

module.exports = router;
