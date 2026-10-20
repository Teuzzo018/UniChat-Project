export const registerAdminController = (app) => {
  const { state, elements, api, showConfirm, showToast } = app;
  const pages = { admin: 1, superadmin: 1 };
  const loading = { admin: false, superadmin: false };
  const viewFor = (mode) => {
    const prefix = mode === 'superadmin' ? 'superAdmin' : 'admin';
    return {
      mode,
      panel: elements[`${prefix}Panel`],
      users: elements[`${prefix}Users`],
      servers: elements[`${prefix}Servers`],
      audit: elements[`${prefix}Audit`],
      status: elements[`${prefix}Status`],
      searchInput: elements[`${prefix}SearchInput`],
      pageLabel: elements[`${prefix}PageLabel`],
      prevPage: elements[`${prefix}PrevPage`],
      nextPage: elements[`${prefix}NextPage`]
    };
  };

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
  const universityForm = document.querySelector('#superAdminUniversityForm');
  const universityList = document.querySelector('#superAdminUniversities');
  const loadUniversityPanel = async () => {
    const universities = await api('/universities');
    universityList.replaceChildren();
    for (const university of universities) universityList.append(row(university.name, university.domain).item);
    if (!universities.length) empty(universityList, 'Nessuna università: aggiungi la prima per aprire le registrazioni ordinarie.');
  };
  const mutate = async (view, path, method, body, confirmation) => {
    if (confirmation && !await showConfirm(confirmation, 'Conferma')) return;
    try {
      view.status.textContent = 'Operazione in corso…';
      await api(path, { method, ...(body ? { body: JSON.stringify(body) } : {}) });
      showToast('Operazione completata');
      await loadAdminPanel(view.mode);
      state.servers = await api('/servers');
      app.renderServers();
      app.renderChannels();
    } catch (error) {
      view.status.textContent = error.message;
      showToast(error.message);
    }
  };
  const renderAdminPanel = ({ users, servers, pagination, capabilities }, audit, view) => {
    const { global, superadmin } = capabilities;
    for (const element of [view.users, view.servers, view.audit]) element.replaceChildren();
    for (const user of users) {
      const creator = user.role === 'SUPERADMIN' && user.email?.toLowerCase() === 'teo.sisto.04@gmail.com';
      const { item, actions } = row(`${user.fullName} (${creator ? 'Creator' : user.role})`,
        `${user.email} · ${creator ? 'Creator' : user.university?.name || 'Nessuna università'}${user.suspendedAt ? ' · Sospeso' : ''}`);
      const ordinary = !['ADMIN', 'PLATFORM_ADMIN', 'SUPERADMIN'].includes(user.role);
      if (global && user.id !== state.user.id && (superadmin || ordinary)) action(actions,
        user.suspendedAt ? 'Riattiva' : 'Sospendi',
        () => mutate(view, `/admin/users/${user.id}/suspension`, user.suspendedAt ? 'DELETE' : 'POST', null,
          `${user.suspendedAt ? 'Riattivare' : 'Sospendere'} ${user.fullName}?`), !user.suspendedAt);
      const canChangeRole = user.id !== state.user.id &&
        (superadmin || global) && ['STUDENT', 'PROFESSOR'].includes(user.role);
      if (canChangeRole && user.role !== 'SUPERADMIN') {
        const select = document.createElement('select');
        select.setAttribute('aria-label', `Ruolo di ${user.fullName}`);
        for (const role of ['STUDENT', 'PROFESSOR']) {
          const option = document.createElement('option');
          option.value = role;
          option.textContent = role === 'PLATFORM_ADMIN' ? 'Admin' : role === 'PROFESSOR' ? 'Professore' : 'Studente';
          select.append(option);
        }
        select.value = user.role;
        select.addEventListener('change', async () => {
          await mutate(view, `/admin/users/${user.id}/role`, 'PATCH', { role: select.value },
            `Assegnare il ruolo ${select.value} a ${user.fullName}?`);
          select.value = user.role;
        });
        actions.append(select);
      }
      if (superadmin && user.id !== state.user.id && user.role !== 'SUPERADMIN') {
        const menu = document.createElement('details');
        const trigger = document.createElement('summary');
        trigger.textContent = '⋯';
        trigger.setAttribute('aria-label', `Azioni SuperAdmin per ${user.fullName}`);
        menu.append(trigger);
        const targetAdmin = ['ADMIN', 'PLATFORM_ADMIN'].includes(user.role);
        action(menu, targetAdmin ? 'Revoca Admin' : 'Rendi Admin', () => mutate(view,
          `/admin/users/${user.id}/role`, 'PATCH', { role: targetAdmin ? 'STUDENT' : 'PLATFORM_ADMIN' },
          `${targetAdmin ? 'Revocare il ruolo Admin a' : 'Rendere Admin'} ${user.fullName}?`));
        action(menu, 'Elimina account', () => mutate(view,
          `/admin/users/${user.id}`, 'DELETE', null, `Eliminare definitivamente ${user.fullName}?`), true);
        actions.append(menu);
      }
      view.users.append(item);
    }
    if (!users.length) empty(view.users, 'Nessun account trovato.');
    view.pageLabel.textContent = `Pagina ${pagination.page} di ${Math.max(1, pagination.pages)} · ${pagination.total} account`;
    view.prevPage.disabled = pagination.page <= 1;
    view.nextPage.disabled = pagination.page >= pagination.pages;
    for (const server of servers) {
      const { item, actions } = row(server.name,
        `${server.university?.name || 'Università'} · ${server._count.members} membri · ${server._count.channels} canali · proprietario ${server.owner.fullName}`);
      action(actions, 'Modifica', async () => {
        const name = window.prompt('Nome del server', server.name);
        if (name === null) return;
        const description = window.prompt('Descrizione del server', server.description || '');
        if (description !== null) await mutate(view, `/admin/servers/${server.id}`, 'PATCH', { name, description });
      });
      if (global || server.ownerId === state.user.id) action(actions, 'Elimina server', () => mutate(view,
        `/admin/servers/${server.id}`, 'DELETE', null, `Eliminare ${server.name}, canali e messaggi?`), true);
      for (const channel of server.channels) action(actions, `Elimina #${channel.name}`, () => mutate(view,
        `/admin/servers/${server.id}/channels/${channel.id}`, 'DELETE', null,
        `Eliminare il canale ${channel.name} e i suoi messaggi?`), true);
      if (superadmin) for (const membership of server.members) {
        const member = membership.user;
        if (member.id === server.ownerId || member.id === state.user.id) continue;
        action(actions, `${membership.isAdmin ? 'Revoca' : 'Nomina'} admin: ${member.fullName}`, () => mutate(view,
          `/admin/servers/${server.id}/admins/${member.id}`, membership.isAdmin ? 'DELETE' : 'PUT', null,
          `${membership.isAdmin ? 'Revocare' : 'Assegnare'} i privilegi sul server a ${member.fullName}?`));
      }
      view.servers.append(item);
    }
    if (!servers.length) empty(view.servers, 'Nessun server amministrabile.');
    for (const entry of audit.entries) view.audit.append(row(`${entry.action} · ${entry.outcome}`,
      `${new Date(entry.createdAt).toLocaleString('it-IT')} · autore ${entry.actorId} · ${entry.resourceType} ${entry.resourceId}`).item);
    if (!audit.entries.length) empty(view.audit, 'Nessuna operazione registrata.');
  };
  const loadAdminPanel = async (mode = 'admin') => {
    if (loading[mode]) return;
    loading[mode] = true;
    const view = viewFor(mode);
    view.status.textContent = 'Caricamento…';
    try {
      const q = encodeURIComponent(view.searchInput.value.trim());
      const [overview, audit] = await Promise.all([
        api(`/admin/overview?page=${pages[mode]}&pageSize=20&q=${q}`),
        api('/admin/audit?page=1&pageSize=20')
      ]);
      renderAdminPanel(overview, audit, view);
      view.status.textContent = '';
    } catch (error) {
      for (const element of [view.users, view.servers, view.audit]) element.replaceChildren();
      view.status.textContent = error.message;
      showToast(error.message);
    } finally { loading[mode] = false; }
  };
  const showPanel = async (mode) => {
    const superadmin = state.user?.role === 'SUPERADMIN' && state.user.email?.toLowerCase() === 'teo.sisto.04@gmail.com';
    const admin = ['ADMIN', 'PLATFORM_ADMIN'].includes(state.user?.role);
    if (mode === 'superadmin' ? !superadmin : !admin) return;
    state.activeChannelId = null;
    state.activePrivateUserId = null;
    state.activeConversationType = 'channel';
    state.game = null;
    for (const element of [elements.emptyState, elements.gamePanel, elements.callPanel, elements.voicePanel,
      elements.callHistory, elements.messages, elements.messageForm, elements.videoCallButton]) element.classList.add('hidden');
    elements.adminPanel.classList.toggle('hidden', mode !== 'admin');
    elements.superAdminPanel.classList.toggle('hidden', mode !== 'superadmin');
    document.querySelector('#homePanel').classList.add('hidden');
    elements.channelTitle.textContent = mode === 'superadmin' ? 'Pannello SuperAdmin' : 'Pannello Admin';
    elements.channelType.textContent = 'Amministrazione';
    app.renderChannels();
    await loadAdminPanel(mode);
    if (mode === 'superadmin') await loadUniversityPanel();
  };
  universityForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = new FormData(universityForm);
    try {
      await api('/universities', { method: 'POST', body: JSON.stringify({
        name: String(form.get('name') || '').trim(),
        domain: String(form.get('domain') || '').trim().toLowerCase()
      }) });
      universityForm.reset();
      await Promise.all([loadUniversityPanel(), app.loadUniversities()]);
      showToast('Università aggiunta');
    } catch (error) { showToast(error.message); }
  });
  for (const mode of ['admin', 'superadmin']) {
    const view = viewFor(mode);
    elements[`${mode === 'admin' ? 'admin' : 'superAdmin'}SearchForm`].addEventListener('submit', (event) => {
      event.preventDefault(); pages[mode] = 1; loadAdminPanel(mode);
    });
    view.prevPage.addEventListener('click', () => { if (pages[mode] > 1) { pages[mode] -= 1; loadAdminPanel(mode); } });
    view.nextPage.addEventListener('click', () => { pages[mode] += 1; loadAdminPanel(mode); });
  }
  Object.assign(app, { renderAdminPanel, loadAdminPanel, showAdminPanel: () => showPanel('admin'), showSuperAdminPanel: () => showPanel('superadmin') });
};
