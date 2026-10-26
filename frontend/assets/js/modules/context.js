import { api } from './api.js';
import { formatBytes, isAllowedAttachment, isAudioAttachment, isImageAttachment, isVideoAttachment, MAX_ATTACHMENT_BYTES } from './attachments.js';
import { elements, startSplashScreenTimers } from './dom.js';
import { state } from './state.js';
import { appendMessageContent, createUserAvatar, getDisplayHandle, getInitials, renderAvatarContent, setBadgeCount, showConfirm, showToast } from './ui.js';

// 1. Creazione e aggregazione del contesto condiviso dell'applicazione (AppContext)
export const createAppContext = () => ({
  // 1.1 Funzione client per chiamate REST protette da token
  api,
  // 1.2 Mappa dei riferimenti agli elementi DOM dell'interfaccia
  elements,
  // 1.3 Stato reattivo globale dell'applicazione
  state,
  // 1.4 Timer e gestione della schermata di splash
  startSplashScreenTimers,
  // 1.5 Utility per gestione e validazione allegati
  formatBytes,
  isAllowedAttachment,
  isAudioAttachment,
  isImageAttachment,
  isVideoAttachment,
  MAX_ATTACHMENT_BYTES,
  // 1.6 Utility UI per rendering messaggi, avatar, notifiche e toast
  appendMessageContent,
  createUserAvatar,
  getDisplayHandle,
  getInitials,
  renderAvatarContent,
  setBadgeCount,
  showConfirm,
  showToast
});

