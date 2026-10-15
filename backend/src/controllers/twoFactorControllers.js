const bcrypt = require('bcryptjs');
const env = require('../config/env');
const prisma = require('../lib/prisma');
const { getAdminScope } = require('../lib/adminScope');
const { lockRoles } = require('../lib/roleManagement');
const disconnectUserSockets = require('../utils/disconnectUserSockets');
const {
  encryptSecret, generateEnrollment, generateRecoveryCodes,
  hashRecoveryCode, normalizeRecoveryCode, verifyTotp
} = require('../lib/twoFactor');

const RECENT_MS = 10 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;
const errorResult = (status, error) => ({ status, error });
const send = (res, result) => res.status(result.status).json(result.body || { error: result.error });

const requirePassword = async (req, res) => {
  if (typeof req.body?.password !== 'string' ||
      !await bcrypt.compare(req.body.password, req.user.passwordHash)) {
    res.status(403).json({ error: 'Password non valida' });
    return false;
  }
  return true;
};

const failFactor = async (tx, user) => {
  const attempts = user.mfaFailedAttempts + 1;
  await tx.user.update({ where: { id: user.id }, data: {
    mfaFailedAttempts: attempts >= MAX_FAILURES ? 0 : attempts,
    mfaLockedUntil: attempts >= MAX_FAILURES ? new Date(Date.now() + LOCK_MS) : null
  } });
  return errorResult(401, 'Codice non valido o già utilizzato');
};

const consumeFactor = async (tx, user, code) => {
  if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) {
    return errorResult(429, 'Troppi tentativi. Riprova più tardi.');
  }
  if (typeof code !== 'string' || code.length > 64) return failFactor(tx, user);
  if (/^\d{6}$/.test(code)) {
    const result = await verifyTotp(user.totpSecretEncrypted, code, user.totpLastTimeStep);
    if (!result.valid) return failFactor(tx, user);
    return { status: 200, timeStep: result.timeStep };
  }
  const normalized = normalizeRecoveryCode(code);
  if (!/^[A-F0-9]{32}$/.test(normalized)) return failFactor(tx, user);
  const deleted = await tx.mfaRecoveryCode.deleteMany({
    where: { userId: user.id, codeHash: hashRecoveryCode(normalized) }
  });
  if (deleted.count !== 1) return failFactor(tx, user);
  return { status: 200, recovery: true };
};

const verifySessionFactor = async (req, res, onVerified) => {
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    const session = await tx.session.findUnique({ where: { id: req.session.id } });
    if (!user || user.suspendedAt || !session || !user.totpEnabledAt) {
      return errorResult(403, 'Secondo fattore non disponibile');
    }
    const factor = await consumeFactor(tx, user, req.body?.code);
    if (factor.status !== 200) return factor;
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: {
      mfaFailedAttempts: 0, mfaLockedUntil: null,
      ...(factor.recovery ? {} : { totpLastTimeStep: factor.timeStep })
    } });
    await tx.session.update({ where: { id: session.id }, data: {
      secondFactorPending: false, secondFactorVerifiedAt: now,
      ...(session.secondFactorPending ? { expiresAt: new Date(now.getTime() + env.sessionDurationDays * 86400000) } : {})
    } });
    return onVerified ? onVerified(tx, user, session, factor) : { status: 200, body: {
      message: 'Secondo fattore verificato', verifiedAt: now
    } };
  });
  return send(res, result);
};

const status = async (req, res) => {
  const count = await prisma.mfaRecoveryCode.count({ where: { userId: req.user.id } });
  return res.status(200).json({
    enabled: Boolean(req.user.totpEnabledAt),
    recoveryCodesRemaining: count,
    recent: Boolean(req.session.secondFactorVerifiedAt &&
      Date.now() - req.session.secondFactorVerifiedAt.getTime() <= RECENT_MS)
  });
};

const setup = async (req, res) => {
  if (!await getAdminScope(req.user)) return res.status(403).json({ error: 'Account amministrativo richiesto' });
  if (!await requirePassword(req, res)) return;
  if (req.user.totpEnabledAt) return res.status(409).json({ error: 'Secondo fattore già attivo' });
  const { secret, uri } = await generateEnrollment(req.user.email);
  await prisma.user.update({ where: { id: req.user.id }, data: {
    totpPendingEncrypted: encryptSecret(secret),
    totpPendingExpiresAt: new Date(Date.now() + 10 * 60 * 1000)
  } });
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ secret, uri, expiresInSeconds: 600 });
};

const enable = async (req, res) => {
  const codes = generateRecoveryCodes();
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    if (!user || user.totpEnabledAt || !user.totpPendingEncrypted ||
        !user.totpPendingExpiresAt || user.totpPendingExpiresAt <= new Date()) {
      return errorResult(409, 'Attivazione scaduta o non disponibile');
    }
    if (user.mfaLockedUntil && user.mfaLockedUntil > new Date()) return errorResult(429, 'Troppi tentativi. Riprova più tardi.');
    const verification = await verifyTotp(user.totpPendingEncrypted, req.body?.code, null);
    if (!verification.valid) return failFactor(tx, user);
    const now = new Date();
    await tx.user.update({ where: { id: user.id }, data: {
      totpSecretEncrypted: user.totpPendingEncrypted,
      totpPendingEncrypted: null,
      totpPendingExpiresAt: null,
      totpEnabledAt: now,
      totpLastTimeStep: verification.timeStep,
      mfaFailedAttempts: 0,
      mfaLockedUntil: null
    } });
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((code) => ({
      userId: user.id, codeHash: hashRecoveryCode(code)
    })) });
    await tx.session.update({ where: { id: req.session.id }, data: {
      secondFactorPending: false, secondFactorVerifiedAt: now
    } });
    await tx.session.deleteMany({ where: { userId: user.id, id: { not: req.session.id } } });
    return { status: 200, body: { message: 'Secondo fattore attivato', recoveryCodes: codes } };
  });
  if (result.status === 200) await disconnectUserSockets(req.app, req.user.id);
  res.set('Cache-Control', 'no-store');
  return send(res, result);
};

const verifyLogin = (req, res) => verifySessionFactor(req, res);
const stepUp = (req, res) => verifySessionFactor(req, res);

const disable = async (req, res) => {
  if (!await requirePassword(req, res)) return;
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpEnabledAt) return errorResult(409, 'Secondo fattore non attivo');
    const factor = await consumeFactor(tx, user, req.body?.code);
    if (factor.status !== 200) return factor;
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.user.update({ where: { id: user.id }, data: {
      totpSecretEncrypted: null, totpPendingEncrypted: null, totpPendingExpiresAt: null,
      totpEnabledAt: null, totpLastTimeStep: null, mfaFailedAttempts: 0, mfaLockedUntil: null
    } });
    await tx.session.deleteMany({ where: { userId: user.id, id: { not: req.session.id } } });
    await tx.session.update({ where: { id: req.session.id }, data: { secondFactorVerifiedAt: null } });
    return { status: 200, body: { message: 'Secondo fattore disattivato' } };
  });
  if (result.status === 200) await disconnectUserSockets(req.app, req.user.id);
  return send(res, result);
};

const regenerate = async (req, res) => {
  if (!await requirePassword(req, res)) return;
  const codes = generateRecoveryCodes();
  const result = await prisma.$transaction(async (tx) => {
    await lockRoles(tx);
    const user = await tx.user.findUnique({ where: { id: req.user.id } });
    if (!user || !user.totpEnabledAt) return errorResult(409, 'Secondo fattore non attivo');
    const factor = await consumeFactor(tx, user, req.body?.code);
    if (factor.status !== 200) return factor;
    await tx.mfaRecoveryCode.deleteMany({ where: { userId: user.id } });
    await tx.mfaRecoveryCode.createMany({ data: codes.map((code) => ({
      userId: user.id, codeHash: hashRecoveryCode(code)
    })) });
    await tx.user.update({ where: { id: user.id }, data: {
      mfaFailedAttempts: 0, mfaLockedUntil: null,
      ...(factor.recovery ? {} : { totpLastTimeStep: factor.timeStep })
    } });
    await tx.session.update({ where: { id: req.session.id }, data: { secondFactorVerifiedAt: new Date() } });
    return { status: 200, body: { message: 'Codici rigenerati', recoveryCodes: codes } };
  });
  res.set('Cache-Control', 'no-store');
  return send(res, result);
};

module.exports = { status, setup, enable, verifyLogin, stepUp, disable, regenerate, RECENT_MS };
