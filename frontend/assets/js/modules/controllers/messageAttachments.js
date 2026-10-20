export const registerMessageAttachmentsController = (app) => {
  const { state, elements, api, formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES, appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } = app;
  const activePrivateUser = (...args) => app.activePrivateUser(...args);
  const renderMessage = (...args) => app.renderMessage(...args);
  const activeBlobUrls = new Set();
  let attachmentLimits = { maxBytes: MAX_ATTACHMENT_BYTES, maxFilesPerMessage: 1, allowedExtensions: [] };
  const loadAttachmentLimits = async () => {
    attachmentLimits = await api('/uploads/config');
    elements.messageFileInput.disabled = attachmentLimits.maxFilesPerMessage === 0;
  };
  const releaseAttachments = () => {
    for (const url of activeBlobUrls) URL.revokeObjectURL(url);
    activeBlobUrls.clear();
  };

  const validateAttachment = (file) => {
    if (!file) {
      return true;
    }

    if (attachmentLimits.maxFilesPerMessage === 0) {
      showToast('Allegati disabilitati');
      return false;
    }
    if (file.size > attachmentLimits.maxBytes) {
      showToast(`Allegato troppo grande: massimo ${formatBytes(attachmentLimits.maxBytes)}`);
      return false;
    }

    if (!isAllowedAttachment(file) || (attachmentLimits.allowedExtensions.length &&
      !attachmentLimits.allowedExtensions.includes(file.name.split('.').pop()?.toLowerCase()))) {
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
    const wrapperUrls = new Set();
    wrapper.releasePrivateFile = () => {
      for (const url of wrapperUrls) {
        URL.revokeObjectURL(url);
        activeBlobUrls.delete(url);
      }
      wrapperUrls.clear();
    };

    const attachmentPath = new URL(message.attachmentUrl, window.location.origin);
    if (attachmentPath.origin !== window.location.origin || !(/^\/uploads\/[a-zA-Z0-9._-]+$/.test(attachmentPath.pathname)
      || /^\/private-uploads\/[a-f0-9]{32}$/.test(attachmentPath.pathname))) {
      return null;
    }
    const loadPrivateFile = async (setUrl) => {
      try {
        const fileEndpoint = attachmentPath.pathname.startsWith('/uploads/')
          ? `/api${attachmentPath.pathname}` : `/api/uploads${attachmentPath.pathname}`;
        const response = await fetch(fileEndpoint, {
          headers: { Authorization: `Bearer ${state.token}` }
        });
        if (!response.ok) throw new Error('Allegato non disponibile');
        const content = await response.blob();
        const safeType = ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'video/webm',
          'audio/mpeg', 'audio/ogg', 'audio/wav'].includes(message.attachmentMimeType)
          ? message.attachmentMimeType : 'application/octet-stream';
        const objectUrl = URL.createObjectURL(new Blob([content], { type: safeType }));
        if (!wrapper.isConnected) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        activeBlobUrls.add(objectUrl);
        wrapperUrls.add(objectUrl);
        setUrl(objectUrl);
      } catch (error) { showToast(error.message); }
    };

    if (isImageAttachment(message)) {
      const link = document.createElement('a');
      loadPrivateFile((url) => { link.href = url; image.src = url; });
      link.target = '_blank';
      link.rel = 'noopener';
      const image = document.createElement('img');
      image.alt = message.attachmentName || 'Allegato';
      link.append(image);
      wrapper.append(link);
      return wrapper;
    }

    if (isVideoAttachment(message)) {
      const video = document.createElement('video');
      loadPrivateFile((url) => { video.src = url; });
      video.controls = true;
      wrapper.append(video);
      return wrapper;
    }

    if (isAudioAttachment(message)) {
      const audio = document.createElement('audio');
      loadPrivateFile((url) => { audio.src = url; });
      audio.controls = true;
      wrapper.append(audio);
      return wrapper;
    }

    const link = document.createElement('a');
    link.className = 'document-attachment';
    link.href = '#';
    link.addEventListener('click', async (event) => {
      event.preventDefault();
      if (link.dataset.loading) return;
      link.dataset.loading = 'true';
      try {
        const fileEndpoint = attachmentPath.pathname.startsWith('/uploads/')
          ? `/api${attachmentPath.pathname}` : `/api/uploads${attachmentPath.pathname}`;
        const response = await fetch(fileEndpoint, { headers: { Authorization: `Bearer ${state.token}` } });
        if (!response.ok) throw new Error('Allegato non disponibile');
        const url = URL.createObjectURL(await response.blob());
        const download = document.createElement('a');
        download.href = url;
        download.download = message.attachmentName || 'allegato';
        download.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      } catch (error) { showToast(error.message); }
      finally { delete link.dataset.loading; }
    });
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
    let path = null;
    const conversation = state.activeConversationType;
    const peerId = state.activePrivateUserId;
    const channelId = state.activeChannelId;

    if (conversation === 'private') {
      const privateUser = activePrivateUser();
      if (!privateUser) return;
      path = `/private/${privateUser.id}/messages`;
    } else if (file && channelId) {
      path = `/channels/${channelId}/messages`;
    }
    if (!path) return;
    const status = document.createElement('span');
    status.textContent = file ? 'Caricamento 0%' : 'Invio in corso';
    elements.messageAttachmentPreview.classList.remove('hidden');
    elements.messageAttachmentPreview.append(status);
    const submit = elements.messageForm.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    elements.messageFileInput.disabled = true;
    let message;
    try {
      message = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api${path}`);
        xhr.setRequestHeader('Authorization', `Bearer ${state.token}`);
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) status.textContent = `Caricamento ${Math.round(100 * event.loaded / event.total)}%`;
        });
        xhr.addEventListener('load', () => {
          let result;
          try { result = JSON.parse(xhr.responseText); } catch { result = {}; }
          if (xhr.status >= 200 && xhr.status < 300) resolve(result);
          else reject(new Error(result.error || 'Upload non riuscito'));
        });
        xhr.addEventListener('error', () => reject(new Error('Connessione interrotta durante l’upload')));
        xhr.send(formData);
      });
    } finally {
      status.remove();
      if (submit) submit.disabled = false;
      elements.messageFileInput.disabled = attachmentLimits.maxFilesPerMessage === 0;
      if (!elements.messageAttachmentPreview.children.length) elements.messageAttachmentPreview.classList.add('hidden');
    }
    if (message && conversation === state.activeConversationType && peerId === state.activePrivateUserId &&
      channelId === state.activeChannelId && !elements.messages.querySelector(`[data-message-id="${message.id}"]`)) {
      renderMessage(message);
      elements.messages.scrollTop = elements.messages.scrollHeight;
    }
    return message;
  };

  Object.assign(app, {
    loadAttachmentLimits,
    releaseAttachmentElement: (wrapper) => wrapper?.releasePrivateFile?.(),
    validateAttachment,
    renderSelectedAttachment,
    renderAttachment,
    releaseAttachments,
    buildMessageFormData,
    clearComposer,
    sendMessageWithUpload
  });
};
