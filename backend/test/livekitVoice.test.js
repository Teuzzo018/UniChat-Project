/**
 * ============================================================================
 * TEST SUITE: STANZE VOCALI LIVEKIT (livekitVoice.test.js)
 * 1. Test rilascio token: verifica rilascio token JWT LiveKit solo a membri del server
 * 2. Test permessi audio/video: verifica metadati e abilitazione webcam/microfono
 * ============================================================================
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

test('token LiveKit: solo membri di una chat vocale ricevono il grant della stanza', async () => {
  const stubs = new Map();
  const stub = (filename, exports) => {
    stubs.set(filename, require.cache[filename]);
    require.cache[filename] = { id: filename, filename, loaded: true, exports };
  };
  const src = (name) => path.join(__dirname, '../src', name);
  let accessible = { id: 'voice-1', type: 'VOICE' };
  const issued = [];
  class AccessToken {
    constructor(key, secret, options) { issued.push({ key, secret, options }); }
    addGrant(grant) { issued.at(-1).grant = grant; }
    async toJwt() { return 'short-lived-token'; }
  }
  const routeFile = src('routes/rtcRoutes.js');
  const previousRoute = require.cache[routeFile];
  stub(src('middleware/authMiddleware.js'), (_req, _res, next) => next());
  stub(src('config/env.js'), {
    livekitUrl: 'wss://example.livekit.cloud', livekitApiKey: 'key', livekitApiSecret: 'secret'
  });
  stub(src('controllers/messageControllers.js'), {
    findAccessibleChannel: async () => accessible
  });
  stub(require.resolve('livekit-server-sdk'), { AccessToken });
  delete require.cache[routeFile];
  try {
    const router = require(routeFile);
    const handler = router.stack.find((layer) => layer.route?.path === '/voice-token').route.stack[0].handle;
    const invoke = async (channelId) => {
      const result = { statusCode: 200, headers: {} };
      const response = {
        status(code) { result.statusCode = code; return this; },
        set(name, value) { result.headers[name] = value; return this; },
        json(body) { result.body = body; return this; }
      };
      await handler({ body: { channelId }, user: { id: 'alice', fullName: 'Alice' } }, response, (error) => { throw error; });
      return result;
    };
    const allowed = await invoke('voice-1');
    assert.equal(allowed.statusCode, 200);
    assert.deepEqual(allowed.body, { url: 'wss://example.livekit.cloud', token: 'short-lived-token' });
    assert.equal(allowed.headers['Cache-Control'], 'private, no-store');
    assert.equal(issued[0].options.ttl, '15m');
    assert.match(issued[0].options.identity, /^alice:/);
    assert.deepEqual(issued[0].grant, {
      roomJoin: true, room: 'unichat-voice-voice-1', canPublish: true, canSubscribe: true
    });

    accessible = null;
    assert.equal((await invoke('voice-1')).statusCode, 403);
    accessible = { id: 'voice-1', type: 'TEXT' };
    assert.equal((await invoke('voice-1')).statusCode, 403);
    assert.equal(issued.length, 1);
  } finally {
    if (previousRoute) require.cache[routeFile] = previousRoute;
    else delete require.cache[routeFile];
    for (const [filename, previous] of stubs) {
      if (previous) require.cache[filename] = previous;
      else delete require.cache[filename];
    }
  }
});
