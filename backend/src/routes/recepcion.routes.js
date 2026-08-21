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
router.get('/pacientes/:termino', ctrl.buscarPaciente);
router.post('/pacientes', [
  body('cedula').trim().notEmpty().withMessage('La cédula del paciente es obligatoria'),
  body('primer_nombre').trim().notEmpty().withMessage('El primer nombre es obligatorio'),
  body('primer_apellido').trim().notEmpty().withMessage('El primer apellido es obligatorio'),
  validar,
], ctrl.crearPaciente);
router.put('/pacientes/:id', [
  body('cedula').optional().trim().notEmpty().withMessage('La cédula no puede estar vacía'),
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
