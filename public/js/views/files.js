/** Tela "Arquivos": todos os documentos, busca, filtros e envio vinculado a um contrato. */
import { adapter } from '../data/adapter.js';
import { refreshFiles, refreshContracts, state } from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';
import { confirmDialog, openModal } from '../components/modal.js';
import { openContractDrawer } from '../components/contractDrawer.js';
import { downloadStoredFile, openFilePreview } from '../components/filePreview.js';
import {
  ALLOWED_FILE_EXTENSIONS,
  DANGEROUS_FILE_EXTENSIONS,
  FILE_CATEGORIES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from '../constants.js';
import {
  escapeHtml,
  fileExtension,
  formatDateTimeBR,
  formatFileSize,
  isImageFile,
  isPdfFile,
  normalizeText,
  sameId,
  sumBy,
} from '../utils.js';

const CATEGORY_TONE = {
  'Contrato original': 'blue',
  Aditivo: 'purple',
  Anexo: 'gray',
  'Nota fiscal': 'green',
  Outros: 'amber',
};

let filters = { search: '', contractId: '', category: '' };
let refs = {};

export async function renderFiles(container, ctx) {
  try {
    await Promise.all([refreshFiles(), refreshContracts()]);
  } catch (error) {
    if (error.status === 401) throw error;
    toast('Não foi possível atualizar os arquivos agora.', 'error');
  }

  refs = { container, ctx };

  container.innerHTML = `
    <section class="view-intro">
      <div>
        <h2>Biblioteca de documentos</h2>
        <p>Consulte, visualize e baixe todos os anexos vinculados aos contratos.</p>
      </div>
      <button type="button" class="btn btn-primary" id="btn-open-upload">
        ${icon('upload')} Enviar arquivo
      </button>
    </section>

    <section class="card files-card">
      <div class="files-toolbar">
        <label class="search-box" aria-label="Buscar arquivos">
          ${icon('search')}
          <input type="search" id="files-search" placeholder="Buscar por arquivo, contrato ou fornecedor…" autocomplete="off">
        </label>
        <select id="files-contract-filter" class="select-filter" aria-label="Filtrar por contrato">
          <option value="">Todos os contratos</option>
          ${[...state.contracts]
            .sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR'))
            .map(
              (contract) =>
                `<option value="${contract.id}">${escapeHtml(contract.numero)} · ${escapeHtml(contract.contratada)}</option>`,
            )
            .join('')}
        </select>
        <select id="files-category-filter" class="select-filter" aria-label="Filtrar por categoria">
          <option value="">Todas as categorias</option>
          ${FILE_CATEGORIES.map(
            (category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`,
          ).join('')}
        </select>
        <button type="button" class="btn-link" id="files-clear" hidden>Limpar filtros</button>
      </div>

      <div class="files-summary" id="files-summary"></div>
      <div class="files-table-wrap" id="files-table-wrap"></div>
      <footer class="files-footer" id="files-footer"></footer>
    </section>
  `;

  refs.search = container.querySelector('#files-search');
  refs.contractFilter = container.querySelector('#files-contract-filter');
  refs.categoryFilter = container.querySelector('#files-category-filter');
  refs.clear = container.querySelector('#files-clear');
  refs.tableWrap = container.querySelector('#files-table-wrap');
  refs.summary = container.querySelector('#files-summary');
  refs.footer = container.querySelector('#files-footer');

  refs.search.value = filters.search;
  refs.contractFilter.value = filters.contractId;
  refs.categoryFilter.value = filters.category;

  refs.search.addEventListener('input', () => {
    filters.search = refs.search.value;
    renderList();
  });
  refs.contractFilter.addEventListener('change', () => {
    filters.contractId = refs.contractFilter.value;
    renderList();
  });
  refs.categoryFilter.addEventListener('change', () => {
    filters.category = refs.categoryFilter.value;
    renderList();
  });
  refs.clear.addEventListener('click', () => {
    filters = { search: '', contractId: '', category: '' };
    refs.search.value = '';
    refs.contractFilter.value = '';
    refs.categoryFilter.value = '';
    renderList();
  });

  container.querySelector('#btn-open-upload').addEventListener('click', openUploadModal);

  refs.tableWrap.addEventListener('click', async (event) => {
    const action = event.target.closest('[data-file-action]');
    if (action) {
      const file = state.files.find((item) => sameId(item.id, action.dataset.fileId));
      if (!file) return;
      if (action.dataset.fileAction === 'preview') {
        openFilePreview(file);
      } else if (action.dataset.fileAction === 'download') {
        await downloadStoredFile(file);
      } else if (action.dataset.fileAction === 'delete') {
        await deleteFile(file, ctx);
      }
      return;
    }

    const contractButton = event.target.closest('[data-contract-id]');
    if (contractButton) {
      openContractDrawer(contractButton.dataset.contractId, {
        onChange: async () => {
          ctx.refreshCounters?.();
          await refreshFiles();
          renderList();
        },
      });
    }
  });

  renderList();

  return () => {
    refs = {};
  };
}

function getFilteredFiles() {
  const term = normalizeText(filters.search);

  return [...state.files]
    .filter((file) => {
      if (filters.contractId && String(file.contrato_id) !== String(filters.contractId)) {
        return false;
      }
      if (filters.category && file.categoria !== filters.category) return false;
      if (!term) return true;
      const contract = state.contracts.find((item) => sameId(item.id, file.contrato_id));
      const haystack = normalizeText(
        [
          file.nome_original,
          file.categoria,
          file.tipo,
          contract?.numero,
          contract?.contratada,
        ].join(' '),
      );
      return haystack.includes(term);
    })
    .sort((a, b) => String(b.enviado_em).localeCompare(String(a.enviado_em)));
}

function renderList() {
  if (!refs.tableWrap) return;
  const files = getFilteredFiles();
  const hasFilters = Boolean(filters.search.trim() || filters.contractId || filters.category);

  refs.clear.hidden = !hasFilters;
  refs.summary.innerHTML = `
    <span><strong>${files.length}</strong> ${files.length === 1 ? 'arquivo exibido' : 'arquivos exibidos'}${
      files.length !== state.files.length ? ` de ${state.files.length}` : ''
    }</span>
    <span class="summary-separator"></span>
    <span>${formatFileSize(sumBy(files, (file) => file.tamanho))} em documentos</span>
  `;

  if (!files.length) {
    refs.tableWrap.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${icon('folder')}</span>
        <h3>${state.files.length ? 'Nenhum arquivo encontrado' : 'Nenhum arquivo enviado'}</h3>
        <p>${
          state.files.length
            ? 'Ajuste a busca ou os filtros para localizar outros documentos.'
            : 'Envie o primeiro documento vinculado a um contrato.'
        }</p>
        <button type="button" class="btn btn-primary btn-sm" id="files-empty-upload">${icon('upload')} Enviar arquivo</button>
      </div>
    `;
    refs.tableWrap.querySelector('#files-empty-upload')?.addEventListener('click', openUploadModal);
    refs.footer.innerHTML = '';
    return;
  }

  refs.tableWrap.innerHTML = `
    <table class="doc-table">
      <thead>
        <tr>
          <th>Arquivo</th>
          <th>Contrato</th>
          <th>Categoria</th>
          <th>Tamanho</th>
          <th>Enviado em</th>
          <th class="align-right">Ações</th>
        </tr>
      </thead>
      <tbody>
        ${files.map(renderFileRow).join('')}
      </tbody>
    </table>
  `;

  refs.footer.innerHTML = `
    <span><strong>${files.length}</strong> ${files.length === 1 ? 'documento' : 'documentos'}</span>
    <span class="footer-divider"></span>
    <span>${formatFileSize(sumBy(files, (file) => file.tamanho))} no total</span>
  `;
}

function renderFileRow(file) {
  const contract = state.contracts.find((item) => sameId(item.id, file.contrato_id));
  const extension = fileExtension(file.nome_original);
  const badgeClass = isPdfFile(file)
    ? 'pdf'
    : isImageFile(file)
      ? 'img'
      : ['.doc', '.docx'].includes(extension)
        ? 'doc'
        : ['.xls', '.xlsx', '.csv'].includes(extension)
          ? 'xls'
          : 'other';
  const tone = CATEGORY_TONE[file.categoria] || 'gray';

  return `
    <tr>
      <td>
        <div class="doc-file">
          <span class="file-badge file-badge-${badgeClass}">${escapeHtml(extension.replace(/^\./, '') || 'arq')}</span>
          <div>
            <strong title="${escapeHtml(file.nome_original)}">${escapeHtml(file.nome_original)}</strong>
            <small>${escapeHtml(file.tipo || 'Documento')}</small>
          </div>
        </div>
      </td>
      <td>
        ${
          contract
            ? `<button type="button" class="contract-link" data-contract-id="${contract.id}">
                <strong>${escapeHtml(contract.numero)}</strong>
                <small>${escapeHtml(contract.contratada)}</small>
              </button>`
            : '<span class="muted">Contrato removido</span>'
        }
      </td>
      <td><span class="category-chip tone-${tone}">${escapeHtml(file.categoria)}</span></td>
      <td class="muted">${formatFileSize(file.tamanho)}</td>
      <td class="muted">${formatDateTimeBR(file.enviado_em)}</td>
      <td>
        <div class="table-actions align-right">
          <button type="button" class="icon-btn" title="Visualizar" aria-label="Visualizar ${escapeHtml(file.nome_original)}" data-file-action="preview" data-file-id="${file.id}">${icon('eye')}</button>
          <button type="button" class="icon-btn" title="Baixar" aria-label="Baixar ${escapeHtml(file.nome_original)}" data-file-action="download" data-file-id="${file.id}">${icon('download')}</button>
          <button type="button" class="icon-btn icon-btn-danger" title="Excluir" aria-label="Excluir ${escapeHtml(file.nome_original)}" data-file-action="delete" data-file-id="${file.id}">${icon('trash')}</button>
        </div>
      </td>
    </tr>
  `;
}

async function deleteFile(file, ctx) {
  const confirmed = await confirmDialog({
    title: 'Excluir arquivo',
    message: `Excluir "${file.nome_original}"?`,
    detail: 'O arquivo será removido do storage e esta ação não pode ser desfeita.',
    confirmLabel: 'Excluir arquivo',
  });
  if (!confirmed) return;

  try {
    await adapter.deleteFile(file.id);
    await refreshFiles();
    renderList();
    ctx.refreshCounters?.();
    toast('Arquivo excluído com sucesso.', 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível excluir o arquivo.', 'error');
  }
}

/* ---------------------------- Upload modal ---------------------------- */

function openUploadModal() {
  if (!state.contracts.length) {
    toast('Cadastre um contrato antes de enviar arquivos.', 'info');
    return;
  }

  const modal = openModal({
    title: 'Enviar arquivo',
    eyebrow: 'Novo documento',
    subtitle: `Vincule um ou mais arquivos a um contrato · até ${MAX_FILE_MB} MB por arquivo.`,
    size: 'md',
    content: `
      <div class="upload-form">
        <label class="field">
          <span>Contrato</span>
          <select id="upload-contract" required>
            ${[...state.contracts]
              .sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR'))
              .map(
                (contract) =>
                  `<option value="${contract.id}">${escapeHtml(contract.numero)} · ${escapeHtml(contract.contratada)}</option>`,
              )
              .join('')}
          </select>
        </label>

        <label class="field">
          <span>Categoria</span>
          <select id="upload-category">
            ${FILE_CATEGORIES.map(
              (category) =>
                `<option value="${escapeHtml(category)}"${category === 'Anexo' ? ' selected' : ''}>${escapeHtml(category)}</option>`,
            ).join('')}
          </select>
        </label>

        <div class="dropzone" id="modal-dropzone" role="button" tabindex="0" aria-label="Selecionar arquivos">
          <span class="dropzone-icon">${icon('upload')}</span>
          <strong>Arraste arquivos aqui</strong>
          <span>ou clique para selecionar · PDF, DOCX, XLSX, imagens</span>
        </div>
        <input type="file" id="modal-file-input" class="visually-hidden" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp">

        <ul class="selection-list" id="upload-selection"></ul>
        <div class="upload-progress" id="modal-upload-progress" hidden>
          <div class="upload-progress-head">
            <span id="modal-upload-name">Enviando…</span>
            <strong id="modal-upload-percent">0%</strong>
          </div>
          <div class="progress-track"><span id="modal-upload-bar"></span></div>
        </div>
        <div class="form-error" id="modal-upload-error" role="alert" hidden></div>
      </div>
    `,
    footer: `
      <button type="button" class="btn btn-ghost" id="modal-cancel-upload">Cancelar</button>
      <button type="button" class="btn btn-primary" id="modal-confirm-upload" disabled>${icon('upload')} Enviar arquivos</button>
    `,
  });

  const contractSelect = modal.element.querySelector('#upload-contract');
  const categorySelect = modal.element.querySelector('#upload-category');
  const dropzone = modal.element.querySelector('#modal-dropzone');
  const fileInput = modal.element.querySelector('#modal-file-input');
  const selection = modal.element.querySelector('#upload-selection');
  const progressBox = modal.element.querySelector('#modal-upload-progress');
  const progressName = modal.element.querySelector('#modal-upload-name');
  const progressPercent = modal.element.querySelector('#modal-upload-percent');
  const progressBar = modal.element.querySelector('#modal-upload-bar');
  const errorBox = modal.element.querySelector('#modal-upload-error');
  const confirmButton = modal.element.querySelector('#modal-confirm-upload');
  const cancelButton = modal.element.querySelector('#modal-cancel-upload');

  let selectedFiles = [];
  let uploading = false;

  const renderSelection = () => {
    selection.innerHTML = selectedFiles
      .map(
        (file, index) => `
          <li>
            <span class="file-badge file-badge-other">${escapeHtml(fileExtension(file.name).replace(/^\./, '') || 'arq')}</span>
            <span class="selection-name">${escapeHtml(file.name)}</span>
            <span class="muted">${formatFileSize(file.size)}</span>
            <button type="button" class="icon-btn" data-remove-file="${index}" aria-label="Remover ${escapeHtml(file.name)}">${icon('x')}</button>
          </li>
        `,
      )
      .join('');
    confirmButton.disabled = uploading || selectedFiles.length === 0;
  };

  const addFiles = (fileList) => {
    errorBox.hidden = true;
    const errors = [];
    Array.from(fileList || []).forEach((file) => {
      const extension = fileExtension(file.name);
      if (
        DANGEROUS_FILE_EXTENSIONS.includes(extension) ||
        !ALLOWED_FILE_EXTENSIONS.includes(extension)
      ) {
        errors.push(`${file.name}: extensão ${extension || '?'} não permitida.`);
      } else if (file.size > MAX_FILE_BYTES) {
        errors.push(`${file.name}: excede ${MAX_FILE_MB} MB.`);
      } else if (file.size === 0) {
        errors.push(`${file.name}: arquivo vazio.`);
      } else {
        selectedFiles.push(file);
      }
    });
    if (errors.length) {
      errorBox.textContent = errors.join(' ');
      errorBox.hidden = false;
    }
    renderSelection();
  };

  dropzone.addEventListener('click', () => fileInput.click());
  dropzone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
    addFiles(event.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });

  selection.addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-file]');
    if (!remove || uploading) return;
    selectedFiles.splice(Number(remove.dataset.removeFile), 1);
    renderSelection();
  });

  cancelButton.addEventListener('click', () => {
    if (!uploading) modal.close();
  });

  confirmButton.addEventListener('click', async () => {
    if (uploading || !selectedFiles.length) return;
    uploading = true;
    confirmButton.disabled = true;
    cancelButton.disabled = true;
    progressBox.hidden = false;
    errorBox.hidden = true;

    // IDs são opacos (número no JSON, UUID no Supabase): mantenha como string.
    const contratoId = contractSelect.value;
    const categoria = categorySelect.value;
    const contract = state.contracts.find((item) => sameId(item.id, contratoId));
    const contratoNumero = contract?.numero || '';
    let success = 0;
    const errors = [];

    for (const file of selectedFiles) {
      progressName.textContent = file.name;
      progressPercent.textContent = '0%';
      progressBar.style.width = '0%';
      try {
        await adapter.uploadFile({
          contratoId,
          contratoNumero,
          categoria,
          file,
          onProgress: (value) => {
            progressPercent.textContent = `${value}%`;
            progressBar.style.width = `${value}%`;
          },
        });
        success += 1;
      } catch (error) {
        errors.push(`${file.name}: ${error.message || 'falha no envio'}`);
      }
    }

    uploading = false;
    progressBox.hidden = true;
    cancelButton.disabled = false;

    if (success) {
      await refreshFiles();
      renderList();
      refs.ctx.refreshCounters?.();
      toast(`${success} ${success === 1 ? 'arquivo enviado' : 'arquivos enviados'} com sucesso.`, 'success');
      modal.close();
    } else {
      confirmButton.disabled = false;
      errorBox.textContent = errors.join(' ');
      errorBox.hidden = false;
    }

    if (errors.length && success) {
      errors.forEach((message) => toast(message, 'error'));
    }
  });

  renderSelection();
}
