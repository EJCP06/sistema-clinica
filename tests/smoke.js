// Smoke test for backend + statistics endpoint
const http = require('http');
const { URL } = require('url');

function postJson(port, path, data) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getJson(port, path, token) {
  return new Promise((resolve, reject) => {
    const headers = token ? { 'Authorization': `Bearer ${token}` } : {};
    const options = {
      hostname: 'localhost',
      port: port,
      path: path,
      method: 'GET',
      headers: headers
    };
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function run() {
  try {
    const port = process.env.SMOKE_PORT ? parseInt(process.env.SMOKE_PORT) : 3001;
    // 1) health
    console.log('Health:');
    let r = await getJson(port, '/api/health');
    console.log('status', r.statusCode, 'body', r.body);

    // 2) login
    console.log('Login admin:');
    r = await postJson(port, '/api/auth/login', JSON.stringify({ username: 'admin', password: '123' }));
    if (r.statusCode !== 200) throw new Error('Login failed');
    const login = JSON.parse(r.body);
    const token = login.token;
    console.log('Token length:', token ? token.length : 0);

    // 3) advanced stats
    console.log('Stats avancées:');
    r = await getJson(port, '/api/reportes/avanzadas', token);
    console.log('Status:', r.statusCode);
    console.log('Body starts:', r.body.substring(0, 200));
  } catch (e) {
    console.error('Error during smoke:', e && e.stack ? e.stack : e);
  }
}

run();
