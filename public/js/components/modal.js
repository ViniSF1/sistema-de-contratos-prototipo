/** Modal, drawer e diálogo de confirmação reutilizáveis. */
import { icon } from '../icons.js';
import { escapeHtml } from '../utils.js';

let openLayers = 0;

function lockScroll() {
  openLayers += 1;
  document.body.classList.add('modal-open');
}

function unlockScroll() {
  openLayers = Math.max(0, openLayers - 1);
  if (openLayers === 0) document.body.classList.remove('modal-open');
}

function rootElement() {
  let root = document.getElementById('modal-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'modal-root';
    document.body.appendChild(root);
  }
  return root;
}

function animateIn(element, className) {
  window.requestAnimationFrame(() => element.classList.add(className));
}

/**
 * Abre um modal centralizado.
 * @returns {{ element: HTMLElement, body: HTMLElement, close: () => void }}
 */
export function openModal({
  title,
  eyebrow = '',
  subtitle = '',
  content = '',
  footer = '',
  size = 'md',
  onClose = null,
}) {
  const id = `modal-title-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.innerHTML = `
    <section class="modal-panel modal-${size}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <header class="modal-header">
        <div>
          ${eyebrow ? `<span class="eyebrow">${escapeHtml(eyebrow)}</span>` : ''}
          <h2 id="${id}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn modal-close" aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="modal-body">${content}</div>
      ${footer ? `<footer class="modal-footer">${footer}</footer>` : ''}
    </section>
  `;

  const body = backdrop.querySelector('.modal-body');
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.classList.remove('open');
    unlockScroll();
    window.setTimeout(() => backdrop.remove(), 180);
    if (onClose) onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector('.modal-close').addEventListener('click', close);

  rootElement().appendChild(backdrop);
  lockScroll();
  animateIn(backdrop, 'open');
  document.addEventListener('keydown', onKeyDown);

  window.setTimeout(() => {
    const focusable = backdrop.querySelector(
      'input:not([type="hidden"]), select, textarea, button:not(.modal-close), [href]',
    );
    if (focusable) focusable.focus();
  }, 40);

  return { element: backdrop, body, close };
}

/**
 * Abre um painel lateral (usado na ficha do contrato).
 */
export function openDrawer({
  title,
  eyebrow = 'Contrato',
  subtitle = '',
  content = '',
  footer = '',
  width = 'wide',
  onClose = null,
}) {
  const id = `drawer-title-${Date.now()}`;
  const backdrop = document.createElement('div');
  backdrop.className = 'drawer-backdrop';
  backdrop.innerHTML = `
    <aside class="drawer drawer-${width}" role="dialog" aria-modal="true" aria-labelledby="${id}">
      <header class="drawer-header">
        <div class="drawer-heading">
          <span class="eyebrow">${escapeHtml(eyebrow)}</span>
          <h2 id="${id}">${escapeHtml(title)}</h2>
          ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <button type="button" class="icon-btn drawer-close" aria-label="Fechar">${icon('x')}</button>
      </header>
      <div class="drawer-body">${content}</div>
      ${footer ? `<footer class="drawer-footer">${footer}</footer>` : ''}
    </aside>
  `;

  let closed = false;
  const body = backdrop.querySelector('.drawer-body');
  const titleElement = backdrop.querySelector('.drawer-heading');

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.classList.remove('open');
    unlockScroll();
    window.setTimeout(() => backdrop.remove(), 220);
    if (onClose) onClose();
  };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  };

  backdrop.addEventListener('mousedown', (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector('.drawer-close').addEventListener('click', close);

  rootElement().appendChild(backdrop);
  lockScroll();
  animateIn(backdrop, 'open');
  document.addEventListener('keydown', onKeyDown);

  return { element: backdrop, body, heading: titleElement, close };
}

/** Confirmação com visual do sistema. Retorna Promise<boolean>. */
export function confirmDialog({
  title = 'Confirmar ação',
  message = '',
  detail = '',
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
}) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const modal = openModal({
      title,
      size: 'sm',
      content: `
        <div class="confirm-box ${danger ? 'danger' : ''}">
          <span class="confirm-icon">${icon(danger ? 'alert' : 'info')}</span>
          <div>
            <p class="confirm-message">${escapeHtml(message)}</p>
            ${detail ? `<p class="confirm-detail">${escapeHtml(detail)}</p>` : ''}
          </div>
        </div>
      `,
      footer: `
        <button type="button" class="btn btn-ghost" data-cancel>${escapeHtml(cancelLabel)}</button>
        <button type="button" class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-confirm>${escapeHtml(confirmLabel)}</button>
      `,
      onClose: () => finish(false),
    });

    modal.element.querySelector('[data-cancel]').addEventListener('click', () => {
      finish(false);
      modal.close();
    });
    modal.element.querySelector('[data-confirm]').addEventListener('click', () => {
      finish(true);
      modal.close();
    });
  });
}
