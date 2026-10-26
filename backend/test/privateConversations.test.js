/**
 * ============================================================================
 * TEST SUITE: CONVERSAZIONI PRIVATE (privateConversations.test.js)
 * 1. Test scambio messaggi: verifica recapito messaggi solo tra amici non bloccati
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('conversazioni private: unisce messaggi e chiamate e ordina per attività recente', async () => {
  const controllerPath = path.join(__dirname, '../src/controllers/messageControllers.js');
  const prismaPath = path.join(__dirname, '../src/lib/prisma.js');
  const previousPrisma = require.cache[prismaPath];
  const previousController = require.cache[controllerPath];
  const queries = [];
  const database = {
    privateMessage: {
      groupBy: async (query) => {
        queries.push(query);
        if (query.where.senderId) return [
          { recipientId: 'marta', _max: { createdAt: new Date('2026-01-02') } },
          { recipientId: 'luca', _max: { createdAt: new Date('2026-01-01') } }
        ];
        return [{ senderId: 'marta', _max: { createdAt: new Date('2026-01-04') } }];
      }
    },
    privateCall: {
      groupBy: async (query) => {
        queries.push(query);
        if (query.where.callerId) return [{ recipientId: 'luca', _max: { startedAt: new Date('2026-01-03') } }];
        return [{ callerId: 'giulia', _max: { startedAt: new Date('2026-01-05') } }];
      }
    }
  };
  try {
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: database };
    delete require.cache[controllerPath];
    const { listPrivateConversations } = require(controllerPath);
    const response = { status(code) { this.code = code; return this; }, json(data) { this.data = data; return this; } };
    await listPrivateConversations({ user: { id: 'owner' } }, response);
    assert.equal(response.code, 200);
    assert.deepEqual(response.data.map((entry) => entry.userId), ['giulia', 'marta', 'luca']);
    assert.equal(response.data[1].lastActivityAt.toISOString(), '2026-01-04T00:00:00.000Z');
    assert.equal(queries.length, 4);
    assert.ok(queries.every((query) => Object.values(query.where).includes('owner')));
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousController) require.cache[controllerPath] = previousController;
    else delete require.cache[controllerPath];
  }
});
