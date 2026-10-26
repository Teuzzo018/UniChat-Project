/**
 * ============================================================================
 * TEST SUITE: ATTIVITÀ CHAT PRIVATE (privateActivity.test.js)
 * 1. Test timestamp attività: verifica aggiornamento orario ultima interazione
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('attività privata: salva una voce e la invia solo ai due partecipanti', async () => {
  const prismaPath = path.join(__dirname, '../src/lib/prisma.js');
  const activityPath = path.join(__dirname, '../src/utils/privateActivity.js');
  const previousPrisma = require.cache[prismaPath];
  const previousActivity = require.cache[activityPath];
  const events = [];
  let saved;
  try {
    require.cache[prismaPath] = { id: prismaPath, filename: prismaPath, loaded: true, exports: {
      privateMessage: { create: async (query) => {
        saved = query;
        return { id: 'activity-1', ...query.data, createdAt: new Date(), sender: { id: 'alice', fullName: 'Alice' } };
      } }
    } };
    delete require.cache[activityPath];
    const { recordPrivateActivity } = require(activityPath);
    const io = { to: (room) => ({ emit: (event, payload) => events.push({ room, event, payload }) }) };
    const result = await recordPrivateActivity({ io, senderId: 'alice', recipientId: 'bob',
      activityKey: 'game:1:round:1', kind: 'GAME', content: 'Tris: Alice ha vinto contro Bob.' });
    assert.equal(result.kind, 'GAME');
    assert.equal(saved.data.activityKey, 'game:1:round:1');
    assert.deepEqual(events.map(({ room }) => room), ['user:alice', 'user:bob']);
    assert.ok(events.every(({ event, payload }) => event === 'private_message_created' && payload.id === result.id));
  } finally {
    if (previousPrisma) require.cache[prismaPath] = previousPrisma;
    else delete require.cache[prismaPath];
    if (previousActivity) require.cache[activityPath] = previousActivity;
    else delete require.cache[activityPath];
  }
});
