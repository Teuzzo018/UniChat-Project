const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');

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

const ids = ['00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000003'];
const setup = (timeout = 1000, maxDuration = 45 * 60 * 1000) => {
  const rows = new Map();
  const emitted = [];
  const sockets = [];
  let contactAllowed = true;
  const prisma = { privateCall: {
    create: async ({ data }) => { if (rows.has(data.id)) throw new Error('duplicate'); rows.set(data.id, { ...data }); return data; },
    updateMany: async ({ where, data }) => {
      const row = rows.get(where.id);
      if (!row || row.status !== where.status) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    }
  } };
  const io = {
    to: (room) => ({ emit: (event, payload) => emitted.push({ room, event, payload }) }),
    in: (room) => ({ fetchSockets: async () => sockets.filter((socket) => socket.connected && room === `user:${socket.data.user.id}`) })
  };
  const register = withModules({
    'lib/prisma.js': prisma,
    'config/env.js': { callRingTimeoutMs: timeout, callMaxDurationMs: maxDuration },
    'controllers/messageControllers.js': { canContact: async (a, b) => contactAllowed && a !== b && ['alice', 'bob'].includes(a) && ['alice', 'bob'].includes(b) },
    'sockets/shared.js': {
      getAuthenticatedSocketUser: async (socket, token) => token === socket.data.user.id ? socket.data.user : null,
      getSocketUserSummary: (user) => ({ id: user.id, fullName: user.id }),
      getUserRoom: (id) => `user:${id}`
    }
  }, 'sockets/callHandlers.js');
  const open = (userId, socketId) => {
    const handlers = new Map();
    const socket = { id: socketId, data: { user: { id: userId } }, connected: true,
      on: (event, handler) => handlers.set(event, handler) };
    sockets.push(socket);
    register({ io, socket });
    return { socket, send: async (event, payload) => {
      let response;
      await handlers.get(event)({ token: userId, ...payload }, (value) => { response = value; });
      return response;
    }, disconnect: async () => { socket.connected = false; await handlers.get('disconnect')(); } };
  };
  return { rows, emitted, open, setContact: (allowed) => { contactAllowed = allowed; } };
};

const offer = { type: 'offer', description: { type: 'offer', sdp: 'v=0\r\n' } };
const answer = { type: 'answer', description: { type: 'answer', sdp: 'v=0\r\n' } };
const ice = { type: 'ice', candidate: { candidate: 'candidate:1', sdpMid: '0', sdpMLineIndex: 0 } };

test('chiamata privata: risposta prima scheda, segnalazione solo ai due socket selezionati', async () => {
  const ctx = setup();
  const alice = ctx.open('alice', 'a1');
  const bob1 = ctx.open('bob', 'b1');
  const bob2 = ctx.open('bob', 'b2');
  assert.equal((await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob', mode: 'audio' })).ok, true);
  assert.deepEqual(ctx.emitted.filter((event) => event.event === 'private_video_call_incoming').map((event) => event.room), ['user:bob']);
  assert.equal((await bob1.send('private_video_call_answer', { callId: ids[0], accepted: true })).ok, true);
  assert.equal((await bob2.send('private_video_call_answer', { callId: ids[0], accepted: true })).ok, false);
  ctx.emitted.length = 0;
  assert.equal((await bob2.send('private_video_call_signal', { callId: ids[0], signal: offer })).ok, false);
  assert.equal((await alice.send('private_video_call_signal', { callId: ids[0], signal: offer })).ok, false);
  assert.equal((await bob1.send('private_video_call_signal', { callId: ids[0], signal: offer })).ok, true);
  assert.equal((await alice.send('private_video_call_signal', { callId: ids[0], signal: answer })).ok, true);
  assert.equal((await alice.send('private_video_call_signal', { callId: ids[0], signal: ice })).ok, true);
  assert.deepEqual(ctx.emitted.map((event) => event.room), ['a1', 'b1', 'b1']);
  assert.equal((await bob2.send('private_video_call_end', { callId: ids[0] })).ok, false);
  assert.equal((await alice.send('private_video_call_end', { callId: ids[0] })).ok, true);
  assert.equal(ctx.rows.get(ids[0]).status, 'ENDED');
});

test('occupato, chiamate incrociate, annullamento e rifiuto', async () => {
  const ctx = setup();
  const alice = ctx.open('alice', 'a1');
  const bob = ctx.open('bob', 'b1');
  const results = await Promise.all([
    alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' }),
    bob.send('private_video_call_request', { callId: ids[1], recipientId: 'alice' })
  ]);
  assert.deepEqual(results.map((r) => r.ok).sort(), [false, true]);
  const activeId = results[0].ok ? ids[0] : ids[1];
  const requester = results[0].ok ? alice : bob;
  const recipient = results[0].ok ? bob : alice;
  assert.equal((await requester.send('private_video_call_end', { callId: activeId })).ok, true);
  assert.equal(ctx.rows.get(activeId).status, 'CANCELLED');
  const nextId = results[0].ok ? ids[1] : ids[0];
  assert.equal((await requester.send('private_video_call_request', { callId: nextId, recipientId: results[0].ok ? 'bob' : 'alice' })).ok, true);
  assert.equal((await recipient.send('private_video_call_answer', { callId: nextId, accepted: false })).ok, true);
  assert.equal(ctx.rows.get(nextId).status, 'DECLINED');
});

test('timeout, disconnessione e revoca dei permessi chiudono la chiamata', async () => {
  const ctx = setup(20);
  const alice = ctx.open('alice', 'a1');
  const bob = ctx.open('bob', 'b1');
  await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' });
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(ctx.rows.get(ids[0]).status, 'TIMEOUT');
  await alice.send('private_video_call_request', { callId: ids[1], recipientId: 'bob' });
  await bob.send('private_video_call_answer', { callId: ids[1], accepted: true });
  ctx.setContact(false);
  assert.equal((await bob.send('private_video_call_signal', { callId: ids[1], signal: offer })).ok, false);
  assert.equal(ctx.rows.get(ids[1]).status, 'ENDED');
  ctx.setContact(true);
  await alice.send('private_video_call_request', { callId: ids[2], recipientId: 'bob' });
  await alice.disconnect();
  assert.equal(ctx.rows.get(ids[2]).status, 'ENDED');
});

test('segnali malformati e sessioni non valide non raggiungono altri socket', async () => {
  const ctx = setup();
  const alice = ctx.open('alice', 'a1');
  const bob = ctx.open('bob', 'b1');
  await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' });
  await bob.send('private_video_call_answer', { callId: ids[0], accepted: true });
  const before = ctx.emitted.length;
  assert.equal((await bob.send('private_video_call_signal', { token: 'alice', callId: ids[0], signal: offer })).ok, false);
  assert.equal((await bob.send('private_video_call_signal', { callId: ids[0], signal: { type: 'offer', description: { type: 'offer', sdp: 'x'.repeat(70000) } } })).ok, false);
  assert.equal((await bob.send('private_video_call_signal', { callId: ids[0], signal: { type: 'ice', candidate: { candidate: 'x', sdpMLineIndex: '0' } } })).ok, false);
  assert.equal(ctx.emitted.length, before);
  await alice.send('private_video_call_end', { callId: ids[0] });
});

test('utente estraneo e amicizia revocata non possono chiamare; disconnessione del destinatario chiude', async () => {
  const ctx = setup();
  const alice = ctx.open('alice', 'a1');
  const bob = ctx.open('bob', 'b1');
  const eve = ctx.open('eve', 'e1');
  assert.equal((await eve.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' })).ok, false);
  ctx.setContact(false);
  assert.equal((await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' })).ok, false);
  ctx.setContact(true);
  assert.equal((await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' })).ok, true);
  assert.equal((await bob.send('private_video_call_answer', { callId: ids[0], accepted: true })).ok, true);
  await bob.disconnect();
  assert.equal(ctx.rows.get(ids[0]).status, 'ENDED');
});

test('durata massima chiude una chiamata accettata', async () => {
  const ctx = setup(1000, 20);
  const alice = ctx.open('alice', 'a1');
  const bob = ctx.open('bob', 'b1');
  await alice.send('private_video_call_request', { callId: ids[0], recipientId: 'bob' });
  await bob.send('private_video_call_answer', { callId: ids[0], accepted: true });
  await new Promise((resolve) => setTimeout(resolve, 45));
  assert.equal(ctx.rows.get(ids[0]).status, 'ENDED');
  assert.ok(ctx.emitted.some((event) => event.event === 'private_video_call_ended' && event.payload.reason === 'duration'));
});

test('configurazione ICE autenticata usa credenziali TURN temporanee e non espone il segreto', () => {
  const secret = 'a'.repeat(40);
  const router = withModules({
    'middleware/authMiddleware.js': (_req, _res, next) => next(),
    'config/env.js': { webRtcStunUrls: ['stun:stun.example.org:3478'],
      webRtcTurnUrls: ['turns:turn.example.org:5349?transport=tcp'], webRtcTurnSharedSecret: secret }
  }, 'routes/rtcRoutes.js');
  const handler = router.stack.find((layer) => layer.route?.path === '/config').route.stack[0].handle;
  const headers = {};
  let body;
  handler({ user: { id: 'alice' } }, { set: (name, value) => { headers[name] = value; }, json: (value) => { body = value; } });
  assert.equal(headers['Cache-Control'], 'private, no-store');
  assert.deepEqual(body.iceServers[0].urls, ['stun:stun.example.org:3478']);
  const turn = body.iceServers[1];
  const expires = Number(turn.username.split(':')[0]);
  assert.equal(turn.username.endsWith(':alice'), true);
  assert.ok(expires >= Math.floor(Date.now() / 1000) + 3595);
  assert.equal(turn.credential, crypto.createHmac('sha1', secret).update(turn.username).digest('base64'));
  assert.equal(JSON.stringify(body).includes(secret), false);
});
