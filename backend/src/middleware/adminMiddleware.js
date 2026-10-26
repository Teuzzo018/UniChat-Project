/**
 * ============================================================================
 * MIDDLEWARE AUTORIZZAZIONE AMMINISTRATORI (adminMiddleware.js)
 * 1. Protezione rotte admin: verifica che l'utente possieda privilegi di moderatore globale
 * ============================================================================
 */
module.exports = require('../lib/authorization').requireGlobalModerator;
