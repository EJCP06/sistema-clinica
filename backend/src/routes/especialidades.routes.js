/**
 * Rutas de especialidades médicas (CRUD + importación Excel).
 *
 * La lectura (GET /) está abierta a varios módulos porque admisión y atención
 * necesitan listar especialidades; las escrituras requieren permisos
 * específicos ('especialidades:crear' | 'editar' | 'eliminar').
 */
const express = require('express');
const { body, param, validationResult } = require('express-validator');
const router = express.Router();
const espController = require('../controllers/especialidades.controller');
const { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad } = espController;
const auth = require('../middleware/auth');
const { permissionMiddleware: perm } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.get('/', auth, perm('especialidades:ver', 'especialidades:crear', 'especialidades:editar', 'especialidades:eliminar', 'admision:*', 'aps:ver', 'laboratorio:*', 'imagenes:*', 'atencion_medica:*'), getEspecialidades);
router.post('/', auth, perm('especialidades:crear'), [
  body('nombre').trim().notEmpty().withMessage('El nombre es obligatorio'),
  body('id_servicio').isInt().withMessage('El servicio es obligatorio'),
  validar,
], createEspecialidad);
router.put('/:id', auth, perm('especialidades:editar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], updateEspecialidad);
router.delete('/:id', auth, perm('especialidades:eliminar'), [
  param('id').isInt().withMessage('ID inválido'),
  validar,
], deleteEspecialidad);

router.post('/importar', auth, perm('especialidades:crear'), espController.importarEspecialidades);

module.exports = router;
