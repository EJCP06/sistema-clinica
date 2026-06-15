const express = require('express');
const { body, validationResult } = require('express-validator');
const router = express.Router();
const medicoController = require('../controllers/medico.controller');
const authMiddleware = require('../middleware/auth');
const { permissionMiddleware: permMiddleware } = require('../middleware/permission');

const validar = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ mensaje: errors.array()[0].msg });
  next();
};

router.use(authMiddleware);
router.use(permMiddleware('atencion_medica:llamar_siguiente', 'atencion_medica:liberar_consultorio'));

router.get('/espera', medicoController.getPacientesEnEspera);
router.get('/atendidos-hoy', medicoController.getAtendidosHoy);
router.post('/llamar', [
  body('id_atencion').isInt().withMessage('ID de atención requerido'),
  validar,
], medicoController.llamarPaciente);
router.post('/finalizar', [
  body('id_atencion').isInt().withMessage('ID de atención requerido'),
  validar,
], medicoController.finalizarAtencion);

module.exports = router;