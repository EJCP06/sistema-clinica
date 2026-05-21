const express = require('express');
const router = express.Router();
const { getEspecialidades, createEspecialidad } = require('../controllers/especialidades.controller');
const auth = require('../middleware/auth');
const roles = require('../middleware/roles');

router.get('/', auth, getEspecialidades);
router.post('/', auth, roles(['admin']), createEspecialidad);

module.exports = router;
