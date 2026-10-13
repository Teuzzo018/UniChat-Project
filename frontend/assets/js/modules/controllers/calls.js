export const registerCallsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  const loadMessages = (...args) => app.loadMessages(...args);

  const resetCall = ({ notifyPeer = false } = {}) => {
    if (notifyPeer && state.call.id && state.call.friend) {
      state.socket?.emit('private_video_call_end', {
        token: state.token,
        callId: state.call.id,
        recipientId: state.call.friend.id
      });
    }

    state.call.peer?.close();
    state.call.localStream?.getTracks().forEach((track) => track.stop());
    state.call = {
      id: null,
      peer: null,
      friend: null,
      localStream: null,
      pendingIceCandidates: [],
      incoming: false,
      active: false
    };
    elements.localVideo.srcObject = null;
    elements.remoteVideo.srcObject = null;
    elements.callPanel.classList.add('hidden');
  };

  const showCallPanel = (status) => {
    const friend = state.call.friend;
    elements.emptyState.classList.add('hidden');
    elements.adminPanel.classList.add('hidden');
    elements.gamePanel.classList.add('hidden');
    elements.voicePanel.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callPanel.classList.remove('hidden');
    elements.callTitle.textContent = friend ? `Con ${friend.fullName}` : 'Chiamata privata';
    elements.callStatus.textContent = status;
    elements.acceptCallButton.classList.toggle('hidden', !state.call.incoming);
    elements.declineCallButton.classList.toggle('hidden', !state.call.incoming);
  };

  const createCallPeer = (recipientId) => {
    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    state.call.localStream?.getTracks().forEach((track) => {
      peer.addTrack(track, state.call.localStream);
    });

    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        state.socket.emit('private_video_call_signal', {
          token: state.token,
          callId: state.call.id,
          recipientId,
          signal: {
            type: 'ice',
            candidate: event.candidate
          }
        });
      }
    });

    peer.addEventListener('track', (event) => {
      elements.remoteVideo.srcObject = event.streams[0];
    });

    peer.addEventListener('connectionstatechange', () => {
      if (peer.connectionState === 'connected') {
        state.call.active = true;
        showCallPanel('Chiamata attiva');
      }
      if (peer.connectionState === 'disconnected') {
        showCallPanel('Connessione instabile...');
      }
      if (['closed', 'failed'].includes(peer.connectionState)) {
        resetCall();
        loadMessages();
      }
    });

    state.call.peer = peer;
    return peer;
  };

  const startLocalVideo = async () => {
    state.call.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
    elements.localVideo.srcObject = state.call.localStream;
  };

  const startVideoCall = async () => {
    const friend = activePrivateUser();

    if (!friend || !state.socket?.connected) {
      showToast('Apri una chat privata prima di chiamare');
      return;
    }

    try {
      resetCall();
      state.call.id = crypto.randomUUID();
      state.call.friend = friend;
      await startLocalVideo();
      showCallPanel('Chiamata in uscita...');
      state.socket.emit('private_video_call_request', {
        token: state.token,
        recipientId: friend.id,
        callId: state.call.id
      }, (response) => {
        if (!response?.ok) {
          showToast(response?.error || 'Chiamata non avviata');
          resetCall();
          loadMessages();
        }
      });
    } catch {
      showToast('Camera o microfono non disponibili');
      resetCall();
    }
  };

  const acceptVideoCall = async () => {
    if (!state.call.incoming || !state.call.friend) {
      return;
    }

    try {
      await startLocalVideo();
      state.call.incoming = false;
      const peer = createCallPeer(state.call.friend.id);
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      showCallPanel('Connessione in corso...');
      state.socket.emit('private_video_call_answer', {
        token: state.token,
        callId: state.call.id,
        callerId: state.call.friend.id,
        accepted: true
      });
      state.socket.emit('private_video_call_signal', {
        token: state.token,
        callId: state.call.id,
        recipientId: state.call.friend.id,
        signal: {
          type: 'offer',
          description: offer
        }
      });
    } catch {
      showToast('Camera o microfono non disponibili');
      declineVideoCall();
    }
  };

  const declineVideoCall = () => {
    if (state.call.friend) {
      state.socket.emit('private_video_call_answer', {
        token: state.token,
        callId: state.call.id,
        callerId: state.call.friend.id,
        accepted: false
      });
    }
    resetCall();
    loadMessages();
  };

  const flushVideoIceCandidates = async () => {
    if (!state.call.peer?.remoteDescription) {
      return;
    }

    const candidates = state.call.pendingIceCandidates.splice(0);

    for (const candidate of candidates) {
      await state.call.peer.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const handleVideoSignal = async ({ callId, from, signal }) => {
    if (!state.call.id || callId !== state.call.id || !state.call.friend || from.id !== state.call.friend.id) {
      return;
    }

    if (!state.call.peer) {
      createCallPeer(state.call.friend.id);
    }

    if (signal.type === 'offer') {
      await state.call.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
      await flushVideoIceCandidates();
      const answer = await state.call.peer.createAnswer();
      await state.call.peer.setLocalDescription(answer);
      state.socket.emit('private_video_call_signal', {
        token: state.token,
        callId: state.call.id,
        recipientId: state.call.friend.id,
        signal: {
          type: 'answer',
          description: answer
        }
      });
      return;
    }

    if (signal.type === 'answer') {
      await state.call.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
      await flushVideoIceCandidates();
      return;
    }

    if (signal.type === 'ice' && signal.candidate) {
      if (!state.call.peer.remoteDescription) {
        state.call.pendingIceCandidates.push(signal.candidate);
        return;
      }

      await state.call.peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  Object.assign(app, {
    resetCall,
    showCallPanel,
    createCallPeer,
    startLocalVideo,
    startVideoCall,
    acceptVideoCall,
    declineVideoCall,
    flushVideoIceCandidates,
    handleVideoSignal
  });
};
