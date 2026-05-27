const express = require('express');
const router = express.Router();
const medicoController = require('../controllers/medico.controller');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/roles');

router.use(authMiddleware);
router.use(roleMiddleware('medico', 'admin')); // Permitimos admin para pruebas

router.get('/espera', medicoController.getPacientesEnEspera);
router.get('/atendidos-hoy', medicoController.getAtendidosHoy);
router.post('/llamar', medicoController.llamarPaciente);
router.post('/finalizar', medicoController.finalizarAtencion);

module.exports = router;
