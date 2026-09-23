const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint non trovato',
    path: req.originalUrl
  });
};

module.exports = notFoundHandler;
