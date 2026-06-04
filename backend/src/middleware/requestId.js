const { v4: uuidv4 } = require('uuid');

const requestIdMiddleware = (req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-Id', req.id);
  next();
};

module.exports = requestIdMiddleware;