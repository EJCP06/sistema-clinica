const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
};
jest.mock('../src/config/db', () => mockPool);

const ctrl = require('../src/controllers/turnos.controller');

describe('turnosController', () => {
  let req, res;

  beforeEach(() => {
    req = { body: {}, params: {}, query: {}, usuario: { id_sede: 1, id: 1 } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('marcarAusente', () => {
    test('debe marcar como ausente, liberar consultorio, insertar historial y emitir', async () => {
      req.params = { id: '1' };
      req.io = { emit: jest.fn() };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })                                 // BEGIN
          .mockResolvedValueOnce({ rows: [{ id_consultorio: null }] })         // UPDATE -> 7
          .mockResolvedValueOnce({ rows: [] })                                 // INSERT historial 7
          .mockResolvedValueOnce({ rows: [] }),                                // COMMIT
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      mockPool.query.mockResolvedValue({ rows: [{ id_atencion: 1, numero: 'C-01' }] }); // getAdmisionById (emit)
      await ctrl.marcarAusente(req, res);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Turno marcado como ausente' });
      expect(req.io.emit).toHaveBeenCalled();
      expect(client.query).toHaveBeenCalledTimes(4);
    });

    test('debe ser idempotente: si ya estaba ausente no duplica historial', async () => {
      req.params = { id: '1' };
      req.io = { emit: jest.fn() };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })          // BEGIN
          .mockResolvedValueOnce({ rows: [] })          // UPDATE sin match (ya ausente)
          .mockResolvedValueOnce({ rowCount: 1, rows: [] }) // SELECT 1 (existe)
          .mockResolvedValueOnce({ rows: [] }),         // ROLLBACK
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      await ctrl.marcarAusente(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Turno ya se encontraba marcado como ausente' });
      expect(req.io.emit).not.toHaveBeenCalled();
      // No hubo INSERT de historial (solo BEGIN, UPDATE, SELECT, ROLLBACK)
      expect(client.query).toHaveBeenCalledTimes(4);
    });

    test('debe retornar 404 si el turno no existe', async () => {
      req.params = { id: '999' };
      req.io = { emit: jest.fn() };
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [] })          // BEGIN
          .mockResolvedValueOnce({ rows: [] })          // UPDATE sin match
          .mockResolvedValueOnce({ rowCount: 0, rows: [] }) // SELECT 1 (no existe)
          .mockResolvedValueOnce({ rows: [] }),         // ROLLBACK
        release: jest.fn(),
      };
      mockPool.connect.mockResolvedValue(client);
      await ctrl.marcarAusente(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ mensaje: 'Turno no encontrado' });
    });
  });
});
