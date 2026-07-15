const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const sharedController = require('../controllers/shared.controller');
const auth = require('../middleware/auth');
const { permissionMiddleware: perm } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(auth);

router.get('/aseguradoras', perm('aseguradoras:ver', 'aseguradoras:crear', 'aseguradoras:editar', 'aseguradoras:eliminar', 'aseguradoras:importar_excel', 'admision:*', 'admision:crear', 'aps:ver'), sharedController.getAseguradoras);

router.use(perm('admision:crear', 'aseguradoras:crear', 'aseguradoras:editar', 'aseguradoras:eliminar', 'aseguradoras:importar_excel'));

router.post('/aseguradoras', [
  body('nombre').trim().notEmpty().withMessage('El nombre de la aseguradora es obligatorio'),
  validar,
], sharedController.crearAseguradora);
router.post('/aseguradoras/importar', sharedController.importarAseguradoras);

module.exports = router;
