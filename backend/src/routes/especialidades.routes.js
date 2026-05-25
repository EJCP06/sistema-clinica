const express = require('express');
const router = express.Router();
const { getEspecialidades, createEspecialidad, updateEspecialidad, deleteEspecialidad } = require('../controllers/especialidades.controller');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

router.get('/', auth, getEspecialidades);
router.post('/', auth, roles(['admin']), createEspecialidad);
router.put('/:id', auth, roles(['admin']), updateEspecialidad);
router.delete('/:id', auth, roles(['admin']), deleteEspecialidad);

module.exports = router;
