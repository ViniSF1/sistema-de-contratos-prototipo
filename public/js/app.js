/** Bootstrap da aplicação: sessão, navegação, layout e montagem das telas. */
import { adapter } from './data/adapter.js';
import { state, loadAll } from './state.js';
import { icon } from './icons.js';
import { escapeHtml, initials } from './utils.js';
import { toast } from './components/toast.js';
import { renderDashboard } from './views/dashboard.js';
import { renderContracts } from './views/contracts.js';
import { renderFiles } from './views/files.js';
import { renderExport } from './views/export.js';
import { renderChat } from './views/chat.js';

const ROUTES = {
  painel: {
    eyebrow: 'Visão geral',
    title: 'Painel',
    render: renderDashboard,
  },
  contratos: {
    eyebrow: 'Base geral',
    title: 'Contratos',
    render: renderContracts,
  },
  arquivos: {
    eyebrow: 'Documentos',
    title: 'Arquivos',
    render: renderFiles,
  },
  exportar: {
    eyebrow: 'Base geral',
    title: 'Exportar',
    render: renderExport,
  },
  chat: {
    eyebrow: 'Assistente virtual',
    title: 'Agente',
    render: renderChat,
  },
};

const view = document.getElementById('view');
const shell = document.getElementById('app-shell');
const bootScreen = document.getElementById('boot-screen');
const pageTitle = document.getElementById('page-title');
const pageEyebrow = document.getElementById('page-eyebrow');
const navLinks = Array.from(document.querySelectorAll('.nav-link'));
let routeController = null;
let routeCleanup = null;
let redirected = false;

/* ----------------------------- Ícones/UI ----------------------------- */

document.querySelectorAll('[data-icon]').forEach((element) => {
  element.innerHTML = icon(element.dataset.icon);
});

document.getElementById('current-date').textContent = new Intl.DateTimeFormat('pt-BR', {
  weekday: 'long',
  day: '2-digit',
  month: 'long',
}).format(new Date());

function updateUserInterface() {
  const user = state.user;
  if (!user) return;
  document.getElementById('user-name').textContent = user.nome || user.usuario;
  document.getElementById('user-role').textContent =
    user.perfil === 'admin' ? 'Administrador' : user.perfil || 'Usuário';
  document.getElementById('user-avatar').textContent = initials(user.nome || user.usuario);
}

function updateCounters() {
  document.getElementById('nav-contracts-count').textContent = String(state.contracts.length);
  document.getElementById('nav-files-count').textContent = String(state.files.length);
}

/* ------------------------------ Navegação ---------------------------- */

function routeFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, '').trim();
  return ROUTES[raw] ? raw : 'painel';
}

export function navigate(route) {
  const target = ROUTES[route] ? route : 'painel';
  if (window.location.hash === `#/${target}`) {
    renderRoute();
    return;
  }
  window.location.hash = `#/${target}`;
}

async function renderRoute() {
  const key = routeFromHash();
  const route = ROUTES[key];

  navLinks.forEach((link) => {
    const active = link.dataset.route === key;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });

  pageTitle.textContent = route.title;
  pageEyebrow.textContent = route.eyebrow;
  document.title = `${route.title} · Contrata`;
  closeSidebar();
  updateCounters();

  if (routeController) routeController.abort();
  if (routeCleanup) {
    try {
      routeCleanup();
    } catch {
      /* ignore */
    }
    routeCleanup = null;
  }
  routeController = new AbortController();

  view.innerHTML = `
    <div class="view-loading">
      <span class="spinner spinner-dark"></span>
      <span>Carregando ${route.title.toLowerCase()}…</span>
    </div>
  `;

  try {
    const cleanup = await route.render(view, {
      signal: routeController.signal,
      navigate,
      refreshCounters: updateCounters,
    });
    if (typeof cleanup === 'function') routeCleanup = cleanup;
  } catch (error) {
    if (error.name === 'AbortError') return;
    console.error(error);
    view.innerHTML = `
      <div class="empty-state card">
        <span class="empty-icon">${icon('alert')}</span>
        <h2>Não foi possível carregar esta tela</h2>
        <p>${escapeHtml(error.message || 'Erro inesperado.')}</p>
        <button type="button" class="btn btn-primary" id="retry-view">Tentar novamente</button>
      </div>
    `;
    view.querySelector('#retry-view')?.addEventListener('click', renderRoute);
  }
}

/* ------------------------------ Sidebar ------------------------------ */

function openSidebar() {
  document.body.classList.add('sidebar-open');
}

function closeSidebar() {
  document.body.classList.remove('sidebar-open');
}

document.getElementById('btn-menu').addEventListener('click', openSidebar);
document.getElementById('sidebar-scrim').addEventListener('click', closeSidebar);
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeSidebar();
});
navLinks.forEach((link) => link.addEventListener('click', closeSidebar));

/* ------------------------------ Ações globais ------------------------ */

document.getElementById('btn-quick-export').addEventListener('click', () => navigate('exportar'));

document.getElementById('btn-chat-bubble')?.addEventListener('click', () => navigate('chat'));

document.getElementById('btn-logout').addEventListener('click', async () => {
  const button = document.getElementById('btn-logout');
  button.disabled = true;
  try {
    await adapter.logout();
  } finally {
    window.location.replace('login.html');
  }
});

window.addEventListener('auth:expired', () => {
  if (redirected) return;
  redirected = true;
  toast('Sua sessão expirou. Faça login novamente.', 'info');
  window.setTimeout(() => window.location.replace('login.html'), 900);
});

window.addEventListener('hashchange', renderRoute);

/* ------------------------------- Boot -------------------------------- */

function showBootError(message) {
  bootScreen.innerHTML = `
    <span class="boot-error-icon">${icon('alert')}</span>
    <h1>Não foi possível carregar o sistema</h1>
    <p>${escapeHtml(message)}</p>
    <button type="button" class="btn btn-primary" id="boot-retry">Tentar novamente</button>
  `;
  bootScreen.querySelector('#boot-retry').addEventListener('click', () => window.location.reload());
}

async function boot() {
  try {
    state.user = await adapter.getSession();
    await loadAll();
    updateUserInterface();
    updateCounters();

    document.body.classList.remove('boot-pending');
    bootScreen.hidden = true;
    shell.hidden = false;

    if (!window.location.hash) {
      window.history.replaceState(null, '', '#/painel');
    }
    await renderRoute();
  } catch (error) {
    if (error.status === 401) {
      window.location.replace('login.html');
      return;
    }
    console.error(error);
    document.body.classList.remove('boot-pending');
    showBootError(error.message || 'Verifique se o servidor está em execução na porta 3000.');
  }
}

boot();
