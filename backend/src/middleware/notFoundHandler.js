/**
 * ============================================================================
 * MIDDLEWARE ROTTE NON TROVATE (notFoundHandler.js)
 * 1. Risposta 404: gestione uniforme degli endpoint inesistenti
 * ============================================================================
 */
const notFoundHandler = (req, res) => {
  res.status(404).json({
    error: 'Endpoint non trovato',
    path: req.originalUrl
  });
};

module.exports = notFoundHandler;
