export const registerVoiceTranscriptsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activeChannel = (...args) => app.activeChannel(...args);

  const renderVoiceParticipants = () => {
    elements.voiceParticipants.replaceChildren();

    state.voice.participants.forEach((participant) => {
      const item = document.createElement('div');
      item.className = 'voice-participant';
      item.append(createUserAvatar(participant, 'member-avatar'));
      const name = document.createElement('span');
      name.textContent = participant.id === state.user?.id ? `${participant.fullName} (tu)` : participant.fullName;
      item.append(name);
      elements.voiceParticipants.append(item);
    });
  };

  const getSpeechRecognitionConstructor = () => window.SpeechRecognition || window.webkitSpeechRecognition;

  const renderVoiceTranscripts = () => {
    elements.voiceTranscriptList.replaceChildren();

    if (!state.voice.transcripts.length) {
      const empty = document.createElement('p');
      empty.className = 'voice-transcript-empty';
      empty.textContent = 'Nessuna trascrizione ancora.';
      elements.voiceTranscriptList.append(empty);
    } else {
      state.voice.transcripts.forEach((entry) => {
        const item = document.createElement('article');
        item.className = 'voice-transcript-item';

        const meta = document.createElement('div');
        meta.className = 'voice-transcript-meta';

        const name = document.createElement('strong');
        name.textContent = entry.user?.id === state.user?.id ? 'Tu' : entry.user?.fullName || 'Utente';

        const time = document.createElement('time');
        time.dateTime = entry.createdAt;
        time.textContent = new Date(entry.createdAt).toLocaleTimeString('it-IT', {
          hour: '2-digit',
          minute: '2-digit'
        });

        meta.append(name, time);

        const text = document.createElement('p');
        text.textContent = entry.text;

        item.append(meta, text);
        elements.voiceTranscriptList.append(item);
      });
    }

    elements.voiceTranscriptInterim.textContent = state.voice.transcriptInterim
      ? `Sto ascoltando: ${state.voice.transcriptInterim}`
      : '';
    elements.voiceTranscriptInterim.classList.toggle('hidden', !state.voice.transcriptInterim);
    elements.voiceTranscriptList.scrollTop = elements.voiceTranscriptList.scrollHeight;
  };

  const addVoiceTranscript = (entry) => {
    if (!entry?.text) {
      return;
    }

    state.voice.transcripts.push(entry);
    state.voice.transcripts = state.voice.transcripts.slice(-80);
    renderVoiceTranscripts();
  };

  const stopVoiceTranscription = () => {
    state.voice.shouldTranscribe = false;
    state.voice.transcriptInterim = '';

    if (state.voice.recognition) {
      state.voice.recognition.onend = null;
      state.voice.recognition.onerror = null;
      state.voice.recognition.onresult = null;
      try {
        state.voice.recognition.stop();
      } catch {
        // The browser can throw if recognition already stopped itself.
      }
      state.voice.recognition = null;
    }

    renderVoiceTranscripts();
  };

  const startVoiceTranscription = () => {
    const SpeechRecognition = getSpeechRecognitionConstructor();

    if (!SpeechRecognition) {
      elements.voiceTranscriptStatus.textContent = 'Trascrizione non supportata da questo browser.';
      return;
    }

    stopVoiceTranscription();

    const recognition = new SpeechRecognition();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = true;

    state.voice.shouldTranscribe = true;
    state.voice.recognition = recognition;
    elements.voiceTranscriptStatus.textContent = 'Trascrizione attiva.';

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const text = result[0]?.transcript?.trim();

        if (!text) {
          continue;
        }

        if (result.isFinal) {
          finalText = `${finalText} ${text}`.trim();
        } else {
          interimText = `${interimText} ${text}`.trim();
        }
      }

      state.voice.transcriptInterim = interimText;
      renderVoiceTranscripts();

      if (finalText && state.voice.channelId && state.socket?.connected) {
        state.socket.emit('voice_transcript', {
          channelId: state.voice.channelId,
          text: finalText
        });
      }
    };

    recognition.onerror = () => {
      elements.voiceTranscriptStatus.textContent = 'Trascrizione interrotta dal browser.';
    };

    recognition.onend = () => {
      state.voice.recognition = null;

      if (state.voice.shouldTranscribe && state.voice.channelId) {
        window.setTimeout(startVoiceTranscription, 500);
        return;
      }

      elements.voiceTranscriptStatus.textContent = state.voice.channelId
        ? 'Trascrizione ferma.'
        : 'Disponibile dopo l\'ingresso nel canale.';
    };

    try {
      recognition.start();
    } catch {
      state.voice.recognition = null;
      state.voice.shouldTranscribe = false;
      elements.voiceTranscriptStatus.textContent = 'Trascrizione non avviata dal browser.';
    }
  };

  const renderVoicePanel = () => {
    const channel = activeChannel();

    elements.emptyState.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.voicePanel.classList.remove('hidden');
    elements.voiceTitle.textContent = channel?.name || 'Canale vocale';
    elements.voiceStatus.textContent = state.voice.channelId === channel?.id
      ? 'Sei nel canale vocale.'
      : 'Entra nel canale per parlare.';
    elements.voiceTranscriptStatus.textContent = state.voice.channelId === channel?.id
      ? elements.voiceTranscriptStatus.textContent
      : 'Disponibile dopo l\'ingresso nel canale.';
    elements.joinVoiceButton.classList.toggle('hidden', state.voice.channelId === channel?.id);
    elements.leaveVoiceButton.classList.toggle('hidden', state.voice.channelId !== channel?.id);
    renderVoiceParticipants();
    renderVoiceTranscripts();
  };

  Object.assign(app, {
    renderVoiceParticipants,
    getSpeechRecognitionConstructor,
    renderVoiceTranscripts,
    addVoiceTranscript,
    stopVoiceTranscription,
    startVoiceTranscription,
    renderVoicePanel
  });
};
