/**
 * ============================================================================
 * CONTROLLER COMANDI SLASH (slashCommands.js)
 * 1. Parsing comandi: riconoscimento comandi speciali nella barra messaggi (es. /help, /roll)
 * 2. Esecuzione comandi: invio azione corrispondente o rendering messaggio di aiuto
 * ============================================================================
 */
const commands = [
  { name: 'tris', label: 'Gioca a Tris', action: (app) => app.startPrivateGame(app.state.activePrivateUserId, 'TICTACTOE') },
  { name: 'impiccato', label: 'Gioca a Impiccato', action: (app) => app.startPrivateGame(app.state.activePrivateUserId, 'HANGMAN') },
  { name: 'call', label: 'Avvia chiamata audio', action: (app) => app.startVideoCall('audio') },
  { name: 'videocall', label: 'Avvia videochiamata', action: (app) => app.startVideoCall('video') }
];

export const registerSlashCommandsController = (app) => {
  const { state, elements } = app;
  const menu = document.querySelector('#slashCommandMenu');
  const input = elements.messageInput;
  let matches = [];
  let selected = 0;

  const available = () => state.activeConversationType === 'private'
    && Boolean(app.activePrivateUser())
    && !elements.messageForm.classList.contains('hidden')
    && !elements.messageFileInput.files.length;

  const close = () => {
    matches = [];
    menu.replaceChildren();
    menu.classList.add('hidden');
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
  };

  const activeSlash = () => input.value.match(/(^|\s)\/([a-z]*)$/i);

  const choose = (command) => {
    if (!command || !available()) return false;
    const slash = activeSlash();
    close();
    input.value = slash ? `${input.value.slice(0, slash.index + slash[1].length)}/${command.name}` : `/${command.name}`;
    input.focus();
    return true;
  };

  const render = () => {
    const slash = activeSlash();
    if (!available() || !slash) return close();
    matches = commands.filter(({ name }) => name.startsWith(slash[2].toLowerCase()));
    if (!matches.length) return close();
    selected = Math.min(selected, matches.length - 1);
    menu.replaceChildren();
    matches.forEach((command, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.id = `slash-command-${command.name}`;
      option.className = 'slash-command-option';
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === selected));
      const name = document.createElement('strong');
      name.textContent = `/${command.name}`;
      const description = document.createElement('span');
      description.textContent = command.label;
      option.append(name, description);
      option.addEventListener('click', () => choose(command));
      menu.append(option);
    });
    menu.classList.remove('hidden');
    input.setAttribute('aria-expanded', 'true');
    input.setAttribute('aria-activedescendant', `slash-command-${matches[selected].name}`);
  };

  const getSlashCommand = (content) => {
    const match = content.match(/(?:^|\s)\/([a-z]+)$/i);
    return commands.find(({ name }) => name === match?.[1]?.toLowerCase())?.name || null;
  };

  const runSlashCommand = (name) => commands.find((command) => command.name === name)?.action(app);

  const setupSlashCommands = () => {
    input.addEventListener('input', () => { selected = 0; render(); });
    elements.messageFileInput.addEventListener('change', close);
    input.addEventListener('keydown', (event) => {
      if (menu.classList.contains('hidden')) return;
      if (event.key === 'Escape') { event.preventDefault(); close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + matches.length) % matches.length;
        render();
      } else if (event.key === 'Enter') {
        event.preventDefault();
        choose(matches[selected]);
      }
    });
    document.addEventListener('pointerdown', (event) => {
      if (!elements.messageForm.contains(event.target)) close();
    });
  };

  Object.assign(app, { getSlashCommand, runSlashCommand, setupSlashCommands });
};
