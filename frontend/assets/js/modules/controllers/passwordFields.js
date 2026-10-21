export const registerPasswordFieldsController = (app) => {
  const form = app.elements.registerForm;
  const password = form.querySelector('[name="password"]');
  const confirmation = form.querySelector('[name="confirmPassword"]');
  const meter = document.querySelector('#passwordStrength');
  const label = meter.querySelector('.password-strength-label');

  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const input = button.parentElement.querySelector('input');
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      button.setAttribute('aria-pressed', String(visible));
      button.setAttribute('aria-label', `${visible ? 'Nascondi' : 'Mostra'} ${input.name === 'confirmPassword' ? 'conferma password' : 'password'}`);
      button.title = button.getAttribute('aria-label');
      input.focus();
    });
  });

  const updateStrength = () => {
    const value = password.value;
    const classes = [/[a-z]/.test(value), /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length;
    const predictable = /^(password|123456|qwerty|admin|unichat)/i.test(value) || /^(.)\1+$/.test(value);
    const score = !value ? 0 : value.length < 12 || predictable ? 1
      : value.length >= 16 && classes >= 3 ? 3 : value.length >= 12 && classes >= 2 ? 2 : 1;
    meter.dataset.level = String(score);
    meter.setAttribute('aria-valuenow', String(score));
    label.textContent = ['', 'Debole', 'Moderata', 'Sicura'][score] || 'Inserisci una password di almeno 12 caratteri';
  };
  const validateConfirmation = () => {
    confirmation.setCustomValidity(confirmation.value && confirmation.value !== password.value ? 'Le password non coincidono' : '');
  };
  password.addEventListener('input', () => { updateStrength(); validateConfirmation(); });
  confirmation.addEventListener('input', validateConfirmation);
  form.addEventListener('submit', validateConfirmation, true);
};
