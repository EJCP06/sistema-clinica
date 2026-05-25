const express = require('express');
const router = express.Router();
const sharedController = require('../controllers/shared.controller');
const auth = require('../middleware/auth');

router.use(auth);

router.get('/aseguradoras', sharedController.getAseguradoras);
router.post('/aseguradoras', sharedController.crearAseguradora);

module.exports = router;
