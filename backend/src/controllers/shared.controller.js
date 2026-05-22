const testShared = async (req, res) => {
  try {
    res.json({
      ok: true,
      mensaje: 'shared controller funcionando correctamente',
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
};

module.exports = {
  testShared,
};
