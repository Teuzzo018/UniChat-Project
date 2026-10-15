export const registerAdminController = (app) => {
  const { state, elements, api, showConfirm, showToast } = app;
  let page = 1;
  let loading = false;

  const row = (title, detail) => {
    const item = document.createElement('div');
    item.className = 'admin-item';
    const info = document.createElement('div');
    const heading = document.createElement('strong');
    heading.textContent = title;
    const text = document.createElement('span');
    text.textContent = detail;
    info.append(heading, text);
    const actions = document.createElement('div');
    actions.className = 'admin-actions';
    item.append(info, actions);
    return { item, actions };
  };
  const action = (container, label, handler, destructive = false) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = destructive ? 'danger-button' : 'secondary-button';
    button.textContent = label;
    button.addEventListener('click', handler);
    container.append(button);
  };
  const empty = (container, message) => {
    const note = document.createElement('p');
    note.textContent = message;
    container.append(note);
  };
  const mutate = async (path, method, body, confirmation) => {
    if (confirmation && !await showConfirm(confirmation, 'Conferma')) return;
    try {
      elements.adminStatus.textContent = 'Operazione in corso…';
      await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      showToast('Operazione completata');
      await loadAdminPanel();
      state.servers = await api('/servers');
      app.renderServers();
      app.renderChannels();
    } catch (error) {
      elements.adminStatus.textContent = error.message;
      showToast(error.message);
      if (error.mfaStepUpRequired) elements.mfaCode.focus();
      if (error.mfaSetupRequired) elements.mfaPassword.focus();
    }
  };
  const renderAdminPanel = ({ users, servers, messages, pagination, capabilities }, audit) => {
    const { global, superadmin } = capabilities;
    for (const element of [elements.adminUsers, elements.adminServers, elements.adminMessages, elements.adminAudit]) element.replaceChildren();
    for (const user of users) {
      const { item, actions } = row(`${user.fullName} (${user.role})`,
        `${user.email} · ${user.university?.name || 'Nessuna università'}${user.suspendedAt ? ' · Sospeso' : ''}`);
      const ordinary = !['ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN'].includes(user.role)
        && !user._count.ownedServers && !user._count.servers;
      if (global && user.id !== state.user.id && (superadmin || ordinary)) action(actions,
        user.suspendedAt ? 'Riattiva' : 'Sospendi',
        () => mutate(`/admin/users/${user.id}/suspension`, user.suspendedAt ? 'DELETE' : 'POST', null,
          `${user.suspendedAt ? 'Riattivare' : 'Sospendere'} ${user.fullName}?`), !user.suspendedAt);
      if (superadmin && user.id !== state.user.id) {
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Ruolo di ${user.fullName}`);
        for (const role of ['STUDENT', 'PROFESSOR', 'PLATFORM_ADMIN', 'SUPERADMIN']) {
          const option = document.createElement('option');
          option.value = role;
          option.textContent = role;
          select.append(option);
        }
        select.value = user.role === 'ADMIN' ? 'PLATFORM_ADMIN' : user.role;
        select.addEventListener('change', async () => {
          await mutate(`/admin/users/${user.id}/role`, 'PATCH', { role: select.value },
            `Assegnare il ruolo ${select.value} a ${user.fullName}?`);
          select.value = user.role === 'ADMIN' ? 'PLATFORM_ADMIN' : user.role;
        });
        actions.append(select);
        if (user.role !== 'SUPERADMIN') action(actions, 'Elimina account', () => mutate(
          `/admin/users/${user.id}`, 'DELETE', null, `Eliminare definitivamente ${user.fullName}?`), true);
      }
      elements.adminUsers.append(item);
    }
    if (!users.length) empty(elements.adminUsers, 'Nessun account trovato.');
    elements.adminPageLabel.textContent = `Pagina ${pagination.page} di ${Math.max(1, pagination.pages)} · ${pagination.total} account`;
    elements.adminPrevPage.disabled = pagination.page <= 1;
    elements.adminNextPage.disabled = pagination.page >= pagination.pages;
    for (const server of servers) {
      const { item, actions } = row(server.name,
        `${server.university?.name || 'Università'} · ${server._count.members} membri · ${server._count.channels} canali · proprietario ${server.owner.fullName}`);
      action(actions, 'Modifica', async () => {
        const name = window.prompt('Nome del server', server.name);
        if (name === null) return;
        const description = window.prompt('Descrizione del server', server.description || '');
        if (description !== null) await mutate(`/admin/servers/${server.id}`, 'PATCH', { name, description });
      });
      if (global || server.ownerId === state.user.id) action(actions, 'Elimina server', () => mutate(
        `/admin/servers/${server.id}`, 'DELETE', null, `Eliminare ${server.name}, canali e messaggi?`), true);
      for (const channel of server.channels) action(actions, `Elimina #${channel.name}`, () => mutate(
        `/admin/servers/${server.id}/channels/${channel.id}`, 'DELETE', null,
        `Eliminare il canale ${channel.name} e i suoi messaggi?`), true);
      if (superadmin) for (const membership of server.members) {
        const member = membership.user;
        if (member.id === server.ownerId || member.id === state.user.id) continue;
        action(actions, `${membership.isAdmin ? 'Revoca' : 'Nomina'} admin: ${member.fullName}`, () => mutate(
          `/admin/servers/${server.id}/admins/${member.id}`, membership.isAdmin ? 'DELETE' : 'PUT', null,
          `${membership.isAdmin ? 'Revocare' : 'Assegnare'} i privilegi sul server a ${member.fullName}?`));
      }
      elements.adminServers.append(item);
    }
    if (!servers.length) empty(elements.adminServers, 'Nessun server amministrabile.');
    for (const message of messages) {
      const { item, actions } = row(`${message.user.fullName} · ${message.channel.server.name} / ${message.channel.name}`,
        message.deletedAt ? 'Messaggio eliminato' : message.content || 'Allegato');
      if (!message.deletedAt) action(actions, 'Elimina messaggio', () => mutate(`/admin/messages/${message.id}`, 'DELETE', null,
        'Eliminare questo messaggio?'), true);
      elements.adminMessages.append(item);
    }
    if (!messages.length) empty(elements.adminMessages, 'Nessun messaggio recente.');
    for (const entry of audit.entries) elements.adminAudit.append(row(`${entry.action} · ${entry.outcome}`,
      `${new Date(entry.createdAt).toLocaleString('it-IT')} · autore ${entry.actorId} · ${entry.resourceType} ${entry.resourceId}`).item);
    if (!audit.entries.length) empty(elements.adminAudit, 'Nessuna operazione registrata.');
  };
  const loadAdminPanel = async () => {
    if (loading) return;
    loading = true;
    elements.adminStatus.textContent = 'Caricamento…';
    try {
      const q = encodeURIComponent(elements.adminSearchInput.value.trim());
      const [overview, audit] = await Promise.all([
        api(`/admin/overview?page=${page}&pageSize=20&q=${q}`),
        api('/admin/audit?page=1&pageSize=20')
      ]);
      renderAdminPanel(overview, audit);
      elements.adminStatus.textContent = '';
    } catch (error) {
      for (const element of [elements.adminUsers, elements.adminServers, elements.adminMessages, elements.adminAudit]) element.replaceChildren();
      elements.adminStatus.textContent = error.message;
      showToast(error.message);
    } finally { loading = false; }
  };
  const showAdminPanel = async () => {
    const global = ['ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN'].includes(state.user?.role);
    const local = state.servers.some((server) => server.ownerId === state.user?.id ||
      server.members?.some((member) => member.user.id === state.user?.id && member.isAdmin));
    if (!global && !local) return;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    for (const element of [elements.emptyState, elements.gamePanel, elements.callPanel, elements.voicePanel,
      elements.callHistory, elements.messages, elements.messageForm, elements.videoCallButton]) element.classList.add('hidden');
    elements.adminPanel.classList.remove('hidden');
    document.querySelector('#homePanel').classList.add('hidden');
    elements.channelTitle.textContent = 'Pannello admin';
    elements.channelType.textContent = 'Amministrazione';
    app.renderChannels();
    elements.mfaSecret.textContent = '';
    elements.mfaSecret.classList.add('hidden');
    elements.mfaRecoveryCodes.value = '';
    elements.mfaRecoveryCodes.classList.add('hidden');
    elements.mfaCodesSaved.classList.add('hidden');
    await Promise.all([loadAdminPanel(), loadMfaStatus()]);
  };

  const loadMfaStatus = async () => {
    try {
      const result = await api('/auth/2fa/status');
      elements.mfaStatus.textContent = result.enabled
        ? `Attiva · ${result.recoveryCodesRemaining} codici di recupero rimasti · verifica recente: ${result.recent ? 'sì' : 'no'}`
        : 'Non attiva. Configurala prima di modificare ruoli privilegiati.';
      elements.mfaSetup.disabled = result.enabled;
      for (const button of [elements.mfaStepUp, elements.mfaRegenerate, elements.mfaDisable]) button.disabled = !result.enabled;
      elements.mfaEnable.disabled = result.enabled;
    } catch (error) { elements.mfaStatus.textContent = error.message; }
  };
  const showCodes = (codes) => {
    elements.mfaRecoveryCodes.value = codes.join('\n');
    elements.mfaRecoveryCodes.classList.remove('hidden');
    elements.mfaCodesSaved.classList.remove('hidden');
    elements.mfaRecoveryCodes.focus();
  };
  const mfaAction = async (path, body, after) => {
    try {
      elements.mfaStatus.textContent = 'Verifica in corso…';
      const result = await api(path, { method: 'POST', body: JSON.stringify(body) });
      elements.mfaCode.value = '';
      elements.mfaPassword.value = '';
      after?.(result);
      await loadMfaStatus();
      showToast(result.message || 'Operazione completata');
    } catch (error) {
      elements.mfaStatus.textContent = error.message;
      showToast(error.message);
    }
  };
  elements.mfaSetup.addEventListener('click', () => mfaAction('/auth/2fa/setup',
    { password: elements.mfaPassword.value }, (result) => {
      elements.mfaSecret.textContent = `Chiave manuale: ${result.secret} · URI: ${result.uri}`;
      elements.mfaSecret.classList.remove('hidden');
    }));
  elements.mfaEnable.addEventListener('click', () => mfaAction('/auth/2fa/enable',
    { code: elements.mfaCode.value.trim() }, (result) => {
      elements.mfaSecret.textContent = '';
      elements.mfaSecret.classList.add('hidden');
      showCodes(result.recoveryCodes);
    }));
  elements.mfaStepUp.addEventListener('click', () => mfaAction('/auth/2fa/step-up', { code: elements.mfaCode.value.trim() }));
  elements.mfaRegenerate.addEventListener('click', async () => {
    if (!await showConfirm('I vecchi codici di recupero non funzioneranno più. Continuare?', 'Rigenera')) return;
    await mfaAction('/auth/2fa/recovery-codes',
      { password: elements.mfaPassword.value, code: elements.mfaCode.value.trim() },
      (result) => showCodes(result.recoveryCodes));
  });
  elements.mfaDisable.addEventListener('click', async () => {
    if (!await showConfirm('Disattivare la verifica in due passaggi?', 'Disattiva')) return;
    await mfaAction('/auth/2fa/disable',
      { password: elements.mfaPassword.value, code: elements.mfaCode.value.trim() });
  });
  elements.mfaCodesSaved.addEventListener('click', () => {
    elements.mfaRecoveryCodes.value = '';
    elements.mfaRecoveryCodes.classList.add('hidden');
    elements.mfaCodesSaved.classList.add('hidden');
  });
  elements.adminSearchForm.addEventListener('submit', (event) => { event.preventDefault(); page = 1; loadAdminPanel(); });
  elements.adminPrevPage.addEventListener('click', () => { if (page > 1) { page -= 1; loadAdminPanel(); } });
  elements.adminNextPage.addEventListener('click', () => { page += 1; loadAdminPanel(); });
  Object.assign(app, { renderAdminPanel, loadAdminPanel, showAdminPanel });
};
