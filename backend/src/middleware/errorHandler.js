const errorHandler = (error, req, res, next) => {
  console.error('Errore applicativo:', error);

  if (res.headersSent) {
    return next(error);
  }

  if (error.message?.includes('Environment variable not found: DATABASE_URL')) {
    return res.status(500).json({
      error: 'DATABASE_URL non configurato. Imposta backend/.env e avvia PostgreSQL.'
    });
  }

  return res.status(error.statusCode || 500).json({
    error: error.message || 'Errore interno del server'
  });
};

module.exports = errorHandler;
