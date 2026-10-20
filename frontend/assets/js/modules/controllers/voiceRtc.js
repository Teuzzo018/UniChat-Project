export const registerVoiceRtcController = (app) => {
  const { state, elements, api, showToast } = app;
  const livekit = window.LivekitClient;
  let joinId = 0;
  let previewId = 0;
  let joining = false;
  let previewPromise = null;
  let previewChannelId = null;
  let previewTracks = [];
  let cameraEnabled = true;
  let screenTracks = [];

  const tileKey = (identity, source) => `${identity}:${source}`;
  const previewIdentity = () => `preview:${state.user?.id || 'local'}`;
  const previewParticipant = () => ({ identity: previewIdentity(), name: state.user?.fullName || 'Tu' });
  const findTile = (identity, source) => [...elements.voiceVideos.querySelectorAll('[data-track-key]')]
    .find((tile) => tile.dataset.trackKey === tileKey(identity, source));
  const removeTile = (identity, source) => findTile(identity, source)?.remove();
  const ensureTile = (participant, source, local = false) => {
    let tile = findTile(participant.identity, source);
    if (!tile) {
      tile = document.createElement('div');
      tile.className = 'voice-video-tile';
      tile.classList.toggle('local', local && source === livekit.Track.Source.Camera);
      tile.dataset.trackKey = tileKey(participant.identity, source);
      tile.dataset.participantId = participant.identity;
      const placeholder = document.createElement('div');
      placeholder.className = 'voice-video-placeholder';
      const initials = document.createElement('strong');
      initials.textContent = app.getInitials(local ? state.user?.fullName : participant.name || 'Partecipante');
      const caption = document.createElement('small');
      caption.textContent = 'Videocamera disattivata';
      placeholder.append(initials, caption);
      const label = document.createElement('span');
      label.className = 'voice-video-name';
      label.textContent = `${local ? 'Tu' : participant.name || 'Partecipante'}${source === livekit.Track.Source.ScreenShare ? ' · schermo' : ''}`;
      tile.append(placeholder, label);
      elements.voiceVideos.append(tile);
    }
    tile.classList.toggle('local', local && source === livekit.Track.Source.Camera);
    return tile;
  };
  const showVideo = (track, participant, source, local = false) => {
    const tile = ensureTile(participant, source, local);
    tile.querySelector('video')?.remove();
    tile.querySelector('.voice-video-placeholder')?.classList.add('hidden');
    const video = track.attach();
    video.autoplay = true;
    video.playsInline = true;
    video.muted = local;
    tile.prepend(video);
  };
  const showCameraOff = (participant, local = false) => {
    const tile = ensureTile(participant, livekit.Track.Source.Camera, local);
    tile.querySelector('video')?.remove();
    tile.querySelector('.voice-video-placeholder')?.classList.remove('hidden');
  };
  const refreshParticipants = () => {
    const room = state.voice.room;
    if (!room) return;
    ensureTile(room.localParticipant, livekit.Track.Source.Camera, true);
    for (const participant of room.remoteParticipants.values()) {
      ensureTile(participant, livekit.Track.Source.Camera);
    }
  };
  const refreshSpeakers = (speakers = []) => {
    const active = new Set(speakers.map((participant) => participant.identity));
    for (const tile of elements.voiceVideos.querySelectorAll('[data-participant-id]')) {
      tile.classList.toggle('speaking', active.has(tile.dataset.participantId));
    }
  };
  const renderPreview = () => {
    if (!livekit || state.voice.room || app.activeChannel()?.type !== 'VOICE') return;
    const participant = previewParticipant();
    const videoTrack = previewTracks.find((track) => track.kind === livekit?.Track.Kind.Video);
    if (cameraEnabled && videoTrack) showVideo(videoTrack, participant, livekit.Track.Source.Camera, true);
    else showCameraOff(participant, true);
  };
  const stopVoicePreview = () => {
    previewId += 1;
    previewPromise = null;
    previewChannelId = null;
    for (const track of previewTracks) track.stop();
    previewTracks = [];
    removeTile(previewIdentity(), livekit?.Track.Source.Camera);
  };
  const prepareVoicePreview = () => {
    const channel = app.activeChannel();
    if (!channel || channel.type !== 'VOICE' || state.voice.room) return Promise.resolve();
    if (previewChannelId === channel.id && (previewTracks.length || previewPromise)) return previewPromise || Promise.resolve();
    stopVoicePreview();
    previewChannelId = channel.id;
    renderPreview();
    if (!livekit || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      elements.voiceStatus.textContent = 'Webcam e microfono richiedono HTTPS o localhost.';
      return Promise.resolve();
    }
    const requestId = ++previewId;
    const micEnabled = !state.userDock.muted && !state.userDock.deafened;
    if (!cameraEnabled && !micEnabled) return Promise.resolve();
    elements.voiceStatus.textContent = 'Preparazione di webcam e microfono…';
    const request = livekit.createLocalTracks({ audio: micEnabled, video: cameraEnabled })
      .then((tracks) => {
        if (requestId !== previewId || app.activeChannel()?.id !== channel.id) {
          tracks.forEach((track) => track.stop());
          return;
        }
        previewTracks = tracks.filter((track) => {
          const allowed = track.kind === livekit.Track.Kind.Video ? cameraEnabled
            : !state.userDock.muted && !state.userDock.deafened;
          if (!allowed) track.stop();
          return allowed;
        });
        renderPreview();
        elements.voiceStatus.textContent = 'Controlla webcam e microfono, poi premi Entra.';
      })
      .catch((error) => {
        if (requestId !== previewId) return;
        elements.voiceStatus.textContent = ['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)
          ? 'Consenti webcam e microfono nel browser per vedere l’anteprima.'
          : 'Anteprima non disponibile. Controlla webcam e microfono.';
      })
      .finally(() => { if (previewPromise === request) previewPromise = null; });
    previewPromise = request;
    return request;
  };
  const renderControls = () => {
    const room = state.voice.room;
    const connected = Boolean(room && state.voice.channelId);
    const micOn = !state.userDock.muted && !state.userDock.deafened;
    elements.joinVoiceButton.classList.toggle('hidden', connected || joining);
    elements.joinVoiceButton.disabled = joining;
    elements.voiceMicButton.classList.remove('hidden');
    elements.voiceCameraButton.classList.remove('hidden');
    for (const button of [elements.voiceShareScreenButton, elements.voiceShareWindowButton, elements.leaveVoiceButton]) {
      button.classList.toggle('hidden', !connected);
    }
    elements.voiceStopShareButton.classList.toggle('hidden', !connected || !screenTracks.length);
    elements.voiceMicButton.textContent = micOn ? 'Disattiva microfono' : 'Attiva microfono';
    elements.voiceMicButton.setAttribute('aria-pressed', String(micOn));
    const cameraOn = connected ? Boolean(room.localParticipant.isCameraEnabled) : cameraEnabled;
    elements.voiceCameraButton.textContent = cameraOn ? 'Disattiva videocamera' : 'Attiva videocamera';
    elements.voiceCameraButton.setAttribute('aria-pressed', String(cameraOn));
  };
  const syncVoiceMic = () => {
    const enabled = !state.userDock.muted && !state.userDock.deafened;
    const room = state.voice.room;
    if (room && state.voice.channelId) {
      room.localParticipant.setMicrophoneEnabled(enabled)
        .catch(() => showToast('Impossibile modificare il microfono'));
    } else if (previewChannelId === app.activeChannel()?.id) {
      const audioTrack = previewTracks.find((track) => track.kind === livekit?.Track.Kind.Audio);
      if (Boolean(audioTrack) !== enabled && !previewPromise) { stopVoicePreview(); prepareVoicePreview(); }
    }
    renderControls();
  };
  const stopScreenShare = async () => {
    const room = state.voice.room;
    const tracks = screenTracks;
    screenTracks = [];
    for (const track of tracks) {
      if (room) {
        try { await room.localParticipant.unpublishTrack(track); }
        catch { /* La stanza può essersi già disconnessa. */ }
      }
      track.stop();
    }
    if (room) removeTile(room.localParticipant.identity, livekit.Track.Source.ScreenShare);
    renderControls();
  };
  const shareScreen = async (surface) => {
    const room = state.voice.room;
    if (!room || !state.voice.channelId) return;
    try {
      await stopScreenShare();
      const tracks = await livekit.createLocalScreenTracks({ video: { displaySurface: surface }, audio: false });
      if (state.voice.room !== room) { tracks.forEach((track) => track.stop()); return; }
      screenTracks = tracks;
      for (const track of tracks) {
        await room.localParticipant.publishTrack(track, { source: livekit.Track.Source.ScreenShare });
        if (track.kind === livekit.Track.Kind.Video) {
          showVideo(track, room.localParticipant, livekit.Track.Source.ScreenShare, true);
          track.mediaStreamTrack.addEventListener('ended', () => stopScreenShare().catch(() => {}), { once: true });
        }
      }
      renderControls();
    } catch (error) {
      await stopScreenShare();
      if (error?.name !== 'NotAllowedError') showToast('Condivisione schermo non disponibile');
    }
  };
  const leaveVoiceChannel = async ({ reopenPreview = false } = {}) => {
    joinId += 1;
    joining = false;
    const room = state.voice.room;
    state.voice.room = null;
    state.voice.channelId = null;
    stopVoicePreview();
    state.socket?.emit('voice_leave_channel');
    await stopScreenShare();
    if (room) await room.disconnect();
    elements.voiceVideos.replaceChildren();
    elements.remoteAudio.replaceChildren();
    if (app.activeChannel()?.type === 'VOICE') {
      app.renderVoicePanel();
      if (reopenPreview) prepareVoicePreview();
    }
    app.renderUserDock();
  };
  const joinVoiceChannel = async () => {
    const channel = app.activeChannel();
    if (!channel || channel.type !== 'VOICE' || joining || state.voice.channelId === channel.id) return;
    if (!livekit || !navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      showToast('Webcam e audio richiedono HTTPS o localhost e LiveKit.'); return;
    }
    const requestId = ++joinId;
    joining = true;
    elements.voiceStatus.textContent = 'Ingresso nella chat vocale…';
    renderControls();
    let room;
    let tracks = [];
    let usingPreview = false;
    try {
      const credentials = await api('/rtc/voice-token', { method: 'POST', body: JSON.stringify({ channelId: channel.id }) });
      if (previewPromise) await previewPromise;
      if (requestId !== joinId || app.activeChannel()?.id !== channel.id) return;
      usingPreview = previewChannelId === channel.id && previewTracks.length > 0;
      tracks = usingPreview ? previewTracks : (!cameraEnabled && (state.userDock.muted || state.userDock.deafened))
        ? [] : await livekit.createLocalTracks({
          audio: !state.userDock.muted && !state.userDock.deafened,
          video: cameraEnabled
        });
      if (requestId !== joinId || app.activeChannel()?.id !== channel.id) return;
      room = new livekit.Room({ adaptiveStream: true, dynacast: true });
      room.on(livekit.RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === livekit.Track.Kind.Video) showVideo(track, participant, publication.source);
        else if (track.kind === livekit.Track.Kind.Audio) {
          const audio = track.attach();
          audio.autoplay = true;
          audio.muted = state.userDock.deafened;
          elements.remoteAudio.append(audio);
        }
      });
      room.on(livekit.RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        track.detach().forEach((element) => element.remove());
        if (track.kind === livekit.Track.Kind.Video) {
          if (publication.source === livekit.Track.Source.ScreenShare) removeTile(participant.identity, publication.source);
          else showCameraOff(participant);
        }
      });
      room.on(livekit.RoomEvent.TrackMuted, (publication, participant) => {
        if (publication.kind !== livekit.Track.Kind.Video) return;
        if (publication.source === livekit.Track.Source.ScreenShare) removeTile(participant.identity, publication.source);
        else showCameraOff(participant, participant === room.localParticipant);
      });
      room.on(livekit.RoomEvent.TrackUnmuted, (publication, participant) => {
        if (publication.kind === livekit.Track.Kind.Video && publication.track) {
          showVideo(publication.track, participant, publication.source, participant === room.localParticipant);
        }
      });
      room.on(livekit.RoomEvent.ParticipantConnected, refreshParticipants);
      room.on(livekit.RoomEvent.ParticipantDisconnected, (participant) => {
        removeTile(participant.identity, livekit.Track.Source.Camera);
        removeTile(participant.identity, livekit.Track.Source.ScreenShare);
      });
      room.on(livekit.RoomEvent.ActiveSpeakersChanged, refreshSpeakers);
      room.on(livekit.RoomEvent.Disconnected, () => {
        if (state.voice.room === room) leaveVoiceChannel({ reopenPreview: true }).catch(() => {});
      });
      await room.connect(credentials.url, credentials.token);
      if (requestId !== joinId || app.activeChannel()?.id !== channel.id) return;
      state.voice.room = room;
      state.voice.channelId = channel.id;
      if (usingPreview) {
        previewTracks = [];
        previewChannelId = null;
        usingPreview = false;
      }
      removeTile(previewIdentity(), livekit.Track.Source.Camera);
      refreshParticipants();
      for (const track of tracks) {
        const source = track.kind === livekit.Track.Kind.Audio ? livekit.Track.Source.Microphone : livekit.Track.Source.Camera;
        if (source === livekit.Track.Source.Microphone && (state.userDock.muted || state.userDock.deafened)) { track.stop(); continue; }
        if (source === livekit.Track.Source.Camera && !cameraEnabled) { track.stop(); continue; }
        await room.localParticipant.publishTrack(track, { source });
        if (source === livekit.Track.Source.Camera) showVideo(track, room.localParticipant, source, true);
      }
      tracks = [];
      app.renderVoicePanel();
      app.renderUserDock();
    } catch (error) {
      if (requestId === joinId) {
        elements.voiceStatus.textContent = 'Ingresso non riuscito. Controlla la connessione e riprova.';
        showToast(['NotAllowedError', 'PermissionDeniedError'].includes(error?.name)
          ? 'Consenti webcam e microfono nel browser per entrare.' : error?.message || 'Impossibile entrare nella chat vocale');
        if (state.voice.room === room) await leaveVoiceChannel({ reopenPreview: true });
      }
    } finally {
      if (!usingPreview) tracks.forEach((track) => track.stop());
      if (room && state.voice.room !== room) await room.disconnect();
      if (requestId === joinId) {
        joining = false;
        if (app.activeChannel()?.type === 'VOICE') renderControls();
      }
    }
  };

  elements.voiceMicButton.addEventListener('click', () => {
    if (state.userDock.deafened) app.toggleDeafen();
    app.toggleMute();
  });
  elements.voiceCameraButton.addEventListener('click', async () => {
    const room = state.voice.room;
    if (room) {
      try {
        const enabled = !room.localParticipant.isCameraEnabled;
        await room.localParticipant.setCameraEnabled(enabled);
        cameraEnabled = enabled;
        if (enabled) {
          const pub = room.localParticipant.getTrackPublication(livekit.Track.Source.Camera);
          if (pub?.track) showVideo(pub.track, room.localParticipant, livekit.Track.Source.Camera, true);
        } else showCameraOff(room.localParticipant, true);
      } catch { showToast('Webcam non disponibile'); }
    } else {
      cameraEnabled = !cameraEnabled;
      stopVoicePreview();
      prepareVoicePreview();
    }
    renderControls();
  });
  elements.voiceShareScreenButton.addEventListener('click', () => shareScreen('monitor'));
  elements.voiceShareWindowButton.addEventListener('click', () => shareScreen('window'));
  elements.voiceStopShareButton.addEventListener('click', () => stopScreenShare().catch(() => showToast('Impossibile interrompere la condivisione')));
  Object.assign(app, { joinVoiceChannel, leaveVoiceChannel, prepareVoicePreview, stopVoicePreview, syncVoiceMic, renderVoiceControls: renderControls });
};
