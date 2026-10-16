const MIN_WIDTH = 240;
const MAX_WIDTH = 420;
const STORAGE_KEY = 'unichat:sidebar-width';

export const registerShellLayoutController = (app) => {
  const { state, elements } = app;
  const shell = document.querySelector('#appShell');
  const sidebar = document.querySelector('#appSidebar');
  const resizer = document.querySelector('#sidebarResizer');
  const backdrop = document.querySelector('#sidebarBackdrop');
  const mobileToggle = document.querySelector('#mobileNavToggle');
  const contextMenu = document.querySelector('#serverContextMenu');
  const primaryNav = document.querySelector('#sidebarPrimaryNav');
  const homeNav = document.querySelector('#sidebarHomeButton');
  const friendsNav = document.querySelector('#sidebarFriendsButton');
  const dmsNav = document.querySelector('#sidebarDmsButton');
  const inviteButton = document.querySelector('#addServerInviteButton');
  const directMessageList = document.querySelector('#directMessageList');
  const directMessagesBadge = document.querySelector('#directMessagesBadge');
  const homePanel = document.querySelector('#homePanel');
  const memberPanel = document.querySelector('#memberPanel');
  const memberToggle = document.querySelector('#memberToggleButton');
  const friendDialog = document.querySelector('#friendDialog');
  const inviteDialog = document.querySelector('#inviteDialog');
  const serverSettingsDialog = document.querySelector('#serverSettingsDialog');
  const serverSettingsForm = document.querySelector('#serverSettingsForm');
  let serverSettingsServerId = null;
  let menuServer = null;
  let menuTrigger = null;
  let lastMobileTrigger = null;

  const width = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(value) || 320));
  const setWidth = (value, persist = false) => {
    const next = width(value);
    shell.style.setProperty('--sidebar-width', `${next}px`);
    resizer.setAttribute('aria-valuenow', String(next));
    if (persist) { try { localStorage.setItem(STORAGE_KEY, String(next)); } catch {} }
  };
  try { setWidth(localStorage.getItem(STORAGE_KEY)); } catch { setWidth(320); }

  const setMobileNav = (open) => {
    const visible = Boolean(open && state.user && matchMedia('(max-width: 850px)').matches);
    shell.classList.toggle('mobile-nav-open', visible);
    mobileToggle.setAttribute('aria-expanded', String(visible));
    mobileToggle.setAttribute('aria-label', visible ? 'Chiudi navigazione' : state.activeChannelId || state.activePrivateUserId ? 'Torna all’elenco' : 'Apri navigazione');
    if (visible) {
      sidebar.inert = false;
      sidebar.removeAttribute('aria-hidden');
      sidebar.setAttribute('role', 'dialog');
      sidebar.setAttribute('aria-modal', 'true');
      lastMobileTrigger = document.activeElement;
      homeNav.focus();
    } else if (open === false && lastMobileTrigger && sidebar.contains(document.activeElement)) {
      lastMobileTrigger.focus();
    }
    if (!visible && state.user && matchMedia('(max-width: 850px)').matches) {
      sidebar.inert = true;
      sidebar.setAttribute('aria-hidden', 'true');
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    } else if (!visible) {
      sidebar.inert = false;
      sidebar.removeAttribute('aria-hidden');
      sidebar.removeAttribute('role');
      sidebar.removeAttribute('aria-modal');
    }
  };

  const closeMenu = (restoreFocus = false) => {
    contextMenu.classList.add('hidden');
    contextMenu.replaceChildren();
    menuServer = null;
    if (restoreFocus) menuTrigger?.focus();
  };

  const openServerSettings = (server) => {
    serverSettingsServerId = server.id;
    const canManageInvites = server.ownerId === state.user?.id || server.members?.some((member) => member.user.id === state.user?.id && member.isAdmin) || state.user?.role === 'SUPERADMIN';
    document.querySelector('#serverInviteSettings').classList.toggle('hidden', !canManageInvites);
    document.querySelector('#serverSettingsTitle').textContent = `Impostazioni · ${server.name}`;
    document.querySelector('#serverSettingsName').value = server.name;
    document.querySelector('#serverSettingsDescription').value = server.description || '';
    document.querySelector('#serverInviteLink').classList.add('hidden');
    elements.inviteExpiresAt.value = '';
    elements.inviteMaxUses.value = '';
    serverSettingsDialog.showModal();
    document.querySelector('#serverSettingsName').focus();
  };

  const showPanel = (panel) => {
    state.activeOverviewPanel = panel;
    app.renderOverviewBar();
    if (panel === 'friendSearch') state.friendsExpanded = true;
    app.renderFriends();
  };

  const showServerMenu = (server, trigger, clientX, clientY) => {
    if (!state.user) return;
    closeMenu();
    menuServer = server;
    menuTrigger = trigger;
    const canManage = server.ownerId === state.user.id || server.members?.some((member) => member.user.id === state.user.id && member.isAdmin) || state.user.role === 'SUPERADMIN';
    const action = (label, callback, danger = false) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.role = 'menuitem';
      button.textContent = label;
      if (danger) button.className = 'danger';
      button.addEventListener('click', async () => {
        closeMenu();
        try {
          await app.selectServer(server.id);
          await callback();
        } catch (error) {
          app.showToast(error.message);
        }
      });
      contextMenu.append(button);
    };
    if (canManage) {
      action('Crea canale', () => { setMobileNav(true); showPanel('channels'); elements.channelForm.classList.remove('hidden'); document.querySelector('#createChannelToggle').setAttribute('aria-expanded', 'true'); elements.channelForm.querySelector('input').focus(); });
      action('Copia invito', () => app.copyActiveServerInvite());
    }
    if (canManage || ['ADMIN', 'PLATFORM_ADMIN'].includes(state.user.role)) {
      action('Impostazioni server', () => { setMobileNav(false); openServerSettings(server); });
    }
    action(server.ownerId === state.user.id ? 'Elimina server' : 'Lascia server', () => app.deleteOrLeaveActiveServer(), true);
    contextMenu.classList.remove('hidden');
    const rect = contextMenu.getBoundingClientRect();
    contextMenu.style.left = `${Math.max(8, Math.min(clientX, innerWidth - rect.width - 8))}px`;
    contextMenu.style.top = `${Math.max(8, Math.min(clientY, innerHeight - rect.height - 8))}px`;
    contextMenu.querySelector('button')?.focus();
  };

  const renderDirectMessages = () => {
    const focusedUser = directMessageList.contains(document.activeElement) ? document.activeElement.dataset.userId : null;
    directMessageList.replaceChildren();
    directMessagesBadge.textContent = String(state.friends.length);
    if (!state.friends.length) {
      const empty = document.createElement('p');
      empty.className = 'sidebar-empty';
      empty.textContent = 'Nessun amico. Aggiungine uno dalla sezione Amici.';
      directMessageList.append(empty);
      return;
    }
    for (const friendship of state.friends) {
      const user = friendship.friend;
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'direct-message-link';
      button.textContent = user.fullName;
      button.title = user.fullName;
      button.dataset.userId = user.id;
      button.setAttribute('aria-label', `Apri conversazione con ${user.fullName}`);
      if (state.activeConversationType === 'private' && state.activePrivateUserId === user.id) button.setAttribute('aria-current', 'page');
      button.addEventListener('click', async () => { await app.selectPrivateChat(user); setMobileNav(false); });
      directMessageList.append(button);
    }
    if (focusedUser) [...directMessageList.querySelectorAll('button')].find((button) => button.dataset.userId === focusedUser)?.focus();
  };

  const renderLayout = () => {
    const authenticated = Boolean(state.user);
    shell.classList.toggle('authenticated', authenticated);
    shell.classList.toggle('has-server', authenticated && Boolean(state.activeServerId));
    primaryNav.classList.toggle('hidden', !authenticated);
    inviteButton.classList.toggle('hidden', !authenticated);
    elements.newServerButton.classList.toggle('hidden', !authenticated);
    elements.gameRailButton.classList.toggle('hidden', !authenticated);
    if (!authenticated) setMobileNav(false);
    else if (!shell.classList.contains('mobile-nav-open')) {
      sidebar.inert = matchMedia('(max-width: 850px)').matches;
      if (sidebar.inert) sidebar.setAttribute('aria-hidden', 'true');
      else sidebar.removeAttribute('aria-hidden');
    }
    homeNav.classList.toggle('active', !state.activeServerId && state.activeOverviewPanel === 'friendSearch');
    friendsNav.classList.toggle('active', state.activeOverviewPanel === 'friendSearch');
    dmsNav.classList.toggle('active', state.activeOverviewPanel === 'directMessages');
    for (const button of [homeNav, friendsNav, dmsNav]) {
      if (button.classList.contains('active')) button.setAttribute('aria-current', 'page');
      else button.removeAttribute('aria-current');
    }
    renderDirectMessages();
    mobileToggle.textContent = state.activeChannelId || state.activePrivateUserId ? '←' : '☰';
    if (!shell.classList.contains('mobile-nav-open')) mobileToggle.setAttribute('aria-label', state.activeChannelId || state.activePrivateUserId ? 'Torna all’elenco' : 'Apri navigazione');
    memberToggle.classList.toggle('hidden', !authenticated || !state.activeServerId);
    if (!authenticated || !state.activeServerId) {
      memberPanel.classList.add('hidden');
      memberToggle.setAttribute('aria-expanded', 'false');
      elements.contentArea.classList.remove('members-open');
    }
  };

  const setupSectionNavigation = (container, labels) => {
    const sections = [...container.querySelectorAll(':scope > .admin-section, :scope > .settings-section, :scope > .settings-form')];
    const nav = document.createElement('nav');
    nav.className = 'section-navigation';
    nav.setAttribute('aria-label', labels.aria);
    const body = document.createElement('div');
    body.className = 'section-content';
    sections.forEach((section, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = labels.items[index];
      button.addEventListener('click', () => {
        sections.forEach((item, itemIndex) => item.classList.toggle('hidden', itemIndex !== index));
        [...nav.children].forEach((item, itemIndex) => {
          item.classList.toggle('active', itemIndex === index);
          item.setAttribute('aria-current', itemIndex === index ? 'page' : 'false');
        });
        const heading = section.querySelector('h2, h3');
        if (heading) { heading.tabIndex = -1; heading.focus(); }
        else section.querySelector('input')?.focus();
      });
      nav.append(button);
      body.append(section);
      section.classList.toggle('hidden', index !== 0);
    });
    nav.firstElementChild?.classList.add('active');
    nav.firstElementChild?.setAttribute('aria-current', 'page');
    container.append(nav, body);
  };

  const setupShellLayout = () => {
    sidebar.insertBefore(elements.overviewBar, elements.userDock);
    elements.overviewBar.classList.add('sidebar-overview');
    document.querySelector('#homeFriendsSlot').append(elements.friendCounterButton, elements.friendList);
    document.querySelector('#homeRequestsSlot').append(elements.friendRequestList);
    document.querySelector('#homeServerRequestsSlot').append(elements.serverJoinRequestList);
    document.querySelector('#friendDialogSlot').append(elements.friendForm, elements.friendSearchList);
    document.querySelector('#inviteDialogSlot').append(elements.inviteForm);
    document.querySelector('#serverSettingsInviteSlot').append(elements.copyInviteButton, elements.inviteManage);
    document.querySelector('#serverSettingsDangerSlot').append(elements.deleteServerButton);
    document.querySelector('#closeServerSettingsDialog').addEventListener('click', () => serverSettingsDialog.close());
    serverSettingsDialog.addEventListener('close', () => { serverSettingsServerId = null; });
    serverSettingsForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const server = state.servers.find((item) => item.id === serverSettingsServerId);
      if (!server) return;
      const submit = serverSettingsForm.querySelector('[type="submit"]');
      submit.disabled = true;
      try {
        const updated = await app.api(`/admin/servers/${server.id}`, { method: 'PATCH', body: JSON.stringify({
          name: document.querySelector('#serverSettingsName').value,
          description: document.querySelector('#serverSettingsDescription').value
        }) });
        Object.assign(server, updated);
        app.renderServers();
        app.renderChannels();
        serverSettingsDialog.close();
        app.showToast('Impostazioni server salvate');
      } catch (error) { app.showToast(error.message); }
      finally { submit.disabled = false; }
    });
    setupSectionNavigation(elements.adminPanel, { aria: 'Sezioni amministrazione', items: ['Sicurezza', 'Utenti', 'Server', 'Messaggi', 'Registro'] });
    setupSectionNavigation(document.querySelector('.settings-panel'), { aria: 'Sezioni impostazioni', items: ['Profilo', 'Blocca amici', 'Utenti bloccati'] });
    document.querySelector('#addFriendButton').addEventListener('click', () => { friendDialog.showModal(); elements.friendUsernameInput.focus(); });
    document.querySelector('#closeFriendDialog').addEventListener('click', () => friendDialog.close());
    document.querySelector('#closeInviteDialog').addEventListener('click', () => inviteDialog.close());
    document.querySelector('#createChannelToggle').addEventListener('click', (event) => {
      const open = elements.channelForm.classList.toggle('hidden') === false;
      event.currentTarget.setAttribute('aria-expanded', String(open));
      if (open) elements.channelForm.querySelector('input').focus();
    });
    memberToggle.addEventListener('click', () => {
      const open = memberPanel.classList.toggle('hidden') === false;
      elements.contentArea.classList.toggle('members-open', open);
      memberToggle.setAttribute('aria-expanded', String(open));
    });
    document.querySelector('#closeMemberPanel').addEventListener('click', () => { memberPanel.classList.add('hidden'); elements.contentArea.classList.remove('members-open'); memberToggle.setAttribute('aria-expanded', 'false'); memberToggle.focus(); });
    mobileToggle.addEventListener('click', () => setMobileNav(!shell.classList.contains('mobile-nav-open')));
    backdrop.addEventListener('click', () => setMobileNav(false));
    homeNav.addEventListener('click', async () => { await app.showHome(); setMobileNav(false); });
    friendsNav.addEventListener('click', async () => { await app.showHome(); setMobileNav(false); homePanel.querySelector('h2')?.focus(); });
    dmsNav.addEventListener('click', async () => { await app.showHome(); setMobileNav(true); directMessageList.querySelector('button')?.focus(); });
    inviteButton.addEventListener('click', () => { inviteDialog.showModal(); elements.inviteCodeInput.focus(); });
    document.addEventListener('pointerdown', (event) => { if (!contextMenu.contains(event.target) && !event.target.closest('.server-menu-trigger')) closeMenu(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        if (!contextMenu.classList.contains('hidden')) closeMenu(true);
        else if (!memberPanel.classList.contains('hidden')) {
          memberPanel.classList.add('hidden');
          elements.contentArea.classList.remove('members-open');
          memberToggle.setAttribute('aria-expanded', 'false');
          memberToggle.focus();
        } else setMobileNav(false);
      }
      if (event.key === 'Tab' && shell.classList.contains('mobile-nav-open') && !document.querySelector('dialog[open]')) {
        const focusable = [...sidebar.querySelectorAll('button, input, select, textarea, a[href]')]
          .filter((item) => !item.disabled && item.getClientRects().length);
        if (focusable.length) {
          const first = focusable[0];
          const last = focusable.at(-1);
          if (event.shiftKey && document.activeElement === first) { last.focus(); event.preventDefault(); }
          else if (!event.shiftKey && document.activeElement === last) { first.focus(); event.preventDefault(); }
        }
      }
      if (!contextMenu.classList.contains('hidden') && ['ArrowDown', 'ArrowUp'].includes(event.key)) {
        const buttons = [...contextMenu.querySelectorAll('button')];
        const current = buttons.indexOf(document.activeElement);
        buttons[(current + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
        event.preventDefault();
      }
    });
    let dragging = false;
    resizer.addEventListener('pointerdown', (event) => {
      if (matchMedia('(max-width: 850px)').matches) return;
      dragging = true;
      resizer.setPointerCapture(event.pointerId);
      shell.classList.add('resizing-sidebar');
      event.preventDefault();
    });
    resizer.addEventListener('pointermove', (event) => { if (dragging) setWidth(event.clientX - elements.serverList.closest('.server-rail').getBoundingClientRect().width); });
    const endDrag = () => { if (!dragging) return; dragging = false; shell.classList.remove('resizing-sidebar'); try { localStorage.setItem(STORAGE_KEY, resizer.getAttribute('aria-valuenow')); } catch {} };
    resizer.addEventListener('pointerup', endDrag);
    resizer.addEventListener('lostpointercapture', endDrag);
    resizer.addEventListener('keydown', (event) => {
      const current = Number(resizer.getAttribute('aria-valuenow'));
      const next = event.key === 'ArrowLeft' ? current - 16 : event.key === 'ArrowRight' ? current + 16 : event.key === 'Home' ? MIN_WIDTH : event.key === 'End' ? MAX_WIDTH : null;
      if (next !== null) { setWidth(next, true); event.preventDefault(); }
    });
    matchMedia('(max-width: 850px)').addEventListener('change', () => setMobileNav(false));
    renderLayout();
  };

  Object.assign(app, { setupShellLayout, renderLayout, renderDirectMessages, showServerMenu, openServerSettings, closeMobileNav: () => setMobileNav(false), closeServerMenu: closeMenu });
};
