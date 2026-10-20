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
