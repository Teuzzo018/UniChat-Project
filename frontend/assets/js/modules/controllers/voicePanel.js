/**
 * ============================================================================
 * CONTROLLER PANNELLO VOCALE (voicePanel.js)
 * 1. Rendering griglia vocale: visualizzazione riquadri video e avatar partecipanti
 * 2. Anteprima periferiche: anteprima locale webcam e microfono prima di entrare
 * 3. Indicatori parlante: evidenziazione visiva dell'utente che sta parlando
 * ============================================================================
 */
export const registerVoicePanelController = (app) => {
  const { state, elements } = app;

  const renderVoicePanel = () => {
    const channel = app.activeChannel();
    elements.emptyState.classList.add('hidden');
    elements.messages.classList.add('hidden');
    elements.messageForm.classList.add('hidden');
    elements.callHistory.classList.add('hidden');
    elements.voicePanel.classList.remove('hidden');
    elements.voiceTitle.textContent = channel?.name || 'Chat vocale';
    elements.voiceStatus.textContent = state.voice.channelId === channel?.id
      ? 'Sei nella chat vocale.'
      : 'Controlla webcam e microfono, poi premi Entra.';
    app.renderVoiceControls?.();
  };

  Object.assign(app, { renderVoicePanel });
};
