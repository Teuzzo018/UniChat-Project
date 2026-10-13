export const registerVoiceRtcController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeChannel = (...args) => app.activeChannel(...args);
  const updateVoiceAudioState = (...args) => app.updateVoiceAudioState(...args);
  const renderUserDock = (...args) => app.renderUserDock(...args);
  const renderVoicePanel = (...args) => app.renderVoicePanel(...args);
  const startVoiceTranscription = (...args) => app.startVoiceTranscription(...args);
  const stopVoiceTranscription = (...args) => app.stopVoiceTranscription(...args);

  const addRemoteAudio = (socketId, stream) => {
    let audio = elements.remoteAudio.querySelector(`[data-socket-id="${socketId}"]`);

    if (!audio) {
      audio = document.createElement('audio');
      audio.dataset.socketId = socketId;
      audio.autoplay = true;
      audio.playsInline = true;
      audio.muted = state.userDock.deafened;
      elements.remoteAudio.append(audio);
    }

    audio.srcObject = stream;
  };

  const closeVoicePeer = (socketId) => {
    const peer = state.voice.peers.get(socketId);

    if (peer) {
      peer.close();
      state.voice.peers.delete(socketId);
    }

    elements.remoteAudio.querySelector(`[data-socket-id="${socketId}"]`)?.remove();
  };

  const createVoicePeer = (socketId) => {
    const existingPeer = state.voice.peers.get(socketId);

    if (existingPeer) {
      return existingPeer;
    }

    const peer = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    state.voice.localStream?.getTracks().forEach((track) => {
      peer.addTrack(track, state.voice.localStream);
    });

    peer.addEventListener('icecandidate', (event) => {
      if (event.candidate) {
        state.socket.emit('voice_signal', {
          to: socketId,
          signal: {
            type: 'ice',
            candidate: event.candidate
          }
        });
      }
    });

    peer.addEventListener('track', (event) => {
      addRemoteAudio(socketId, event.streams[0]);
    });

    peer.addEventListener('connectionstatechange', () => {
      if (['closed', 'failed', 'disconnected'].includes(peer.connectionState)) {
        closeVoicePeer(socketId);
      }
    });

    state.voice.peers.set(socketId, peer);
    return peer;
  };

  const callVoicePeer = async (socketId) => {
    const peer = createVoicePeer(socketId);
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    state.socket.emit('voice_signal', {
      to: socketId,
      signal: {
        type: 'offer',
        description: offer
      }
    });
  };

  const handleVoiceSignal = async ({ from, signal }) => {
    if (!from || !signal || !state.voice.localStream) {
      return;
    }

    const peer = createVoicePeer(from);

    if (signal.type === 'offer') {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      state.socket.emit('voice_signal', {
        to: from,
        signal: {
          type: 'answer',
          description: answer
        }
      });
      return;
    }

    if (signal.type === 'answer') {
      await peer.setRemoteDescription(new RTCSessionDescription(signal.description));
      return;
    }

    if (signal.type === 'ice' && signal.candidate) {
      await peer.addIceCandidate(new RTCIceCandidate(signal.candidate));
    }
  };

  const joinVoiceChannel = async () => {
    const channel = activeChannel();

    if (!channel || channel.type !== 'VOICE') {
      return;
    }

    try {
      if (!state.voice.localStream) {
        state.voice.localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        updateVoiceAudioState();
      }

      state.socket.emit('voice_join_channel', {
        token: state.token,
        channelId: channel.id
      }, async (response) => {
        if (!response?.ok) {
          showToast(response?.error || 'Canale vocale non disponibile');
          return;
        }

        state.voice.channelId = channel.id;
        state.voice.participants = response.participants || state.voice.participants;
        state.voice.transcripts = [];
        renderVoicePanel();
        startVoiceTranscription();

        for (const peer of response.peers || []) {
          await callVoicePeer(peer.socketId);
        }
      });
    } catch {
      showToast('Permesso microfono negato o non disponibile');
    }
  };

  const leaveVoiceChannel = async () => {
    if (!state.voice.channelId) {
      return;
    }

    state.socket?.emit('voice_leave_channel');
    stopVoiceTranscription();
    state.voice.peers.forEach((peer) => peer.close());
    state.voice.peers.clear();
    state.voice.localStream?.getTracks().forEach((track) => track.stop());
    state.voice.localStream = null;
    state.voice.channelId = null;
    state.voice.participants = [];
    state.voice.transcripts = [];
    elements.remoteAudio.replaceChildren();
    renderUserDock();

    if (activeChannel()?.type === 'VOICE') {
      renderVoicePanel();
    }
  };

  Object.assign(app, {
    addRemoteAudio,
    closeVoicePeer,
    createVoicePeer,
    callVoicePeer,
    handleVoiceSignal,
    joinVoiceChannel,
    leaveVoiceChannel
  });
};
