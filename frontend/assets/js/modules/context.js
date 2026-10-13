import { api } from './api.js';
import { formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES } from './attachments.js';
import { elements, startSplashScreenTimers } from './dom.js';
import { state } from './state.js';
import { appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } from './ui.js';

export const createAppContext = () => ({
  api,
  elements,
  state,
  startSplashScreenTimers,
  formatBytes,
  isAllowedAttachment,
  isAudioAttachment,
  isImageAttachment,
  isVideoAttachment,
  MAX_ATTACHMENT_BYTES,
  appendMessageContent,
  createUserAvatar,
  getDisplayHandle,
  getInitials,
  renderAvatarContent,
  setBadgeCount,
  showConfirm,
  showToast
});
