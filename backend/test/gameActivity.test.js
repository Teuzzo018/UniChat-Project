/**
 * ============================================================================
 * TEST SUITE: MINIGIOCHI REALTIME (gameActivity.test.js)
 * 1. Test avvio partita: creazione stanza di gioco per Tris o Impiccato
 * 2. Test validazione mosse: controllo alternanza turni e rilevamento vittoria/patta
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('Tris: al termine salva il vincitore una sola volta nella chat degli amici', async () => {
  const src = (name) => path.join(__dirname, '../src', name);
  const handlers = new Map();
  const activities = [];
  const saved = new Map();
  const stubs = {
    'lib/prisma.js': {
      friendship: { findFirst: async () => ({ id: 'friendship' }) },
      user: { findUnique: async ({ where }) => ({ id: where.id, fullName: where.id === 'alice' ? 'Alice' : 'Bob' }) }
    },
    'controllers/serverControllers.js': { ensureServerMember: async () => true },
    'sockets/shared.js': {
      getAuthenticatedSocketUser: async (_socket, token) => ({ id: token, fullName: token === 'alice' ? 'Alice' : 'Bob' }),
      getSocketUserSummary: (user) => user,
      getUserRoom: (id) => `user:${id}`
    },
    'utils/privateActivity.js': { recordPrivateActivity: async (entry) => { activities.push(entry); } }
  };
  try {
    for (const [name, exports] of Object.entries(stubs)) {
      const filename = src(name);
      saved.set(filename, require.cache[filename]);
      require.cache[filename] = { id: filename, filename, loaded: true, exports };
    }
    const target = src('sockets/gameHandlers.js');
    saved.set(target, require.cache[target]);
    delete require.cache[target];
    const register = require(target);
    register({ io: { to: () => ({ emit: () => {} }) }, socket: { on: (name, handler) => handlers.set(name, handler) } });
    const invoke = (name, data) => new Promise((resolve) => handlers.get(name)(data, resolve));
    const request = await invoke('private_game_request', { token: 'alice', opponentId: 'bob', type: 'TICTACTOE' });
    assert.equal(request.ok, true);
    const gameId = request.game.id;
    assert.equal((await invoke('private_game_accept', { token: 'bob', gameId, accepted: true })).ok, true);
    for (const [token, index] of [['alice', 0], ['bob', 3], ['alice', 1], ['bob', 4], ['alice', 2]]) {
      assert.equal((await invoke('private_game_move', { token, gameId, index })).ok, true);
    }
    assert.equal(activities.length, 1);
    assert.equal(activities[0].kind, 'GAME');
    assert.match(activities[0].content, /Tris: Alice ha vinto contro Bob/);
    assert.deepEqual([activities[0].senderId, activities[0].recipientId], ['alice', 'bob']);
  } finally {
    for (const [filename, previous] of saved) {
      if (previous) require.cache[filename] = previous;
      else delete require.cache[filename];
    }
  }
});
