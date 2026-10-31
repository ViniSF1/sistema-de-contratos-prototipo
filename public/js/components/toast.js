/** Notificações visuais (sucesso, erro e informação). */
import { icon } from '../icons.js';
import { escapeHtml } from '../utils.js';

const ICONS = { success: 'checkCircle', error: 'alert', info: 'info' };

export function toast(message, type = 'success', options = {}) {
  let stack = document.getElementById('toast-stack');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-stack';
    stack.className = 'toast-stack';
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }

  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.innerHTML = `
    <span class="toast-icon">${icon(ICONS[type] || 'info')}</span>
    <div class="toast-content">
      ${options.title ? `<strong>${escapeHtml(options.title)}</strong>` : ''}
      <span>${escapeHtml(message)}</span>
    </div>
    <button type="button" class="toast-close" aria-label="Fechar aviso">${icon('x')}</button>
  `;

  const remove = () => {
    element.classList.add('toast-leaving');
    window.setTimeout(() => element.remove(), 180);
  };
  element.querySelector('.toast-close').addEventListener('click', remove);
  stack.appendChild(element);

  window.setTimeout(remove, type === 'error' ? 7000 : 4200);
  return remove;
}
