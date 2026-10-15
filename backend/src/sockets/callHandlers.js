const prisma = require('../lib/prisma');
const env = require('../config/env');
const { canContact } = require('../controllers/messageControllers');
const { getSocketUserSummary, getAuthenticatedSocketUser, getUserRoom } = require('./shared');

const registries = new WeakMap();
const registryFor = (io) => {
  if (!registries.has(io)) registries.set(io, { calls: new Map(), users: new Map(), sockets: new Map() });
  return registries.get(io);
};

const validId = (value) => typeof value === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(value);
const ack = (callback, value) => { if (typeof callback === 'function') callback(value); };
const active = (call) => call && ['RINGING', 'ACCEPTED'].includes(call.status);

const cleanSignal = (signal) => {
  if (!signal || typeof signal !== 'object') return null;
  if (signal.type === 'offer' || signal.type === 'answer') {
    const description = signal.description;
    if (description?.type !== signal.type || typeof description.sdp !== 'string' ||
        !description.sdp || description.sdp.length > 65536) return null;
    return { type: signal.type, description: { type: signal.type, sdp: description.sdp } };
  }
  if (signal.type === 'ice') {
    const candidate = signal.candidate;
    if (!candidate || typeof candidate.candidate !== 'string' || candidate.candidate.length > 4096 ||
        (candidate.sdpMid !== null && candidate.sdpMid !== undefined && (typeof candidate.sdpMid !== 'string' || candidate.sdpMid.length > 256)) ||
        (candidate.sdpMLineIndex !== null && candidate.sdpMLineIndex !== undefined && (!Number.isInteger(candidate.sdpMLineIndex) || candidate.sdpMLineIndex < 0 || candidate.sdpMLineIndex > 65535))) return null;
    return { type: 'ice', candidate: {
      candidate: candidate.candidate,
      sdpMid: candidate.sdpMid ?? null,
      sdpMLineIndex: candidate.sdpMLineIndex ?? null,
      usernameFragment: typeof candidate.usernameFragment === 'string' ? candidate.usernameFragment.slice(0, 256) : undefined
    } };
  }
  return null;
};

const registerCallHandlers = ({ io, socket }) => {
  const registry = registryFor(io);
  registry.sockets.set(socket.id, socket);
  const release = (call) => {
    clearTimeout(call.timer);
    registry.calls.delete(call.id);
    if (registry.users.get(call.callerId) === call.id) registry.users.delete(call.callerId);
    if (registry.users.get(call.recipientId) === call.id) registry.users.delete(call.recipientId);
  };
  const finish = async (call, status, reason) => {
    if (!active(call) || call.finishing) return false;
    call.finishing = true;
    const previous = call.status;
    call.status = status;
    release(call);
    try {
      await prisma.privateCall.updateMany({
        where: { id: call.id, status: previous },
        data: { status, endedAt: new Date() }
      });
    } catch (error) { console.error('Stato chiamata non salvato:', error.code || error.name); }
    const payload = { callId: call.id, reason };
    io.to(call.callerSocketId).emit('private_video_call_ended', payload);
    io.to(getUserRoom(call.recipientId)).emit('private_video_call_ended', payload);
    return true;
  };

  socket.on('private_video_call_request', async ({ token, recipientId, callId, mode = 'video' } = {}, callback) => {
    try {
      const user = await getAuthenticatedSocketUser(socket, token);
      if (!user || !validId(callId) || !['audio', 'video'].includes(mode) || typeof recipientId !== 'string' || !await canContact(user.id, recipientId)) {
        return ack(callback, { ok: false, error: 'Conversazione non disponibile' });
      }
      const recipients = await io.in(getUserRoom(recipientId)).fetchSockets();
      if (!recipients.length) return ack(callback, { ok: false, code: 'offline', error: 'Utente non connesso' });
      if (registry.users.has(user.id) || registry.users.has(recipientId) || registry.calls.has(callId)) {
        return ack(callback, { ok: false, code: 'busy', error: 'Utente occupato' });
      }
      const call = { id: callId, callerId: user.id, recipientId, callerSocketId: socket.id, mode,
        recipientSocketId: null, status: 'RINGING', offerSent: false, answerSent: false,
        iceCount: 0, finishing: false, initializing: true, aborted: false, timer: null };
      registry.calls.set(callId, call);
      registry.users.set(user.id, callId);
      registry.users.set(recipientId, callId);
      try {
        await prisma.privateCall.create({ data: { id: callId, callerId: user.id, recipientId, status: 'RINGING' } });
      } catch (error) {
        release(call);
        throw error;
      }
      call.initializing = false;
      if (call.aborted || !socket.connected || !(await io.in(getUserRoom(recipientId)).fetchSockets()).length) {
        await finish(call, 'ENDED', 'disconnected');
        return ack(callback, { ok: false, code: 'offline', error: 'Utente non connesso' });
      }
      call.timer = setTimeout(() => finish(call, 'TIMEOUT', 'timeout'), env.callRingTimeoutMs);
      call.timer.unref?.();
      io.to(getUserRoom(recipientId)).emit('private_video_call_incoming', {
        callId, from: getSocketUserSummary(user), mode, timeoutMs: env.callRingTimeoutMs
      });
      ack(callback, { ok: true, timeoutMs: env.callRingTimeoutMs });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_request:', error.code || error.name);
      ack(callback, { ok: false, error: 'Chiamata non avviata' });
    }
  });

  socket.on('private_video_call_answer', async ({ token, callId, accepted } = {}, callback) => {
    try {
      const user = await getAuthenticatedSocketUser(socket, token);
      const call = registry.calls.get(callId);
      if (!user || !call || call.recipientId !== user.id || call.status !== 'RINGING' ||
          call.transitioning || typeof accepted !== 'boolean' || !await canContact(user.id, call.callerId)) {
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      if (registry.calls.get(callId) !== call || call.status !== 'RINGING' || call.transitioning || !socket.connected) {
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      call.transitioning = true;
      if (!accepted) {
        await finish(call, 'DECLINED', 'declined');
        return ack(callback, { ok: true });
      }
      clearTimeout(call.timer);
      const updated = await prisma.privateCall.updateMany({
        where: { id: call.id, status: 'RINGING' },
        data: { status: 'ACCEPTED', answeredAt: new Date() }
      });
      if (!updated.count) {
        await finish(call, 'ENDED', 'unavailable');
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      call.status = 'ACCEPTED';
      call.recipientSocketId = socket.id;
      if (call.aborted || !registry.sockets.get(call.callerSocketId)?.connected || !socket.connected) {
        await finish(call, 'ENDED', 'disconnected');
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      call.transitioning = false;
      clearTimeout(call.timer);
      call.timer = setTimeout(() => finish(call, 'ENDED', 'duration'), env.callMaxDurationMs || 45 * 60 * 1000);
      call.timer.unref?.();
      const from = getSocketUserSummary(user);
      io.to(call.callerSocketId).emit('private_video_call_answered', { callId, accepted: true, from });
      io.to(getUserRoom(user.id)).emit('private_video_call_claimed', { callId, socketId: socket.id });
      ack(callback, { ok: true });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_answer:', error.code || error.name);
      const call = registry.calls.get(callId);
      if (call?.status === 'RINGING') await finish(call, 'ENDED', 'error');
      ack(callback, { ok: false, error: 'Risposta non inviata' });
    }
  });

  socket.on('private_video_call_signal', async ({ token, callId, signal } = {}, callback) => {
    try {
      const user = await getAuthenticatedSocketUser(socket, token);
      const call = registry.calls.get(callId);
      const clean = cleanSignal(signal);
      if (!user || !call || call.status !== 'ACCEPTED' || !clean ||
          !((user.id === call.callerId && socket.id === call.callerSocketId) ||
            (user.id === call.recipientId && socket.id === call.recipientSocketId))) {
        return ack(callback, { ok: false, error: 'Segnalazione non autorizzata' });
      }
      const otherId = user.id === call.callerId ? call.recipientId : call.callerId;
      if (!await canContact(user.id, otherId)) {
        await finish(call, 'ENDED', 'permission');
        return ack(callback, { ok: false, error: 'Conversazione non disponibile' });
      }
      if (registry.calls.get(callId) !== call || call.status !== 'ACCEPTED' || !socket.connected) {
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      if (clean.type === 'offer') {
        if (user.id !== call.recipientId || call.offerSent) return ack(callback, { ok: false, error: 'Offerta non valida' });
        call.offerSent = true;
      } else if (clean.type === 'answer') {
        if (user.id !== call.callerId || !call.offerSent || call.answerSent) return ack(callback, { ok: false, error: 'Risposta non valida' });
        call.answerSent = true;
      } else if (++call.iceCount > 200) return ack(callback, { ok: false, error: 'Troppi candidati ICE' });
      const targetSocketId = user.id === call.callerId ? call.recipientSocketId : call.callerSocketId;
      if (!registry.sockets.get(targetSocketId)?.connected) {
        await finish(call, 'ENDED', 'disconnected');
        return ack(callback, { ok: false, error: 'Utente non connesso' });
      }
      io.to(targetSocketId).emit('private_video_call_signal', { callId, from: { id: user.id }, signal: clean });
      ack(callback, { ok: true });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_signal:', error.code || error.name);
      ack(callback, { ok: false, error: 'Segnalazione non inviata' });
    }
  });

  socket.on('private_video_call_end', async ({ token, callId } = {}, callback) => {
    try {
      const user = await getAuthenticatedSocketUser(socket, token);
      const call = registry.calls.get(callId);
      if (!user || !active(call) ||
          !((user.id === call.callerId && socket.id === call.callerSocketId) ||
            (user.id === call.recipientId && (!call.recipientSocketId || socket.id === call.recipientSocketId)))) {
        return ack(callback, { ok: false, error: 'Chiamata non disponibile' });
      }
      const status = call.status === 'RINGING' && user.id === call.callerId ? 'CANCELLED' : 'ENDED';
      await finish(call, status, status === 'CANCELLED' ? 'cancelled' : 'ended');
      ack(callback, { ok: true });
    } catch (error) {
      console.error('Errore Socket.IO private_video_call_end:', error.code || error.name);
      ack(callback, { ok: false, error: 'Chiamata non terminata' });
    }
  });

  socket.on('disconnect', async () => {
    registry.sockets.delete(socket.id);
    const callId = registry.users.get(socket.data.user?.id);
    const call = registry.calls.get(callId);
    if (!active(call)) return;
    if (call.initializing || (call.status === 'RINGING' && call.transitioning)) { call.aborted = true; return; }
    if (socket.id === call.callerSocketId || socket.id === call.recipientSocketId) {
      await finish(call, 'ENDED', 'disconnected');
    } else if (call.status === 'RINGING' && socket.data.user?.id === call.recipientId) {
      try {
        if (!(await io.in(getUserRoom(call.recipientId)).fetchSockets()).length) await finish(call, 'ENDED', 'disconnected');
      } catch (error) { console.error('Verifica disconnessione chiamata:', error.code || error.name); }
    }
  });
};

module.exports = registerCallHandlers;
module.exports.cleanSignal = cleanSignal;
