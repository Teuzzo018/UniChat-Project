export const registerMessageAttachmentsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  const renderMessage = (...args) => app.renderMessage(...args);

  const validateAttachment = (file) => {
    if (!file) {
      return true;
    }

    if (file.size > MAX_ATTACHMENT_BYTES) {
      showToast(`Allegato troppo grande: massimo ${formatBytes(MAX_ATTACHMENT_BYTES)}`);
      return false;
    }

    if (!isAllowedAttachment(file)) {
      showToast('Formato allegato non supportato');
      return false;
    }

    return true;
  };

  const renderSelectedAttachment = () => {
    const file = elements.messageFileInput.files[0];

    elements.messageAttachmentPreview.replaceChildren();
    elements.messageAttachmentPreview.classList.toggle('hidden', !file);

    if (!file) {
      return;
    }

    const name = document.createElement('span');
    name.textContent = file.name;

    const size = document.createElement('small');
    size.textContent = formatBytes(file.size);

    const removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.title = 'Rimuovi allegato';
    removeButton.textContent = 'x';
    removeButton.addEventListener('click', () => {
      elements.messageFileInput.value = '';
      renderSelectedAttachment();
    });

    elements.messageAttachmentPreview.append(name, size, removeButton);
  };

  const renderAttachment = (message) => {
    if (!message.attachmentUrl) {
      return null;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'message-attachment';

    if (isImageAttachment(message)) {
      const link = document.createElement('a');
      link.href = message.attachmentUrl;
      link.target = '_blank';
      link.rel = 'noopener';
      const image = document.createElement('img');
      image.src = message.attachmentUrl;
      image.alt = message.attachmentName || 'Allegato';
      link.append(image);
      wrapper.append(link);
      return wrapper;
    }

    if (isVideoAttachment(message)) {
      const video = document.createElement('video');
      video.src = message.attachmentUrl;
      video.controls = true;
      wrapper.append(video);
      return wrapper;
    }

    if (isAudioAttachment(message)) {
      const audio = document.createElement('audio');
      audio.src = message.attachmentUrl;
      audio.controls = true;
      wrapper.append(audio);
      return wrapper;
    }

    const link = document.createElement('a');
    link.className = 'document-attachment';
    link.href = message.attachmentUrl;
    link.target = '_blank';
    link.rel = 'noopener';
    link.download = message.attachmentName || '';
    link.textContent = `${message.attachmentName || 'Documento'} (${formatBytes(message.attachmentSize)})`;
    wrapper.append(link);
    return wrapper;
  };

  const buildMessageFormData = () => {
    const formData = new FormData();
    const content = elements.messageInput.value.trim();
    const file = elements.messageFileInput.files[0];

    if (!validateAttachment(file)) {
      return { formData, content, file: null, valid: false };
    }

    if (content) {
      formData.append('content', content);
    }

    if (file) {
      formData.append('file', file);
    }

    return { formData, content, file, valid: true };
  };

  const clearComposer = () => {
    elements.messageInput.value = '';
    elements.messageFileInput.value = '';
    renderSelectedAttachment();
  };

  const sendMessageWithUpload = async ({ formData, file }) => {
    let message = null;

    if (state.activeConversationType === 'private') {
      const privateUser = activePrivateUser();
      if (!privateUser) {
        return;
      }
      message = await api(`/private/${privateUser.id}/messages`, {
        method: 'POST',
        body: formData
      });
    } else if (file && state.activeChannelId) {
      message = await api(`/channels/${state.activeChannelId}/messages`, {
        method: 'POST',
        body: formData
      });
    }

    if (message && !elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
      renderMessage(message);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
  };

  Object.assign(app, {
    validateAttachment,
    renderSelectedAttachment,
    renderAttachment,
    buildMessageFormData,
    clearComposer,
    sendMessageWithUpload
  });
};
