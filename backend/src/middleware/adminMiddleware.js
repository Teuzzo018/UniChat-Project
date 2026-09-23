const adminMiddleware = (req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Accesso riservato agli amministratori' });
  }

  next();
};

module.exports = adminMiddleware;
