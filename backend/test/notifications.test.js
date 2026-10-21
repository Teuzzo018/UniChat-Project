const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('non letti: conta solo messaggi altrui accessibili e avanza la lettura', async () => {
  const prismaPath = path.join(__dirname, '../src/lib/prisma.js');
  const authPath = path.join(__dirname, '../src/middleware/authMiddleware.js');
  const controllerPath = path.join(__dirname, '../src/controllers/messageControllers.js');
  const routePath = path.join(__dirname, '../src/routes/notificationRoutes.js');
  const originals = new Map([prismaPath, authPath, controllerPath, routePath].map((file) => [file, require.cache[file]]));
  const queries = [];
  const updates = [];
  const prisma = {
    serverMember: { findMany: async () => [{ server: { channels: [{ id: 'channel-1' }] } }] },
    friendship: { findMany: async () => [{ requesterId: 'me', addresseeId: 'peer' }] },
    conversationRead: {
      findMany: async () => [{ kind: 'channel', targetId: 'channel-1', readAt: new Date('2026-01-01') }],
      createMany: async (query) => { updates.push(query); },
      updateMany: async (query) => { updates.push(query); }
    },
    message: { count: async (query) => { queries.push(query); return 2; } },
    privateMessage: { count: async (query) => { queries.push(query); return 3; } }
  };
  const stub = (file, exports) => { require.cache[file] = { id: file, filename: file, loaded: true, exports }; };
  try {
    stub(prismaPath, prisma);
    stub(authPath, (req, _res, next) => { req.user = { id: 'me' }; next(); });
    stub(controllerPath, { findAccessibleChannel: async (id) => id === 'channel-1', canContact: async (id, peer) => id === 'me' && peer === 'peer' });
    delete require.cache[routePath];
    const router = require(routePath);
    const invoke = (routePath, params = {}, body = {}) => new Promise((resolve, reject) => {
      const route = router.stack.find((layer) => layer.route?.path === routePath).route;
      const response = { code: 200, status(code) { this.code = code; return this; }, json(data) { resolve({ code: this.code, data }); } };
      route.stack[0].handle({ user: { id: 'me' }, params, body }, response, reject);
    });
    const unread = await invoke('/unread');
    assert.deepEqual(unread.data, { channels: { 'channel-1': 2 }, private: { peer: 3 } });
    assert.equal(queries[0].where.userId.not, 'me');
    assert.equal(queries[0].where.deletedAt, null);
    assert.ok(queries[0].where.createdAt.gt instanceof Date);
    assert.equal(queries[1].where.kind, 'USER');
    assert.equal(queries[1].where.senderId, 'peer');
    const read = await invoke('/read/:kind/:targetId', { kind: 'private', targetId: 'peer' }, { through: '2026-01-02T00:00:00.000Z' });
    assert.equal(read.code, 200);
    assert.equal(updates[1].where.readAt.lt.toISOString(), '2026-01-02T00:00:00.000Z');
    const denied = await invoke('/read/:kind/:targetId', { kind: 'private', targetId: 'stranger' }, { through: '2026-01-02T00:00:00.000Z' });
    assert.equal(denied.code, 404);
  } finally {
    for (const [file, original] of originals) {
      if (original) require.cache[file] = original;
      else delete require.cache[file];
    }
  }
});
