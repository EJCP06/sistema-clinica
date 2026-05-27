const request = require('supertest');

describe.skip('Health endpoint (requires DB)', () => {
  let app;

  beforeAll(() => {
    app = require('../index');
  });

  test('GET /api/health debe retornar status ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('status', 'ok');
    expect(res.body).toHaveProperty('message');
  });
});
