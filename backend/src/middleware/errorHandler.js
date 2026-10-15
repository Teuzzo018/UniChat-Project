const errorHandler = (error, req, res, next) => {
  console.error('Errore applicativo:', error.code || error.name || 'Error');

  if (res.headersSent) {
    return next(error);
  }

  if (error.message?.includes('Environment variable not found: DATABASE_URL')) {
    return res.status(500).json({
      error: 'DATABASE_URL non configurato. Imposta backend/.env e avvia PostgreSQL.'
    });
  }

  const status = error.statusCode || error.status || 500;
  return res.status(status).json({
    error: status === 503 && error.message === 'Chiave TOTP non configurata'
      ? 'Secondo fattore non configurato sul server'
      : status >= 500 ? 'Errore interno del server' : (error.message || 'Richiesta non valida')
  });
};

module.exports = errorHandler;
