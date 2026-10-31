/** Tela de login: autenticação via Supabase (e-mail + senha). */
import { adapter } from './data/adapter.js';
import { icon } from './icons.js';

const form = document.getElementById('login-form');
const usuarioInput = document.getElementById('usuario');
const senhaInput = document.getElementById('senha');
const errorBox = document.getElementById('login-error');
const submitButton = document.getElementById('btn-login');
const toggleButton = document.getElementById('toggle-password');
const spinner = submitButton.querySelector('.spinner');
const label = submitButton.querySelector('.btn-label');

document.querySelectorAll('[data-icon]').forEach((element) => {
  element.innerHTML = icon(element.dataset.icon);
});

usuarioInput.focus();

// Se já existe uma sessão válida, não faz sentido mostrar o login.
if (adapter.isAuthenticated()) {
  adapter
    .getSession()
    .then(() => window.location.replace('index.html'))
    .catch(() => {
      /* token inválido: permanece na tela de login */
    });
}

toggleButton.addEventListener('click', () => {
  const isPassword = senhaInput.type === 'password';
  senhaInput.type = isPassword ? 'text' : 'password';
  toggleButton.setAttribute('aria-label', isPassword ? 'Ocultar senha' : 'Mostrar senha');
  senhaInput.focus();
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  errorBox.hidden = true;

  const usuario = usuarioInput.value.trim();
  const senha = senhaInput.value;

  if (!usuario || !senha) {
    showError('Informe usuário e senha para continuar.');
    return;
  }

  setLoading(true);

  try {
    // O campo de usuário funciona como e-mail no Supabase.
    if (!usuario.includes('@')) {
      showError('Informe seu e-mail no campo de usuário.');
      setLoading(false);
      return;
    }
    await adapter.loginWithEmail(usuario, senha);

    // Garante que o token foi persistido antes de navegar
    if (adapter.token) {
      window.localStorage.setItem('contrata.token', adapter.token);
    }

    window.location.replace('index.html');
  } catch (error) {
    showError(error.message || 'Não foi possível entrar. Tente novamente.');
    senhaInput.select();
    setLoading(false);
  }
});

function showError(message) {
  errorBox.textContent = message;
  errorBox.hidden = false;
}

function setLoading(isLoading) {
  submitButton.disabled = isLoading;
  usuarioInput.disabled = isLoading;
  senhaInput.disabled = isLoading;
  spinner.hidden = !isLoading;
  label.textContent = isLoading ? 'Entrando…' : 'Entrar no sistema';
}
