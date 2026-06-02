const express = require('express');
const router = express.Router();
const turnosController = require('../controllers/turnos.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/', turnosController.getTodosLosTurnos);
router.get('/todos', turnosController.getTodosLosTurnos);
router.post('/', turnosController.crearTurno);
router.put('/:id/ausente', turnosController.marcarAusente);
router.put('/:id/reincorporar', turnosController.reincorporarPaciente);

module.exports = router;
