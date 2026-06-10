const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

const payload = {
  id: 2,
  cedula: '31693727',
  nombre: 'EDWARD',
  rol: 'administrador',
  id_sede: 1
};

const token = jwt.sign(payload, process.env.JWT_SECRET);
console.log('Token for Edward (Sede 1):', token);
console.log('Payload:', payload);
