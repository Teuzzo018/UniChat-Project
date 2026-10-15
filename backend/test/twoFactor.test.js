const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const src = (name) => path.join(__dirname, '../src', name);
const withModules = (stubs, entry) => {
  const saved = new Map();
  for (const [name, exports] of Object.entries(stubs)) {
    const filename = src(name);
    saved.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  }
  const target = src(entry);
  const previous = require.cache[target];
  delete require.cache[target];
  try { return require(target); }
  finally {
    if (previous) require.cache[target] = previous;
    else delete require.cache[target];
    for (const [filename, old] of saved) {
      if (old) require.cache[filename] = old;
      else delete require.cache[filename];
    }
  }
};
const reply = () => ({
  code: 200,
  status(code) { this.code = code; return this; },
  json(body) { this.body = body; return this; },
  set() { return this; }
});
const key = '0123456789abcdef'.repeat(4);
const factor = withModules({ 'config/env.js': { totpEncryptionKey: key } }, 'lib/twoFactor.js');

test('TOTP cifrato: codice valido, scaduto e riutilizzato', async () => {
  const otp = await import('otplib');
  const secret = otp.generateSecret();
  const encrypted = factor.encryptSecret(secret);
  assert.equal(encrypted.includes(secret), false);
  assert.equal(factor.decryptSecret(encrypted), secret);
  const token = await otp.generate({ secret });
  const valid = await factor.verifyTotp(encrypted, token, null);
  assert.equal(valid.valid, true);
  assert.equal((await factor.verifyTotp(encrypted, token, valid.timeStep)).valid, false);
  const expired = await otp.generate({ secret, epoch: Math.floor(Date.now() / 1000) - 90 });
  assert.equal((await factor.verifyTotp(encrypted, expired, null)).valid, false);
  assert.equal((await factor.verifyTotp(encrypted, '9999999', null)).valid, false);
});

test('sessione incompleta non accede a HTTP o Socket.IO', async () => {
  const user = { id: 'admin', role: 'SUPERADMIN', totpEnabledAt: new Date(), suspendedAt: null };
  const session = { id: 's', expiresAt: new Date(Date.now() + 60000),
    user, secondFactorPending: true, secondFactorVerifiedAt: null };
  const prisma = { session: { findUnique: async () => session } };
  const auth = withModules({
    'lib/prisma.js': prisma,
    'utils/sessionTokens.js': { hashSessionToken: () => 'hash' }
  }, 'middleware/authMiddleware.js');
  const req = { headers: { authorization: `Bearer ${'a'.repeat(64)}` } };
  const res = reply();
  await auth(req, res, () => { throw new Error('Accesso prematuro'); });
  assert.equal(res.code, 403);
  assert.equal(res.body.mfaRequired, true);
  let allowed = false;
  await auth.allowPending(req, reply(), () => { allowed = true; });
  assert.equal(allowed, true);
  const shared = withModules({
    'lib/prisma.js': prisma,
    'utils/sessionTokens.js': { hashSessionToken: () => 'hash' }
  }, 'sockets/shared.js');
  assert.equal(await shared.getUserFromToken('a'.repeat(64)), null);
});

test('login con MFA crea solo una sessione in attesa, senza profilo utilizzabile', async () => {
  const bcrypt = require('bcryptjs');
  let created;
  const user = {
    id: 'admin', email: 'admin@example.test',
    passwordHash: await bcrypt.hash('correct-password', 4),
    totpEnabledAt: new Date(), suspendedAt: null
  };
  const auth = withModules({
    'lib/prisma.js': {
      user: { findUnique: async () => user },
      session: { create: async ({ data }) => { created = data; } }
    },
    'config/env.js': { sessionDurationDays: 7 },
    'utils/sessionTokens.js': { createSessionToken: () => 'a'.repeat(64), hashSessionToken: () => 'hash' },
    'lib/roleManagement.js': { lockRoles: async () => {} },
    'lib/bootstrap.js': { matchesAdminCode: () => false, registrationRole: async () => 'STUDENT' },
    'utils/disconnectUserSockets.js': async () => {}
  }, 'controllers/authControllers.js');
  const res = reply();
  await auth.login({ body: { email: user.email, password: 'correct-password' } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.mfaRequired, true);
  assert.equal(res.body.user, undefined);
  assert.equal(created.secondFactorPending, true);
});

test('codici di recupero monouso e blocco dei tentativi persistente', async () => {
  const otp = await import('otplib');
  const secret = otp.generateSecret();
  const recovery = factor.generateRecoveryCodes(1)[0];
  const user = {
    id: 'admin', role: 'SUPERADMIN', suspendedAt: null, totpEnabledAt: new Date(),
    totpSecretEncrypted: factor.encryptSecret(secret), totpLastTimeStep: null,
    mfaFailedAttempts: 0, mfaLockedUntil: null
  };
  const session = { id: 's', userId: 'admin', secondFactorPending: true, secondFactorVerifiedAt: null };
  const stored = new Set([factor.hashRecoveryCode(recovery)]);
  const tx = {
    user: {
      findUnique: async () => ({ ...user }),
      update: async ({ data }) => { Object.assign(user, data); return { ...user }; }
    },
    session: {
      findUnique: async () => ({ ...session }),
      update: async ({ data }) => { Object.assign(session, data); return { ...session }; }
    },
    mfaRecoveryCode: {
      deleteMany: async ({ where }) => {
        if (stored.has(where.codeHash)) { stored.delete(where.codeHash); return { count: 1 }; }
        return { count: 0 };
      }
    }
  };
  const controller = withModules({
    'lib/prisma.js': { $transaction: async (fn) => fn(tx) },
    'lib/roleManagement.js': { lockRoles: async () => {} },
    'lib/twoFactor.js': factor
  }, 'controllers/twoFactorControllers.js');
  const request = (code) => ({ user, session, body: { code } });
  let res = reply();
  await controller.verifyLogin(request('bad'), res);
  assert.equal(res.code, 401);
  assert.equal(user.mfaFailedAttempts, 1);
  res = reply();
  await controller.verifyLogin(request(recovery), res);
  assert.equal(res.code, 200);
  assert.equal(session.secondFactorPending, false);
  assert.ok(session.secondFactorVerifiedAt);
  assert.ok(session.expiresAt > new Date(Date.now() + 6 * 86400000));
  res = reply();
  await controller.verifyLogin(request(recovery), res);
  assert.equal(res.code, 401);
  for (let count = 0; count < 4; count += 1) await controller.verifyLogin(request('invalid'), reply());
  assert.ok(user.mfaLockedUntil > new Date());
  res = reply();
  await controller.verifyLogin(request(await otp.generate({ secret })), res);
  assert.equal(res.code, 429);
});

test('operazioni sensibili richiedono TOTP attivo e verifica recente', () => {
  const middleware = withModules({
    'controllers/twoFactorControllers.js': { RECENT_MS: 600000 }
  }, 'middleware/recentSecondFactor.js');
  const call = (user, verifiedAt) => {
    let next = false;
    const res = reply();
    middleware({ user, session: { secondFactorVerifiedAt: verifiedAt } }, res, () => { next = true; });
    return { code: res.code, next, body: res.body };
  };
  assert.equal(call({ id: 'root' }, new Date()).body.mfaSetupRequired, true);
  assert.equal(call({ id: 'root', totpEnabledAt: new Date() }, null).body.mfaStepUpRequired, true);
  assert.equal(call({ id: 'root', totpEnabledAt: new Date() }, new Date(Date.now() - 11 * 60000)).code, 403);
  assert.equal(call({ id: 'root', totpEnabledAt: new Date() }, new Date()).next, true);
});

test('attivazione confermata, rigenerazione e disattivazione richiedono identità verificata', async () => {
  const otp = await import('otplib');
  const bcrypt = require('bcryptjs');
  const secret = otp.generateSecret();
  const user = {
    id: 'admin', passwordHash: await bcrypt.hash('correct-password', 4), role: 'SUPERADMIN', suspendedAt: null,
    totpPendingEncrypted: factor.encryptSecret(secret),
    totpPendingExpiresAt: new Date(Date.now() + 600000),
    totpEnabledAt: null, mfaFailedAttempts: 0, mfaLockedUntil: null
  };
  const session = { id: 's', userId: 'admin' };
  const stored = new Set();
  const tx = {
    user: {
      findUnique: async () => ({ ...user }),
      update: async ({ data }) => { Object.assign(user, data); return { ...user }; }
    },
    session: {
      update: async ({ data }) => { Object.assign(session, data); return { ...session }; },
      deleteMany: async () => ({ count: 0 })
    },
    mfaRecoveryCode: {
      deleteMany: async ({ where }) => {
        if (where.codeHash) {
          const found = stored.delete(where.codeHash);
          return { count: found ? 1 : 0 };
        }
        stored.clear();
        return { count: 0 };
      },
      createMany: async ({ data }) => { data.forEach((row) => stored.add(row.codeHash)); }
    }
  };
  const controller = withModules({
    'lib/prisma.js': { $transaction: async (fn) => fn(tx) },
    'lib/roleManagement.js': { lockRoles: async () => {} },
    'lib/twoFactor.js': factor,
    'utils/disconnectUserSockets.js': async () => {}
  }, 'controllers/twoFactorControllers.js');
  const req = (code, password) => ({ user, session, body: { code, password }, app: {} });
  const invalid = reply();
  await controller.enable(req('0000000'), invalid);
  assert.equal(invalid.code, 401);
  assert.equal(user.totpEnabledAt, null);
  const first = reply();
  await controller.enable(req(await otp.generate({ secret })), first);
  assert.equal(first.code, 200);
  assert.equal(first.body.recoveryCodes.length, 10);
  assert.equal(stored.size, 10);
  assert.equal(stored.has(first.body.recoveryCodes[0]), false);
  const rejected = reply();
  await controller.regenerate(req(first.body.recoveryCodes[0], 'wrong'), rejected);
  assert.equal(rejected.code, 403);
  const rotated = reply();
  await controller.regenerate(req(first.body.recoveryCodes[0], 'correct-password'), rotated);
  assert.equal(rotated.code, 200);
  assert.equal(stored.has(factor.hashRecoveryCode(first.body.recoveryCodes[1])), false);
  const disabled = reply();
  await controller.disable(req(rotated.body.recoveryCodes[0], 'correct-password'), disabled);
  assert.equal(disabled.code, 200);
  assert.equal(user.totpEnabledAt, null);
  assert.equal(stored.size, 0);
});
