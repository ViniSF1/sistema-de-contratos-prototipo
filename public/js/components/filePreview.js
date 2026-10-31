/** Ações e pré-visualização de anexos. Passa sempre pelo adapter. */
import { adapter } from '../data/adapter.js';
import { icon } from '../icons.js';
import { downloadBlob, escapeHtml, formatFileSize, isImageFile, isPdfFile } from '../utils.js';
import { openModal } from './modal.js';
import { toast } from './toast.js';

/** Baixa o arquivo via adapter e dispara o download no navegador. */
export async function downloadStoredFile(file) {
  try {
    const { blob, filename } = await adapter.downloadFile(file.id);
    downloadBlob(blob, filename || file.nome_original);
    toast(`Download de "${file.nome_original}" iniciado.`, 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível baixar o arquivo.', 'error');
  }
}

const PREVIEW_SLOT_ID = 'file-preview-slot';

function loadingHtml() {
  return `
    <div class="preview-loading">
      <span class="spinner spinner-dark"></span>
      <span>Carregando pré-visualização…</span>
    </div>
  `;
}

function unavailableHtml() {
  return `
    <div class="preview-unavailable">
      ${icon('file')}
      <strong>Pré-visualização não disponível</strong>
      <p>Este formato não é exibido diretamente no navegador. Baixe o arquivo para abrir no aplicativo correspondente.</p>
    </div>
  `;
}

function errorHtml(message) {
  return `
    <div class="preview-unavailable">
      ${icon('alert')}
      <strong>Não foi possível exibir o arquivo</strong>
      <p>${escapeHtml(message || 'Tente novamente ou baixe o arquivo.')}</p>
    </div>
  `;
}

/**
 * Abre o modal de pré-visualização.
 * A URL vem do adapter de forma assíncrona (Promise) — funciona tanto no JSON
 * quanto no Supabase (signed URL), com estado de carregamento e erro.
 */
export async function openFilePreview(file) {
  const previewable = isPdfFile(file) || isImageFile(file);

  const modal = openModal({
    title: file.nome_original,
    eyebrow: file.categoria || 'Arquivo',
    subtitle: `${formatFileSize(file.tamanho)} · enviado em ${new Date(file.enviado_em).toLocaleDateString('pt-BR')}`,
    size: 'lg',
    content: `<div id="${PREVIEW_SLOT_ID}">${previewable ? loadingHtml() : unavailableHtml()}</div>`,
    footer: `
      <button type="button" class="btn btn-ghost" data-close-preview>Fechar</button>
      <button type="button" class="btn btn-primary" data-download-preview>${icon('download')} Baixar arquivo</button>
    `,
  });

  modal.element.querySelector('[data-close-preview]').addEventListener('click', modal.close);
  modal.element.querySelector('[data-download-preview]').addEventListener('click', () => {
    downloadStoredFile(file);
  });

  if (!previewable) return;

  try {
    const url = await adapter.viewFileUrl(file.id);
    const slot = modal.element.querySelector(`#${PREVIEW_SLOT_ID}`);
    if (!slot) return; // modal foi fechado antes da URL resolver

    slot.innerHTML = isPdfFile(file)
      ? `<iframe class="file-preview-frame" src="${escapeHtml(url)}" title="Pré-visualização de ${escapeHtml(file.nome_original)}"></iframe>`
      : `<div class="image-preview"><img src="${escapeHtml(url)}" alt="${escapeHtml(file.nome_original)}"></div>`;
  } catch (error) {
    const slot = modal.element.querySelector(`#${PREVIEW_SLOT_ID}`);
    if (slot) slot.innerHTML = errorHtml(error.message);
    toast(error.message || 'Não foi possível carregar a pré-visualização.', 'error');
  }
}
