const jwt = require('jsonwebtoken');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, 'backend/.env') });

const secret = process.env.JWT_SECRET;
const payload = {
  id: 19,
  cedula: '00000000',
  nombre: 'ADMIN',
  rol: 'admin',
  id_sede: 1
};

const token = jwt.sign(payload, secret, { expiresIn: '1h' });
console.log(token);
