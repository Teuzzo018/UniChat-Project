/**
 * ============================================================================
 * CONTROLLER SELETTORE EMOJI (emojiPicker.js)
 * 1. Inizializzazione picker: creazione popup emoji categorized per la barra messaggi
 * 2. Inserimento emoji: aggiunta dell'emoji selezionata nel campo di testo del composer
 * ============================================================================
 */
const EMOJI = ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','🙂','😉','😍','🥰','😘','😎','🤔','😮','😢','😭','😡','👍','👎','👏','🙌','🙏','💪','👋','👌','❤️','🧡','💛','💚','💙','💜','✨','🎉','🔥','⭐','💯','👀','🤝','💬','🎮','📚','☕','🍕','🐱','🌈'];

export const registerEmojiPickerController = (app) => {
  const input = app.elements.messageInput;
  const button = document.querySelector('#emojiButton');
  const picker = document.querySelector('#emojiPicker');
  const close = () => { picker.classList.add('hidden'); button.setAttribute('aria-expanded', 'false'); };
  for (const emoji of EMOJI) {
    const option = document.createElement('button');
    option.type = 'button';
    option.textContent = emoji;
    option.setAttribute('aria-label', `Inserisci ${emoji}`);
    option.addEventListener('click', () => {
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      if (input.value.length + emoji.length - (end - start) > input.maxLength) return;
      input.setRangeText(emoji, start, end, 'end');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.focus();
      close();
    });
    picker.append(option);
  }
  button.addEventListener('click', () => {
    const open = picker.classList.toggle('hidden') === false;
    button.setAttribute('aria-expanded', String(open));
    if (open) picker.querySelector('button')?.focus();
  });
  document.addEventListener('pointerdown', (event) => {
    if (!picker.contains(event.target) && !button.contains(event.target)) close();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !picker.classList.contains('hidden')) { close(); button.focus(); }
  });
};
