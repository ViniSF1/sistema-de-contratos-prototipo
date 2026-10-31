/**
 * Ficha lateral do contrato, com dados completos e gestão de anexos.
 * Toda operação de dados é feita pelo adapter.
 */
import { adapter } from '../data/adapter.js';
import {
  contractById,
  filesForContract,
  refreshFiles,
  removeContractFromState,
} from '../state.js';
import { icon } from '../icons.js';
import {
  contractSituation,
  daysLabel,
  daysUntil,
  escapeHtml,
  fileExtension,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatFileSize,
  isImageFile,
  isPdfFile,
  sameId,
} from '../utils.js';
import { confirmDialog, openDrawer } from './modal.js';
import { toast } from './toast.js';
import { downloadStoredFile, openFilePreview } from './filePreview.js';
import {
  ALLOWED_FILE_EXTENSIONS,
  DANGEROUS_FILE_EXTENSIONS,
  FILE_CATEGORIES,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from '../constants.js';

export async function openContractDrawer(contractId, { onChange } = {}) {
  let contract = contractById(contractId);
  if (!contract) {
    try {
      contract = await adapter.getContract(contractId);
    } catch (error) {
      toast(error.message || 'Contrato não encontrado.', 'error');
      return;
    }
  }

  let files = filesForContract(contract.id);
  let uploading = false;

  const drawer = openDrawer({
    title: contract.numero,
    eyebrow: 'Ficha do contrato',
    subtitle: contract.contratada,
    content: buildContent(contract, files),
    footer: `
      <div class="drawer-footer-left">
        <button type="button" class="btn btn-danger-ghost" id="btn-delete-contract">
          ${icon('trash')} Excluir contrato
        </button>
      </div>
      <button type="button" class="btn btn-secondary" id="btn-close-drawer">Fechar</button>
    `,
  });

  const body = drawer.body;
  const list = body.querySelector('#drawer-file-list');
  const count = body.querySelector('#drawer-files-count');
  const fileInput = body.querySelector('#drawer-file-input');
  const dropzone = body.querySelector('#drawer-dropzone');
  const categorySelect = body.querySelector('#drawer-file-category');
  const progressBox = body.querySelector('#upload-progress');
  const progressName = body.querySelector('#upload-name');
  const progressPercent = body.querySelector('#upload-percent');
  const progressBar = body.querySelector('#upload-bar');

  function refreshFileList() {
    files = filesForContract(contract.id);
    list.innerHTML = renderFileItems(files);
    count.textContent = String(files.length);
  }

  function setUploading(active) {
    uploading = active;
    dropzone.classList.toggle('disabled', active);
    fileInput.disabled = active;
    categorySelect.disabled = active;
  }

  async function handleFiles(fileList) {
    if (uploading) return;
    const selected = Array.from(fileList || []);
    if (!selected.length) return;

    const category = categorySelect.value;
    let success = 0;
    const errors = [];

    setUploading(true);
    progressBox.hidden = false;

    for (const file of selected) {
      const validation = validateFile(file);
      if (validation) {
        errors.push(`${file.name}: ${validation}`);
        continue;
      }

      progressName.textContent = file.name;
      progressPercent.textContent = '0%';
      progressBar.style.width = '0%';

      try {
        await adapter.uploadFile({
          contratoId: contract.id,
          contratoNumero: contract.numero,
          categoria: category,
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

    progressBox.hidden = true;
    setUploading(false);
    fileInput.value = '';

    if (success) {
      await refreshFiles();
      refreshFileList();
      toast(
        `${success} ${success === 1 ? 'arquivo enviado' : 'arquivos enviados'} com sucesso.`,
        'success',
      );
      onChange?.({ type: 'files' });
    }
    errors.forEach((message) => toast(message, 'error'));
  }

  body.querySelector('#btn-pick-file').addEventListener('click', () => {
    if (!uploading) fileInput.click();
  });
  dropzone.addEventListener('click', () => {
    if (!uploading) fileInput.click();
  });
  dropzone.addEventListener('keydown', (event) => {
    if ((event.key === 'Enter' || event.key === ' ') && !uploading) {
      event.preventDefault();
      fileInput.click();
    }
  });
  dropzone.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (!uploading) dropzone.classList.add('dragging');
  });
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
  dropzone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('dragging');
    handleFiles(event.dataTransfer.files);
  });
  fileInput.addEventListener('change', () => handleFiles(fileInput.files));

  list.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-file-action]');
    if (!button) return;
    const file = files.find((item) => sameId(item.id, button.dataset.fileId));
    if (!file) return;

    if (button.dataset.fileAction === 'preview') {
      openFilePreview(file);
    } else if (button.dataset.fileAction === 'download') {
      await downloadStoredFile(file);
    } else if (button.dataset.fileAction === 'delete') {
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
        refreshFileList();
        toast('Arquivo excluído com sucesso.', 'success');
        onChange?.({ type: 'files' });
      } catch (error) {
        toast(error.message || 'Não foi possível excluir o arquivo.', 'error');
      }
    }
  });

  drawer.element.querySelector('#btn-close-drawer').addEventListener('click', drawer.close);

  drawer.element.querySelector('#btn-delete-contract').addEventListener('click', async () => {
    const related = filesForContract(contract.id);
    const confirmed = await confirmDialog({
      title: 'Excluir contrato',
      message: `Excluir definitivamente o contrato ${contract.numero}?`,
      detail:
        related.length > 0
          ? `Os ${related.length} arquivo(s) vinculado(s) também serão removidos. Esta ação não pode ser desfeita.`
          : 'Esta ação não pode ser desfeita.',
      confirmLabel: 'Excluir contrato',
    });
    if (!confirmed) return;

    try {
      await adapter.deleteContract(contract.id);
      removeContractFromState(contract.id);
      drawer.close();
      toast(`Contrato ${contract.numero} excluído.`, 'success');
      onChange?.({ type: 'deleted' });
    } catch (error) {
      toast(error.message || 'Não foi possível excluir o contrato.', 'error');
    }
  });
}

function buildContent(contract, files) {
  const situation = contractSituation(contract);
  const days = daysUntil(contract.data_fim);
  const isEnded = contract.status === 'Rescindido';

  return `
    <section class="drawer-summary situation-${situation.key}">
      <div class="drawer-status-row">
        <span class="status-pill situation-${situation.key}">
          <span class="status-pill-dot"></span>${escapeHtml(situation.label)}
        </span>
        <span class="meta-chip">${escapeHtml(contract.tipo)}</span>
        ${
          isEnded
            ? '<span class="meta-chip muted">Contrato encerrado</span>'
            : `<span class="days-chip tone-${days <= 15 ? 'red' : days <= 60 ? 'amber' : 'green'}">${escapeHtml(daysLabel(days))}</span>`
        }
      </div>
      <h3>${escapeHtml(contract.objeto)}</h3>
      <div class="drawer-metrics">
        <div>
          <span>Valor total</span>
          <strong>${formatCurrency(contract.valor_total)}</strong>
        </div>
        <div>
          <span>Valor mensal</span>
          <strong>${formatCurrency(contract.valor_mensal)}</strong>
        </div>
        <div>
          <span>Vigência</span>
          <strong>${formatDateBR(contract.data_inicio)} – ${formatDateBR(contract.data_fim)}</strong>
        </div>
      </div>
    </section>

    <section class="drawer-section">
      <header class="section-heading">
        <h3>Dados do contrato</h3>
        <span class="subtle-text">Atualizado em ${formatDateTimeBR(contract.atualizado_em)}</span>
      </header>
      <dl class="detail-grid">
        ${detailItem('Contratada', contract.contratada)}
        ${detailItem('CNPJ', contract.cnpj || '—')}
        ${detailItem('Tipo', contract.tipo)}
        ${detailItem('Setor responsável', contract.setor_responsavel || '—')}
        ${detailItem('Gestor', contract.gestor || '—')}
        ${detailItem('Status cadastrado', contract.status)}
        ${detailItem('Data de assinatura', formatDateBR(contract.data_assinatura) || '—')}
        ${detailItem('Início', formatDateBR(contract.data_inicio))}
        ${detailItem('Fim', formatDateBR(contract.data_fim))}
        ${detailItem('Forma de reajuste', contract.forma_reajuste || '—')}
        ${detailItem('Índice de reajuste', contract.indice_reajuste || '—')}
        ${detailItem('Criado em', formatDateTimeBR(contract.criado_em))}
        <div class="detail-item full">
          <dt>Observações</dt>
          <dd>${contract.observacoes ? escapeHtml(contract.observacoes) : '<span class="muted">Nenhuma observação registrada.</span>'}</dd>
        </div>
      </dl>
    </section>

    <section class="drawer-section files-section">
      <header class="section-heading">
        <div>
          <h3>Arquivos do contrato <span class="section-count" id="drawer-files-count">${files.length}</span></h3>
          <p class="subtle-text">PDF, DOCX, XLSX e imagens · limite de ${MAX_FILE_MB} MB por arquivo.</p>
        </div>
      </header>

      <div class="upload-controls">
        <label class="field-inline">
          <span>Categoria</span>
          <select id="drawer-file-category" class="select-sm">
            ${FILE_CATEGORIES.map(
              (category) =>
                `<option value="${escapeHtml(category)}"${category === 'Anexo' ? ' selected' : ''}>${escapeHtml(category)}</option>`,
            ).join('')}
          </select>
        </label>
        <button type="button" class="btn btn-primary btn-sm" id="btn-pick-file">
          ${icon('upload')} Enviar arquivo
        </button>
        <input
          type="file"
          id="drawer-file-input"
          class="visually-hidden"
          multiple
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.bmp"
        >
      </div>

      <div
        class="dropzone"
        id="drawer-dropzone"
        role="button"
        tabindex="0"
        aria-label="Enviar arquivos por arrastar e soltar ou clique"
      >
        <span class="dropzone-icon">${icon('upload')}</span>
        <strong>Arraste arquivos aqui</strong>
        <span>ou clique para selecionar · até ${MAX_FILE_MB} MB</span>
      </div>

      <div class="upload-progress" id="upload-progress" hidden>
        <div class="upload-progress-head">
          <span id="upload-name">Enviando…</span>
          <strong id="upload-percent">0%</strong>
        </div>
        <div class="progress-track"><span id="upload-bar"></span></div>
      </div>

      <ul class="file-list" id="drawer-file-list">
        ${renderFileItems(files)}
      </ul>
    </section>
  `;
}

function renderFileItems(files) {
  if (!files.length) {
    return `
      <li class="file-empty">
        ${icon('folder')}
        <span>Nenhum arquivo vinculado a este contrato.</span>
      </li>
    `;
  }

  return files
    .map((file) => {
      const extension = fileExtension(file.nome_original);
      const badgeClass = isPdfFile(file)
        ? 'pdf'
        : isImageFile(file)
          ? 'img'
          : ['DOC', 'DOCX'].includes(extension)
            ? 'doc'
            : ['XLS', 'XLSX', 'CSV'].includes(extension)
              ? 'xls'
              : 'other';

      return `
        <li class="file-item">
          <span class="file-badge file-badge-${badgeClass}">${escapeHtml(extension)}</span>
          <div class="file-info">
            <strong title="${escapeHtml(file.nome_original)}">${escapeHtml(file.nome_original)}</strong>
            <span>${escapeHtml(file.categoria)} · ${formatFileSize(file.tamanho)} · ${formatDateBR(file.enviado_em)}</span>
          </div>
          <div class="file-actions">
            <button type="button" class="icon-btn" title="Visualizar" aria-label="Visualizar ${escapeHtml(file.nome_original)}" data-file-action="preview" data-file-id="${file.id}">${icon('eye')}</button>
            <button type="button" class="icon-btn" title="Baixar" aria-label="Baixar ${escapeHtml(file.nome_original)}" data-file-action="download" data-file-id="${file.id}">${icon('download')}</button>
            <button type="button" class="icon-btn icon-btn-danger" title="Excluir" aria-label="Excluir ${escapeHtml(file.nome_original)}" data-file-action="delete" data-file-id="${file.id}">${icon('trash')}</button>
          </div>
        </li>
      `;
    })
    .join('');
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function validateFile(file) {
  const extension = fileExtension(file.name);
  if (DANGEROUS_FILE_EXTENSIONS.includes(extension) || !ALLOWED_FILE_EXTENSIONS.includes(extension)) {
    return `extensão ${extension || '?'} não permitida`;
  }
  if (file.size > MAX_FILE_BYTES) return `excede o limite de ${MAX_FILE_MB} MB`;
  if (file.size === 0) return 'arquivo vazio';
  return '';
}
