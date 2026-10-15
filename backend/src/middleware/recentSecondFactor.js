const { RECENT_MS } = require('../controllers/twoFactorControllers');

module.exports = (req, res, next) => {
  const verifiedAt = req.session?.secondFactorVerifiedAt;
  if (!req.user?.totpEnabledAt) {
    return res.status(403).json({ error: 'Attiva il secondo fattore per questa operazione', mfaSetupRequired: true });
  }
  if (!verifiedAt || Date.now() - verifiedAt.getTime() > RECENT_MS || verifiedAt > new Date()) {
    return res.status(403).json({ error: 'Verifica recente del secondo fattore richiesta', mfaStepUpRequired: true });
  }
  return next();
};
