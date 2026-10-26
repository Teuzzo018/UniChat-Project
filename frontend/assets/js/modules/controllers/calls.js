/**
 * ============================================================================
 * CONTROLLER CHIAMATE PRIVATE 1-TO-1 (calls.js)
 * 1. Avvio chiamata: richiesta video/audio chiamata verso un amico via Socket.IO
 * 2. Risposta e signaling WebRTC: gestione offer, answer e candidati ICE
 * 3. Gestione flussi media: acquisizione getUserMedia e associazione stream video/audio
 * 4. Terminazione chiamata: chiusura connessione peer e ripristino interfaccia
 * ============================================================================
 */
export const registerCallsController = (app) => {
  const { state, elements, api, showToast } = app;
  const audioButton = document.querySelector('#audioCallButton');
  const callMicButton = document.querySelector('#callMicButton');
  const callCameraButton = document.querySelector('#callCameraButton');
  const remoteCallAudio = document.querySelector('#remoteCallAudio');
  let connectionTimer = null;

  const messageForMediaError = (error) => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return 'Audio e video richiedono HTTPS o localhost.';
    if (['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)) return 'Consenti l’accesso a microfono e videocamera nel browser.';
    if (['NotFoundError', 'DevicesNotFoundError'].includes(error?.name)) return 'Microfono o videocamera non trovati.';
    if (['NotReadableError', 'TrackStartError'].includes(error?.name)) return 'Dispositivo audio o video già in uso o non disponibile.';
    return 'Impossibile avviare audio o video.';
  };

  const emitCall = (event, payload, timeoutMs = 8000) => new Promise((resolve, reject) => {
    if (!state.socket?.connected) return reject(new Error('Connessione al server assente'));
    const timer = setTimeout(() => reject(new Error('Il server non risponde')), timeoutMs);
    state.socket.emit(event, { token: state.token, ...payload }, (response) => {
      clearTimeout(timer);
      if (response?.ok) resolve(response);
      else reject(new Error(response?.error || 'Operazione non riuscita'));
    });
  });

  const resetCall = ({ notifyPeer = false } = {}) => {
    const old = state.call;
    if (notifyPeer && old.id) state.socket?.emit('private_video_call_end', { token: state.token, callId: old.id });
    clearTimeout(connectionTimer);
    connectionTimer = null;
    old.peer?.close();
    old.localStream?.getTracks().forEach((track) => track.stop());
    state.call = { id: null, peer: null, friend: null, localStream: null,
      pendingIceCandidates: [], incoming: false, active: false, mode: 'video', cameraEnabled: true };
    elements.localVideo.srcObject = null;
    elements.remoteVideo.srcObject = null;
    remoteCallAudio.srcObject = null;
    elements.callPanel.classList.add('hidden');
    app.renderUserDock();
  };

  const closeCall = (reason, notifyPeer = true) => {
    if (reason) showToast(reason);
    resetCall({ notifyPeer });
    app.loadMessages().catch((error) => showToast(error.message));
  };

  const showCallPanel = (status) => {
    const call = state.call;
    elements.emptyState.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.superAdminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callPanel.classList.remove('hidden');
    document.querySelector('#homePanel').classList.add('hidden');
    elements.callPanel.classList.toggle('audio-only', call.mode === 'audio');
    elements.callTitle.textContent = call.friend ? `Con ${call.friend.fullName}` : 'Chiamata privata';
    elements.callStatus.textContent = status;
    elements.acceptCallButton.classList.toggle('hidden', !call.incoming);
    elements.declineCallButton.classList.toggle('hidden', !call.incoming);
    elements.endCallButton.classList.toggle('hidden', call.incoming);
    elements.endCallButton.textContent = call.active ? 'Termina chiamata' : 'Annulla chiamata';
    callMicButton.classList.toggle('hidden', !call.localStream);
    callCameraButton.classList.toggle('hidden', !call.localStream || call.mode !== 'video' || !call.localStream.getVideoTracks().length);
    callMicButton.setAttribute('aria-pressed', String(!state.userDock.muted && !state.userDock.deafened));
    callMicButton.textContent = state.userDock.muted || state.userDock.deafened ? 'Attiva microfono' : 'Disattiva microfono';
    callCameraButton.setAttribute('aria-pressed', String(call.cameraEnabled));
    callCameraButton.textContent = call.cameraEnabled ? 'Disattiva videocamera' : 'Attiva videocamera';
  };

  const startLocalMedia = async () => {
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      const error = new Error('secure-context'); error.isMediaError = true; throw error;
    }
    const callId = state.call.id;
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: state.call.mode === 'video' }); }
    catch (error) { error.isMediaError = true; throw error; }
    if (state.call.id !== callId) { stream.getTracks().forEach((track) => track.stop()); return false; }
    state.call.localStream = stream;
    stream.getAudioTracks().forEach((track) => { track.enabled = !state.userDock.muted && !state.userDock.deafened; });
    elements.localVideo.srcObject = stream;
    app.renderUserDock();
    showCallPanel(state.call.incoming ? 'Chiamata in arrivo' : 'Connessione in corso…');
    return true;
  };

  const sendSignal = (signal) => {
    if (!state.call.id) return;
    emitCall('private_video_call_signal', { callId: state.call.id, signal }).catch((error) => {
      if (state.call.id) closeCall(error.message);
    });
  };

  const createCallPeer = () => {
    const call = state.call;
    if (call.peer) return call.peer;
    const peer = new RTCPeerConnection({ iceServers: call.iceServers || [] });
    call.localStream?.getTracks().forEach((track) => peer.addTrack(track, call.localStream));
    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate && state.call.peer === peer) sendSignal({ type: 'ice', candidate: event.candidate.toJSON() });
    });
    peer.addEventListener('track', (event) => {
      const stream = event.streams[0] || new MediaStream([event.track]);
      if (state.call.mode === 'audio') remoteCallAudio.srcObject = stream;
      else elements.remoteVideo.srcObject = stream;
    });
    peer.addEventListener('connectionstatechange', () => {
      if (state.call.peer !== peer) return;
      if (peer.connectionState === 'connected') {
        clearTimeout(connectionTimer);
        connectionTimer = null;
        state.call.active = true;
        showCallPanel('Chiamata attiva');
      } else if (peer.connectionState === 'disconnected') {
        showCallPanel('Connessione instabile…');
        clearTimeout(connectionTimer);
        connectionTimer = setTimeout(() => {
          if (state.call.peer === peer && peer.connectionState !== 'connected') closeCall('Connessione interrotta');
        }, 10000);
      } else if (peer.connectionState === 'failed') closeCall('Connessione WebRTC non riuscita');
    });
    call.peer = peer;
    return peer;
  };

  const startConnectionTimer = () => {
    clearTimeout(connectionTimer);
    connectionTimer = setTimeout(() => {
      if (state.call.id && !state.call.active) closeCall('Tempo di connessione esaurito');
    }, 25000);
  };

  const startVideoCall = async (mode = 'video') => {
    const friend = app.activePrivateUser();
    if (!friend || !state.friends.some((item) => item.friend.id === friend.id)) return showToast('Apri la chat di un amico per chiamarlo');
    if (state.call.id) return showToast('Hai già una chiamata in corso');
    if (!state.socket?.connected) return showToast('Connessione al server assente');
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) return showToast('Audio e video richiedono HTTPS o localhost.');
    if (!window.RTCPeerConnection) return showToast('WebRTC non supportato da questo browser.');
    await app.leaveVoiceChannel();
    state.call.id = crypto.randomUUID();
    state.call.friend = friend;
    state.call.mode = mode;
    const callId = state.call.id;
    try {
      state.call.iceServers = (await api('/rtc/config')).iceServers;
      if (!await startLocalMedia()) return;
      showCallPanel('Chiamata in uscita…');
      await emitCall('private_video_call_request', { callId, recipientId: friend.id, mode });
      if (state.call.id !== callId) return;
      showCallPanel('In attesa di risposta…');
    } catch (error) {
      if (state.call.id === callId) closeCall(error.isMediaError ? messageForMediaError(error) : error.message, false);
    }
  };

  const acceptVideoCall = async () => {
    const call = state.call;
    if (!call.incoming || !call.friend || call.accepting) return;
    call.accepting = true;
    const callId = call.id;
    try {
      if (!window.RTCPeerConnection) throw new Error('WebRTC non supportato da questo browser.');
      await app.leaveVoiceChannel();
      call.iceServers = (await api('/rtc/config')).iceServers;
      if (!await startLocalMedia()) return;
      await emitCall('private_video_call_answer', { callId, accepted: true });
      if (state.call.id !== callId) return;
      state.call.incoming = false;
      showCallPanel('Connessione in corso…');
      const peer = createCallPeer();
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      sendSignal({ type: 'offer', description: { type: offer.type, sdp: offer.sdp } });
      startConnectionTimer();
    } catch (error) {
      if (state.call.id === callId) {
        if (state.call.incoming) state.socket?.emit('private_video_call_answer', { token: state.token, callId, accepted: false });
        closeCall(error.isMediaError ? messageForMediaError(error) : error.message);
      }
    }
  };

  const declineVideoCall = () => {
    if (!state.call.incoming) return;
    state.socket?.emit('private_video_call_answer', { token: state.token, callId: state.call.id, accepted: false });
    closeCall(null, false);
  };

  const flushVideoIceCandidates = async () => {
    const call = state.call;
    if (!call.peer?.remoteDescription) return;
    for (const candidate of call.pendingIceCandidates.splice(0)) await call.peer.addIceCandidate(candidate);
  };

  const handleVideoSignal = async ({ callId, from, signal } = {}) => {
    const call = state.call;
    if (!call.id || callId !== call.id || !call.friend || from?.id !== call.friend.id || !signal) return;
    if (call.incoming || !call.localStream) return;
    const peer = createCallPeer();
    try {
      if (signal.type === 'offer' && !call.offerReceived) {
        call.offerReceived = true;
        await peer.setRemoteDescription(signal.description);
        await flushVideoIceCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        sendSignal({ type: 'answer', description: { type: answer.type, sdp: answer.sdp } });
        startConnectionTimer();
      } else if (signal.type === 'answer' && !call.answerReceived) {
        call.answerReceived = true;
        await peer.setRemoteDescription(signal.description);
        await flushVideoIceCandidates();
      } else if (signal.type === 'ice' && signal.candidate) {
        if (peer.remoteDescription) await peer.addIceCandidate(signal.candidate);
        else if (call.pendingIceCandidates.length < 200) call.pendingIceCandidates.push(signal.candidate);
      }
    } catch (error) {
      if (state.call.id === callId) closeCall('Segnalazione WebRTC non valida');
    }
  };

  const onIncomingCall = ({ callId, from, mode = 'video' } = {}) => {
    if (!callId || !from || !['audio', 'video'].includes(mode)) return;
    if (state.call.id) {
      showToast('Hai già una chiamata in corso');
      return;
    }
    state.call.id = callId;
    state.call.friend = from;
    state.call.mode = mode;
    state.call.incoming = true;
    showCallPanel(`${mode === 'audio' ? 'Chiamata audio' : 'Videochiamata'} in arrivo da ${from.fullName}`);
  };

  const onCallAnswered = ({ callId, accepted, from } = {}) => {
    if (callId !== state.call.id || state.call.incoming) return;
    if (!accepted) return closeCall('Chiamata rifiutata', false);
    state.call.friend = from;
    try {
      createCallPeer();
      showCallPanel('Connessione in corso…');
      startConnectionTimer();
    } catch { closeCall('Impossibile preparare la connessione WebRTC'); }
  };

  const onCallClaimed = ({ callId, socketId } = {}) => {
    if (callId === state.call.id && state.call.incoming && socketId !== state.socket?.id) closeCall(null, false);
  };

  const onCallEnded = ({ callId, reason } = {}) => {
    if (callId !== state.call.id) return;
    const text = { timeout: 'Nessuna risposta', declined: 'Chiamata rifiutata', cancelled: 'Chiamata annullata',
      disconnected: 'L’altro utente si è disconnesso', permission: 'Conversazione non più disponibile',
      ended: 'Chiamata terminata', duration: 'Durata massima della chiamata raggiunta' }[reason] || 'Chiamata terminata';
    closeCall(text, false);
  };

  const toggleCamera = () => {
    const call = state.call;
    const tracks = call.localStream?.getVideoTracks() || [];
    if (!tracks.length) return;
    call.cameraEnabled = !call.cameraEnabled;
    tracks.forEach((track) => { track.enabled = call.cameraEnabled; });
    showCallPanel(elements.callStatus.textContent);
  };

  const toggleCallMic = () => {
    if (state.userDock.deafened) app.toggleDeafen();
    app.toggleMute();
    showCallPanel(elements.callStatus.textContent);
  };
  audioButton.addEventListener('click', () => startVideoCall('audio'));
  callMicButton.addEventListener('click', toggleCallMic);
  callCameraButton.addEventListener('click', toggleCamera);

  Object.assign(app, { resetCall, showCallPanel, createCallPeer, startVideoCall, acceptVideoCall,
    declineVideoCall, flushVideoIceCandidates, handleVideoSignal, onIncomingCall, onCallAnswered,
    onCallClaimed, onCallEnded, closeCall });
};
