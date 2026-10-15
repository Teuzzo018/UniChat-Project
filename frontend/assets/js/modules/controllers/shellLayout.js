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
  let menuServer = null;
  let menuTrigger = null;
  let lastMobileTrigger = null;

  const width = (value) => Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Number(value) || 320));
  const setWidth = (value, persist = false) => {
    const next = width(value);
    shell.style.setProperty('--sidebar-width', `${next}px`);
    resizer.setAttribute('aria-valuenow', String(next));
    if (persist) localStorage.setItem(STORAGE_KEY, String(next));
  };
  try { setWidth(localStorage.getItem(STORAGE_KEY)); } catch { setWidth(320); }

  const setMobileNav = (open) => {
    const visible = Boolean(open && state.user && matchMedia('(max-width: 850px)').matches);
    shell.classList.toggle('mobile-nav-open', visible);
    mobileToggle.setAttribute('aria-expanded', String(visible));
    mobileToggle.setAttribute('aria-label', visible ? 'Chiudi navigazione' : 'Apri navigazione');
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

  const setToolsOpen = (open) => {
    elements.workspacePanel.classList.toggle('tools-open', Boolean(open));
    if (open) elements.workspacePanel.scrollIntoView({ block: 'nearest' });
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
      action('Crea canale', () => { setMobileNav(true); showPanel('channels'); elements.channelForm.querySelector('input').focus(); });
      action('Copia invito', () => app.copyActiveServerInvite());
      action('Impostazioni server', () => { setMobileNav(true); setToolsOpen(true); elements.inviteManage.querySelector('input, button')?.focus(); });
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
  };

  const setupShellLayout = () => {
    sidebar.insertBefore(elements.overviewBar, elements.userDock);
    elements.overviewBar.classList.add('sidebar-overview');
    mobileToggle.addEventListener('click', () => setMobileNav(!shell.classList.contains('mobile-nav-open')));
    backdrop.addEventListener('click', () => setMobileNav(false));
    homeNav.addEventListener('click', async () => { await app.showHome(); showPanel('friendSearch'); setMobileNav(false); });
    friendsNav.addEventListener('click', () => showPanel('friendSearch'));
    dmsNav.addEventListener('click', () => showPanel('directMessages'));
    inviteButton.addEventListener('click', () => { setMobileNav(true); setToolsOpen(true); elements.inviteCodeInput.focus(); });
    elements.overviewTabs.forEach((button) => button.addEventListener('click', () => { if (button.dataset.overviewPanel === 'channels' && !state.activeServerId) return; setToolsOpen(false); }));
    document.addEventListener('pointerdown', (event) => { if (!contextMenu.contains(event.target) && !event.target.closest('.server-menu-trigger')) closeMenu(); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { if (!contextMenu.classList.contains('hidden')) closeMenu(true); else setMobileNav(false); }
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

  Object.assign(app, { setupShellLayout, renderLayout, renderDirectMessages, showServerMenu, closeMobileNav: () => setMobileNav(false), closeServerMenu: closeMenu });
};
