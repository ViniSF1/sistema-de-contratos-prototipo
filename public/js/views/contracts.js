/**
 * Tela "Contratos": grade estilo planilha com edição inline, filtros, ordenação,
 * redimensionamento e salvamento automático via adapter.
 */
import { adapter } from '../data/adapter.js';
import {
  contractById,
  refreshContracts,
  removeContractFromState,
  state,
  upsertContract,
} from '../state.js';
import { icon } from '../icons.js';
import { confirmDialog } from '../components/modal.js';
import { toast } from '../components/toast.js';
import { openContractDrawer } from '../components/contractDrawer.js';
import { STATUS_OPTIONS, TIPO_OPTIONS, isValidISODate } from '../constants.js';
import {
  addYearsISO,
  contractSearchText,
  contractSituation,
  daysLabel,
  escapeHtml,
  formatCurrency,
  formatDateBR,
  formatDateTimeBR,
  formatMoneyInput,
  normalizeText,
  parseMoney,
  sameId,
  sumBy,
  todayISO,
} from '../utils.js';

const PREFS_KEY = 'contrata.grid.prefs.v1';
const ACTIONS_WIDTH = 92;

const COLUMNS = [
  { key: 'numero', label: 'Nº do contrato', type: 'text', width: 145, className: 'cell-strong' },
  { key: 'objeto', label: 'Objeto', type: 'text', width: 290 },
  { key: 'contratada', label: 'Contratada', type: 'text', width: 215 },
  { key: 'cnpj', label: 'CNPJ', type: 'text', width: 175, className: 'mono' },
  { key: 'tipo', label: 'Tipo', type: 'select', options: TIPO_OPTIONS, width: 165 },
  { key: 'setor_responsavel', label: 'Setor responsável', type: 'text', width: 170 },
  { key: 'gestor', label: 'Gestor', type: 'text', width: 155 },
  { key: 'valor_total', label: 'Valor total', type: 'currency', width: 155, align: 'right' },
  { key: 'valor_mensal', label: 'Valor mensal', type: 'currency', width: 155, align: 'right' },
  { key: 'data_assinatura', label: 'Assinatura', type: 'date', width: 130 },
  { key: 'data_inicio', label: 'Início', type: 'date', width: 120 },
  { key: 'data_fim', label: 'Fim', type: 'date', width: 120 },
  { key: 'status', label: 'Status', type: 'status', width: 150 },
  { key: 'forma_reajuste', label: 'Forma de reajuste', type: 'text', width: 170 },
  { key: 'indice_reajuste', label: 'Índice', type: 'text', width: 125 },
  { key: 'observacoes', label: 'Observações', type: 'text', width: 280 },
  { key: 'criado_em', label: 'Criado em', type: 'datetime', width: 155, readonly: true },
  { key: 'atualizado_em', label: 'Atualizado em', type: 'datetime', width: 155, readonly: true },
];

const DEFAULT_HIDDEN = ['criado_em', 'atualizado_em'];
const DEFAULT_WIDTHS = Object.fromEntries(COLUMNS.map((column) => [column.key, column.width]));

const STATUS_TONE = {
  Vigente: 'vigente',
  'A vencer': 'a_vencer',
  Vencido: 'vencido',
  Rescindido: 'rescindido',
  'Em renovação': 'renovacao',
};

let prefs = loadPreferences();
let search = '';
let filters = {};
let sort = { key: null, direction: 'asc' };
let editing = null;
let saving = false;
let refs = {};
let rowsCache = [];
let savedStateTimer = null;

export async function renderContracts(container, ctx) {
  try {
    await refreshContracts();
  } catch (error) {
    if (error.status === 401) throw error;
    toast('Não foi possível atualizar os contratos agora.', 'error');
  }

  refs = {
    container,
    ctx,
    wrapper: null,
    tbody: null,
    table: null,
    searchInput: null,
    clearButton: null,
    saveState: null,
    columnMenu: null,
    columnButton: null,
  };

  container.innerHTML = `
    <section class="grid-card">
      <div class="grid-toolbar">
        <div class="toolbar-left">
          <label class="search-box" aria-label="Buscar em todos os campos">
            ${icon('search')}
            <input type="search" id="grid-search" placeholder="Buscar contratos, fornecedores, CNPJ…" autocomplete="off">
          </label>
          <button type="button" class="btn-link" id="btn-clear-filters" hidden>Limpar filtros</button>
        </div>
        <div class="toolbar-right">
          <div class="column-control">
            <button type="button" class="btn btn-secondary btn-sm" id="btn-columns" aria-expanded="false" aria-controls="column-menu">
              ${icon('columns')} Colunas ${icon('chevronDown')}
            </button>
            <div class="column-menu" id="column-menu" hidden>
              <div class="column-menu-head">
                <strong>Colunas visíveis</strong>
                <button type="button" class="icon-btn" id="btn-close-columns" aria-label="Fechar">${icon('x')}</button>
              </div>
              <div class="column-checks" id="column-checks"></div>
              <div class="column-menu-foot">
                <button type="button" class="btn-link" id="btn-reset-columns">Restaurar padrão</button>
              </div>
            </div>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-refresh" title="Recarregar do servidor">
            ${icon('refresh')} <span class="hide-small">Atualizar</span>
          </button>
          <button type="button" class="btn btn-secondary btn-sm" id="btn-grid-export">
            ${icon('download')} Exportar
          </button>
          <button type="button" class="btn btn-primary btn-sm" id="btn-new-contract">
            ${icon('plus')} Nova linha
          </button>
        </div>
      </div>

      <div class="grid-meta">
        <span id="grid-result">Carregando…</span>
        <span class="grid-tip">${icon('info')} Duplo clique ou digite para editar · Enter salva · Esc cancela</span>
      </div>

      <div class="sheet-wrap" id="sheet-wrap"></div>

      <footer class="sheet-footer">
        <div class="footer-stats">
          <span><strong id="footer-count">0</strong> <span id="footer-count-label">contratos exibidos</span></span>
          <span class="footer-divider"></span>
          <span>Valor total <strong id="footer-total">R$ 0,00</strong></span>
          <span class="footer-divider"></span>
          <span class="hide-small">Mensal <strong id="footer-monthly">R$ 0,00</strong></span>
        </div>
        <span class="save-state" id="grid-save-state">${icon('check')} Salvo automaticamente</span>
      </footer>
    </section>
  `;

  refs.wrapper = container.querySelector('#sheet-wrap');
  refs.searchInput = container.querySelector('#grid-search');
  refs.clearButton = container.querySelector('#btn-clear-filters');
  refs.saveState = container.querySelector('#grid-save-state');
  refs.columnMenu = container.querySelector('#column-menu');
  refs.columnButton = container.querySelector('#btn-columns');
  refs.searchInput.value = search;

  bindToolbar();
  bindTableEvents(ctx.signal);
  renderColumnMenu();
  renderTable();
  updateClearButton();

  return () => {
    editing = null;
    saving = false;
    window.clearTimeout(savedStateTimer);
  };
}

/* ----------------------------- Estrutura ----------------------------- */

function renderTable() {
  const columns = visibleColumns();
  const totalWidth =
    columns.reduce((sum, column) => sum + (prefs.widths[column.key] || column.width), 0) +
    ACTIONS_WIDTH;

  refs.wrapper.innerHTML = `
    <table class="sheet" id="sheet" style="width:${totalWidth}px">
      <colgroup>
        ${columns
          .map(
            (column) =>
              `<col data-key="${column.key}" style="width:${prefs.widths[column.key] || column.width}px">`,
          )
          .join('')}
        <col style="width:${ACTIONS_WIDTH}px">
      </colgroup>
      <thead>
        <tr class="sheet-head-row">
          ${columns
            .map(
              (column) => `
                <th scope="col" data-field="${column.key}" class="${column.align === 'right' ? 'align-right' : ''}">
                  <button type="button" class="th-label" data-sort-key="${column.key}">
                    ${escapeHtml(column.label)}
                    <span class="sort-arrow" aria-hidden="true"></span>
                  </button>
                  <span class="col-resizer" data-resize-key="${column.key}" role="separator" aria-orientation="vertical"></span>
                </th>
              `,
            )
            .join('')}
          <th scope="col" class="th-actions">Ações</th>
        </tr>
        <tr class="filter-row">
          ${columns
            .map((column) => `<th data-filter-field="${column.key}">${renderFilter(column)}</th>`)
            .join('')}
          <th class="th-actions"></th>
        </tr>
      </thead>
      <tbody id="sheet-body"></tbody>
    </table>
  `;

  refs.table = refs.wrapper.querySelector('#sheet');
  refs.tbody = refs.wrapper.querySelector('#sheet-body');
  updateSortIndicators();
  renderRows();
}

function renderFilter(column) {
  const current = filters[column.key] || '';
  if (column.type === 'status') {
    return `
      <select class="filter-input" data-filter="${column.key}" aria-label="Filtrar por status">
        <option value="">Todos</option>
        ${STATUS_OPTIONS.map(
          (option) =>
            `<option value="${escapeHtml(option)}"${option === current ? ' selected' : ''}>${escapeHtml(option)}</option>`,
        ).join('')}
      </select>
    `;
  }
  if (column.type === 'select') {
    return `
      <select class="filter-input" data-filter="${column.key}" aria-label="Filtrar por ${escapeHtml(column.label)}">
        <option value="">Todos</option>
        ${column.options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}"${option === current ? ' selected' : ''}>${escapeHtml(option)}</option>`,
          )
          .join('')}
      </select>
    `;
  }
  return `
    <input
      type="text"
      class="filter-input"
      data-filter="${column.key}"
      value="${escapeHtml(current)}"
      placeholder="Filtrar…"
      aria-label="Filtrar por ${escapeHtml(column.label)}"
      autocomplete="off"
    >
  `;
}

function renderRows() {
  const contracts = getVisibleContracts();
  rowsCache = contracts;
  const columns = visibleColumns();
  const scrollTop = refs.wrapper.scrollTop;
  const scrollLeft = refs.wrapper.scrollLeft;
  const focused = document.activeElement?.closest?.('td.cell');
  const focusedRef =
    focused && refs.wrapper.contains(focused)
      ? { id: focused.dataset.id, field: focused.dataset.field }
      : null;

  if (!contracts.length) {
    refs.tbody.innerHTML = `
      <tr>
        <td colspan="${columns.length + 1}">
          <div class="grid-empty">
            <span class="empty-icon">${icon('search')}</span>
            <strong>${state.contracts.length ? 'Nenhum contrato encontrado' : 'Nenhum contrato cadastrado'}</strong>
            <p>${
              state.contracts.length
                ? 'Ajuste a busca ou os filtros para ver outros resultados.'
                : 'Crie a primeira linha para começar a organizar seus contratos.'
            }</p>
            <button type="button" class="btn btn-primary btn-sm" data-empty-action="${state.contracts.length ? 'clear' : 'new'}">
              ${state.contracts.length ? 'Limpar filtros' : 'Nova linha'}
            </button>
          </div>
        </td>
      </tr>
    `;
  } else {
    refs.tbody.innerHTML = contracts
      .map((contract, rowIndex) => {
        const situation = contractSituation(contract);
        return `
          <tr data-id="${contract.id}" class="situation-${situation.key}">
            ${columns
              .map((column, columnIndex) => {
                const isFirst = rowIndex === 0 && columnIndex === 0;
                return `
                  <td
                    class="cell ${column.align === 'right' ? 'align-right' : ''} ${column.className || ''} ${column.readonly ? 'readonly' : ''}"
                    data-id="${contract.id}"
                    data-field="${column.key}"
                    data-type="${column.type}"
                    data-readonly="${column.readonly ? 'true' : 'false'}"
                    tabindex="${isFirst ? '0' : '-1'}"
                    title="${escapeHtml(displayTitle(contract, column))}"
                  >${displayCell(contract, column)}</td>
                `;
              })
              .join('')}
            <td class="cell-actions">
              <button type="button" class="icon-btn" data-row-action="detail" data-id="${contract.id}" title="Abrir ficha e arquivos" aria-label="Abrir ficha do contrato ${escapeHtml(contract.numero)}">
                ${icon('eye')}
              </button>
              <button type="button" class="icon-btn icon-btn-danger" data-row-action="delete" data-id="${contract.id}" title="Excluir contrato" aria-label="Excluir contrato ${escapeHtml(contract.numero)}">
                ${icon('trash')}
              </button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  refs.wrapper.scrollTop = scrollTop;
  refs.wrapper.scrollLeft = scrollLeft;
  updateMeta(contracts);
  updateFooter(contracts);
  updateSortIndicators();
  state.filteredIds = hasActiveFilter() ? contracts.map((contract) => contract.id) : null;

  if (focusedRef) {
    const cell = findCell(focusedRef.id, focusedRef.field);
    if (cell) focusCell(cell, { scroll: false });
  }
}

function updateMeta(contracts) {
  const total = state.contracts.length;
  const filtered = hasActiveFilter();
  const result = refs.container.querySelector('#grid-result');
  if (result) {
    result.innerHTML = filtered
      ? `<strong>${contracts.length}</strong> de ${total} contratos após os filtros`
      : `<strong>${total}</strong> ${total === 1 ? 'contrato' : 'contratos'} na base`;
  }
}

function updateFooter(contracts) {
  const count = refs.container.querySelector('#footer-count');
  const countLabel = refs.container.querySelector('#footer-count-label');
  const total = refs.container.querySelector('#footer-total');
  const monthly = refs.container.querySelector('#footer-monthly');
  if (count) count.textContent = String(contracts.length);
  if (countLabel) {
    countLabel.textContent =
      contracts.length === state.contracts.length
        ? contracts.length === 1
          ? 'contrato exibido'
          : 'contratos exibidos'
        : `de ${state.contracts.length} contratos`;
  }
  if (total) total.textContent = formatCurrency(sumBy(contracts, (contract) => contract.valor_total));
  if (monthly) {
    monthly.textContent = formatCurrency(sumBy(contracts, (contract) => contract.valor_mensal));
  }
}

/* ------------------------------ Dados -------------------------------- */

function visibleColumns() {
  return COLUMNS.filter((column) => !prefs.hidden.includes(column.key));
}

function getVisibleContracts() {
  let contracts = [...state.contracts];

  if (search.trim()) {
    const term = normalizeText(search);
    contracts = contracts.filter((contract) => contractSearchText(contract).includes(term));
  }

  for (const [key, raw] of Object.entries(filters)) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const column = COLUMNS.find((item) => item.key === key);
    if (!column) continue;

    if (column.type === 'status' || column.type === 'select') {
      contracts = contracts.filter((contract) => String(contract[key]) === value);
      continue;
    }

    const normalized = normalizeText(value);
    contracts = contracts.filter((contract) => {
      const rawValue = normalizeText(contract[key]);
      const display = normalizeText(displayValueForFilter(contract, column));
      return rawValue.includes(normalized) || display.includes(normalized);
    });
  }

  if (sort.key) {
    const column = COLUMNS.find((item) => item.key === sort.key);
    const direction = sort.direction === 'asc' ? 1 : -1;
    contracts.sort((a, b) => compareValues(a, b, column) * direction);
  }

  return contracts;
}

function compareValues(a, b, column) {
  if (!column) return 0;
  if (column.type === 'currency') {
    return Number(a[column.key] || 0) - Number(b[column.key] || 0);
  }
  if (column.key === 'id') {
    return String(a.id).localeCompare(String(b.id), 'pt-BR', { numeric: true });
  }
  if (column.type === 'date' || column.type === 'datetime') {
    return String(a[column.key] || '').localeCompare(String(b[column.key] || ''));
  }
  return String(a[column.key] ?? '').localeCompare(String(b[column.key] ?? ''), 'pt-BR', {
    numeric: true,
    sensitivity: 'base',
  });
}

function displayValueForFilter(contract, column) {
  if (column.type === 'currency') return formatCurrency(contract[column.key]);
  if (column.type === 'date') return formatDateBR(contract[column.key]);
  if (column.type === 'datetime') return formatDateTimeBR(contract[column.key]);
  return contract[column.key] ?? '';
}

function displayTitle(contract, column) {
  const value = displayValueForFilter(contract, column);
  return value === '' || value === undefined ? column.label : String(value);
}

function displayCell(contract, column) {
  const value = contract[column.key];

  if (column.type === 'currency') {
    return `<span class="cell-currency">${formatCurrency(value)}</span>`;
  }
  if (column.key === 'data_fim' && value) {
    const situation = contractSituation(contract);
    return `<span class="cell-date situation-text-${situation.key}">${formatDateBR(value)}</span>`;
  }
  if (column.type === 'date') {
    return value
      ? `<span class="cell-date">${formatDateBR(value)}</span>`
      : '<span class="cell-empty">—</span>';
  }
  if (column.type === 'datetime') {
    return value
      ? `<span class="cell-datetime">${formatDateTimeBR(value)}</span>`
      : '<span class="cell-empty">—</span>';
  }
  if (column.type === 'status') {
    const tone = STATUS_TONE[value] || 'vigente';
    return `
      <span class="status-pill situation-${tone}">
        <span class="status-pill-dot"></span>${escapeHtml(value || '—')}
      </span>
    `;
  }
  if (value === null || value === undefined || String(value).trim() === '') {
    return '<span class="cell-empty">—</span>';
  }
  return escapeHtml(value);
}

/* ----------------------------- Toolbar ------------------------------- */

function bindToolbar() {
  const container = refs.container;

  refs.searchInput.addEventListener('input', () => {
    search = refs.searchInput.value;
    renderRows();
    updateClearButton();
  });

  refs.clearButton.addEventListener('click', () => clearFilters());

  refs.columnButton.addEventListener('click', (event) => {
    event.stopPropagation();
    toggleColumnMenu();
  });

  refs.columnMenu.addEventListener('click', (event) => event.stopPropagation());

  refs.container.querySelector('#btn-close-columns').addEventListener('click', closeColumnMenu);

  refs.columnMenu.addEventListener('change', (event) => {
    const checkbox = event.target.closest('input[data-column]');
    if (!checkbox) return;
    const key = checkbox.dataset.column;
    if (checkbox.checked) {
      prefs.hidden = prefs.hidden.filter((item) => item !== key);
    } else {
      if (visibleColumns().length <= 1) {
        checkbox.checked = true;
        toast('Mantenha pelo menos uma coluna visível.', 'info');
        return;
      }
      prefs.hidden.push(key);
    }
    savePreferences();
    renderTable();
  });

  refs.container.querySelector('#btn-reset-columns').addEventListener('click', () => {
    prefs.hidden = [...DEFAULT_HIDDEN];
    prefs.widths = { ...DEFAULT_WIDTHS };
    savePreferences();
    renderColumnMenu();
    renderTable();
    toast('Colunas e larguras restauradas.', 'success');
  });

  refs.container.querySelector('#btn-refresh').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await refreshContracts();
      renderRows();
      refs.ctx.refreshCounters?.();
      toast('Contratos atualizados.', 'success');
    } catch (error) {
      toast(error.message || 'Não foi possível atualizar.', 'error');
    } finally {
      button.disabled = false;
    }
  });

  refs.container.querySelector('#btn-grid-export').addEventListener('click', async () => {
    if (saving) {
      toast('Aguarde o salvamento da célula antes de exportar.', 'info');
      return;
    }
    state.filteredIds = hasActiveFilter()
      ? getVisibleContracts().map((contract) => contract.id)
      : null;
    refs.ctx.navigate('exportar');
  });

  refs.container.querySelector('#btn-new-contract').addEventListener('click', createNewRow);

  // Fecha o menu de colunas ao clicar fora dele.
  document.addEventListener(
    'click',
    (event) => {
      if (
        !event.target.closest('#column-menu') &&
        !event.target.closest('#btn-columns')
      ) {
        closeColumnMenu();
      }
    },
    { signal: refs.ctx.signal },
  );
}

function renderColumnMenu() {
  const checks = refs.columnMenu.querySelector('#column-checks');
  checks.innerHTML = COLUMNS.map(
    (column) => `
      <label class="column-check">
        <input type="checkbox" data-column="${column.key}"${prefs.hidden.includes(column.key) ? '' : ' checked'}>
        <span>${escapeHtml(column.label)}</span>
      </label>
    `,
  ).join('');
}

function toggleColumnMenu() {
  const isOpen = refs.columnMenu.hidden;
  refs.columnMenu.hidden = !isOpen;
  refs.columnButton.setAttribute('aria-expanded', String(isOpen));
}

function closeColumnMenu() {
  if (!refs.columnMenu || refs.columnMenu.hidden) return;
  refs.columnMenu.hidden = true;
  refs.columnButton?.setAttribute('aria-expanded', 'false');
}

function updateClearButton() {
  if (!refs.clearButton) return;
  refs.clearButton.hidden = !hasActiveFilter();
}

function hasActiveFilter() {
  return Boolean(search.trim()) || Object.values(filters).some((value) => String(value).trim());
}

function clearFilters() {
  search = '';
  filters = {};
  if (refs.searchInput) refs.searchInput.value = '';
  refs.container.querySelectorAll('[data-filter]').forEach((input) => {
    input.value = '';
  });
  updateClearButton();
  renderRows();
}

/* ---------------------------- Navegação ------------------------------ */

function bindTableEvents(signal) {
  const container = refs.container;

  container.addEventListener(
    'click',
    (event) => {
      const emptyAction = event.target.closest('[data-empty-action]');
      if (emptyAction) {
        if (emptyAction.dataset.emptyAction === 'clear') clearFilters();
        else createNewRow();
        return;
      }

      const sortButton = event.target.closest('[data-sort-key]');
      if (sortButton) {
        toggleSort(sortButton.dataset.sortKey);
        return;
      }

      const actionButton = event.target.closest('[data-row-action]');
      if (actionButton) {
        if (actionButton.dataset.rowAction === 'detail') {
          openDetail(actionButton.dataset.id);
        } else if (actionButton.dataset.rowAction === 'delete') {
          deleteContract(actionButton.dataset.id);
        }
        return;
      }
    },
    { signal },
  );

  container.addEventListener(
    'mousedown',
    (event) => {
      if (event.target.closest('button, a, input, select, textarea')) return;
      const cell = event.target.closest('td.cell');
      if (!cell) return;

      if (editing) {
        if (cell === editing.td) return;
        event.preventDefault();
        commitEdit(null, cell);
      } else {
        event.preventDefault();
        focusCell(cell);
      }
    },
    { signal },
  );

  container.addEventListener(
    'dblclick',
    (event) => {
      if (event.target.closest('button, input, select, textarea')) return;
      const cell = event.target.closest('td.cell');
      if (!cell || cell.dataset.readonly === 'true') return;
      event.preventDefault();
      beginEdit(cell);
    },
    { signal },
  );

  container.addEventListener(
    'focusin',
    (event) => {
      const cell = event.target.closest('td.cell');
      if (!cell) return;
      container.querySelectorAll('td.cell.cell-focused').forEach((item) => {
        if (item !== cell) {
          item.classList.remove('cell-focused');
          item.tabIndex = -1;
        }
      });
      cell.classList.add('cell-focused');
      cell.tabIndex = 0;
    },
    { signal },
  );

  container.addEventListener(
    'keydown',
    (event) => {
      const cell = event.target.closest('td.cell');
      if (!cell || editing) return;

      if (event.key === 'Enter' || event.key === 'F2') {
        event.preventDefault();
        beginEdit(cell);
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        moveFocus(cell, event.shiftKey ? 'prev' : 'next');
        return;
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveFocus(cell, 'down');
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveFocus(cell, 'up');
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        moveFocus(cell, 'right');
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        moveFocus(cell, 'left');
        return;
      }
      if (cell.dataset.readonly === 'true') return;
      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey
      ) {
        event.preventDefault();
        beginEdit(cell, event.key);
      }
    },
    { signal },
  );

  container.addEventListener(
    'input',
    (event) => {
      const input = event.target.closest('[data-filter]');
      if (!input) return;
      filters[input.dataset.filter] = input.value;
      updateClearButton();
      renderRows();
    },
    { signal },
  );

  container.addEventListener(
    'change',
    (event) => {
      const input = event.target.closest('select[data-filter]');
      if (!input) return;
      filters[input.dataset.filter] = input.value;
      updateClearButton();
      renderRows();
    },
    { signal },
  );

  container.addEventListener(
    'mousedown',
    (event) => {
      const resizer = event.target.closest('[data-resize-key]');
      if (!resizer) return;
      startResize(event, resizer.dataset.resizeKey);
    },
    { signal },
  );
}

function toggleSort(key) {
  if (sort.key === key) {
    sort.direction = sort.direction === 'asc' ? 'desc' : 'asc';
  } else {
    sort = { key, direction: 'asc' };
  }
  renderRows();
}

function updateSortIndicators() {
  if (!refs.table) return;
  refs.table.querySelectorAll('th[data-field]').forEach((th) => {
    const arrow = th.querySelector('.sort-arrow');
    const isActive = sort.key === th.dataset.field;
    if (arrow) arrow.textContent = isActive ? (sort.direction === 'asc' ? '↑' : '↓') : '';
    if (isActive) th.setAttribute('aria-sort', sort.direction === 'asc' ? 'ascending' : 'descending');
    else th.removeAttribute('aria-sort');
  });
}

function startResize(event, key) {
  event.preventDefault();
  event.stopPropagation();
  const startX = event.clientX;
  const startWidth = prefs.widths[key] || COLUMNS.find((column) => column.key === key)?.width || 120;
  document.body.classList.add('resizing-column');

  const onMove = (moveEvent) => {
    const next = Math.min(600, Math.max(70, startWidth + moveEvent.clientX - startX));
    prefs.widths[key] = next;
    const col = refs.wrapper.querySelector(`col[data-key="${key}"]`);
    if (col) col.style.width = `${next}px`;
    updateTableWidth();
  };

  const onUp = () => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.classList.remove('resizing-column');
    savePreferences();
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function updateTableWidth() {
  if (!refs.table) return;
  const columns = visibleColumns();
  const total =
    columns.reduce((sum, column) => sum + (prefs.widths[column.key] || column.width), 0) +
    ACTIONS_WIDTH;
  refs.table.style.width = `${total}px`;
}

function moveFocus(cell, direction) {
  const id = cell.dataset.id;
  const field = cell.dataset.field;
  const fields = visibleColumns().map((column) => column.key);
  const ids = Array.from(refs.tbody.querySelectorAll('tr[data-id]')).map(
    (row) => row.dataset.id,
  );
  let rowIndex = ids.indexOf(id);
  let columnIndex = fields.indexOf(field);

  if (direction === 'next') {
    columnIndex += 1;
    if (columnIndex >= fields.length) {
      columnIndex = 0;
      rowIndex += 1;
    }
  } else if (direction === 'prev') {
    columnIndex -= 1;
    if (columnIndex < 0) {
      columnIndex = fields.length - 1;
      rowIndex -= 1;
    }
  } else if (direction === 'right') {
    columnIndex += 1;
  } else if (direction === 'left') {
    columnIndex -= 1;
  } else if (direction === 'down') {
    rowIndex += 1;
  } else if (direction === 'up') {
    rowIndex -= 1;
  }

  if (rowIndex < 0 || rowIndex >= ids.length) return;
  if (columnIndex < 0 || columnIndex >= fields.length) return;

  const target = findCell(ids[rowIndex], fields[columnIndex]);
  if (target) focusCell(target);
}

function focusCell(cell, { scroll = true } = {}) {
  if (!cell) return;
  refs.tbody.querySelectorAll('td.cell.cell-focused').forEach((item) => {
    if (item !== cell) {
      item.classList.remove('cell-focused');
      item.tabIndex = -1;
    }
  });
  cell.classList.add('cell-focused');
  cell.tabIndex = 0;
  cell.focus({ preventScroll: true });
  if (scroll) cell.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function findCell(id, field) {
  return refs.tbody?.querySelector(`td.cell[data-id="${id}"][data-field="${field}"]`) || null;
}

function focusRelative(id, field, direction) {
  if (!direction) return;
  const cell = findCell(id, field);
  if (cell) moveFocus(cell, direction);
}

/* ----------------------------- Edição -------------------------------- */

function beginEdit(cell, seed = '') {
  if (saving || !cell || cell.dataset.readonly === 'true') return;
  if (editing) {
    if (editing.td === cell) return;
    return;
  }

  const id = cell.dataset.id;
  const field = cell.dataset.field;
  const column = COLUMNS.find((item) => item.key === field);
  const contract = contractById(id);
  if (!column || !contract) return;

  const originalHtml = cell.innerHTML;
  const originalValue = contract[field];
  const input = buildEditor(column, contract);

  cell.classList.add('editing');
  cell.innerHTML = '';
  cell.appendChild(input);

  editing = {
    cell,
    input,
    id,
    field,
    column,
    originalHtml,
    originalValue,
  };

  if (seed && column.type !== 'select' && column.type !== 'status' && column.type !== 'date') {
    input.value = seed;
    const length = input.value.length;
    input.setSelectionRange?.(length, length);
  } else {
    input.select?.();
  }

  input.focus({ preventScroll: true });

  input.addEventListener('keydown', (event) => {
    event.stopPropagation();
    if (event.key === 'Enter') {
      event.preventDefault();
      commitEdit('down');
    } else if (event.key === 'Tab') {
      event.preventDefault();
      commitEdit(event.shiftKey ? 'prev' : 'next');
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancelEdit();
    }
  });

  input.addEventListener('blur', () => {
    if (editing?.input === input) commitEdit();
  });
}

function buildEditor(column, contract) {
  if (column.type === 'status' || column.type === 'select') {
    const select = document.createElement('select');
    select.className = 'cell-editor';
    const options = column.type === 'status' ? STATUS_OPTIONS : column.options;
    options.forEach((option) => {
      const element = document.createElement('option');
      element.value = option;
      element.textContent = option;
      select.appendChild(element);
    });
    select.value = contract[column.key] ?? options[0];
    return select;
  }

  const input = document.createElement('input');
  input.className = 'cell-editor';
  if (column.type === 'date') {
    input.type = 'date';
    input.value = contract[column.key] || '';
  } else if (column.type === 'currency') {
    input.type = 'text';
    input.inputMode = 'decimal';
    input.value = formatMoneyInput(contract[column.key]);
  } else {
    input.type = 'text';
    input.value = contract[column.key] ?? '';
  }
  return input;
}

async function commitEdit(direction = null, focusTarget = null) {
  if (!editing) return;
  const current = editing;
  const targetRef = focusTarget
    ? { id: focusTarget.dataset.id, field: focusTarget.dataset.field }
    : null;

  const error = validateCell(current, current.input.value);
  if (error) {
    toast(error, 'error');
    current.input.classList.add('invalid');
    current.input.focus();
    return;
  }

  const value = parseCellValue(current, current.input.value);
  const unchanged = valuesEqual(current.originalValue, value);

  editing = null;
  current.input.remove();
  current.cell.classList.remove('editing');
  current.cell.innerHTML = current.originalHtml;

  if (unchanged) {
    if (targetRef) focusCell(findCell(targetRef.id, targetRef.field));
    else focusRelative(current.id, current.field, direction);
    return;
  }

  saving = true;
  current.cell.classList.add('saving');
  setSaveState('saving');

  try {
    const updated = await adapter.updateContract(current.id, {
      [current.field]: value,
    });
    upsertContract(updated);
    renderRows();
    setSaveState('saved');
    refs.ctx.refreshCounters?.();

    if (targetRef) {
      focusCell(findCell(targetRef.id, targetRef.field));
    } else {
      focusRelative(current.id, current.field, direction);
    }
  } catch (saveError) {
    setSaveState('error');
    const message =
      saveError.campos?.[current.field] ||
      saveError.message ||
      'Não foi possível salvar a alteração.';
    toast(message, 'error');
    renderRows();
    focusCell(findCell(current.id, current.field));
  } finally {
    saving = false;
  }
}

function cancelEdit() {
  if (!editing) return;
  const { cell, input, originalHtml, id, field } = editing;
  editing = null;
  input.remove();
  cell.classList.remove('editing');
  cell.innerHTML = originalHtml;
  focusCell(findCell(id, field));
}

function validateCell(current, rawValue) {
  const { column, id } = current;
  const contract = contractById(id);
  const raw = String(rawValue ?? '').trim();

  if (column.key === 'numero') {
    if (!raw) return 'O número do contrato é obrigatório.';
    const duplicated = state.contracts.some(
      (item) =>
        !sameId(item.id, id) &&
        normalizeText(item.numero) === normalizeText(raw),
    );
    if (duplicated) return 'Já existe um contrato com este número.';
  }

  if ((column.key === 'objeto' || column.key === 'contratada') && !raw) {
    return `O campo "${column.label}" é obrigatório.`;
  }

  if (column.type === 'currency') {
    const parsed = parseMoney(rawValue);
    if (!Number.isFinite(parsed) || parsed < 0) {
      return 'Informe um valor numérico maior ou igual a zero.';
    }
  }

  if (column.type === 'date') {
    if (!raw && column.key !== 'data_assinatura') {
      return `Informe uma data válida em "${column.label}".`;
    }
    if (raw) {
      if (!isValidISODate(raw)) {
        return `Informe uma data válida em "${column.label}".`;
      }
      if (!contract) return 'Contrato não encontrado.';
      if (column.key === 'data_fim' && contract.data_inicio && raw < contract.data_inicio) {
        return 'A data de fim deve ser igual ou posterior à data de início.';
      }
      if (column.key === 'data_inicio' && contract.data_fim && raw > contract.data_fim) {
        return 'A data de início não pode ser posterior à data de fim.';
      }
    }
  }

  if ((column.type === 'status' || column.type === 'select') && !raw) {
    return 'Selecione uma opção válida.';
  }

  return '';
}

function parseCellValue(current, rawValue) {
  const { column } = current;
  if (column.type === 'currency') return parseMoney(rawValue);
  if (column.type === 'date') return String(rawValue || '').slice(0, 10);
  return String(rawValue ?? '').trim();
}

function valuesEqual(original, value) {
  if (typeof value === 'number') return Number(original || 0) === value;
  return String(original ?? '') === String(value ?? '');
}

function setSaveState(kind) {
  if (!refs.saveState) return;
  window.clearTimeout(savedStateTimer);

  if (kind === 'saving') {
    refs.saveState.className = 'save-state saving';
    refs.saveState.innerHTML = `<span class="spinner spinner-tiny"></span> Salvando…`;
    return;
  }

  if (kind === 'error') {
    refs.saveState.className = 'save-state error';
    refs.saveState.innerHTML = `${icon('alert')} Falha ao salvar`;
    return;
  }

  const time = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
  refs.saveState.className = 'save-state saved';
  refs.saveState.innerHTML = `${icon('check')} Salvo às ${time}`;
  savedStateTimer = window.setTimeout(() => {
    if (!refs.saveState) return;
    refs.saveState.className = 'save-state';
    refs.saveState.innerHTML = `${icon('check')} Salvo automaticamente`;
  }, 4000);
}

/* --------------------------- Ações da grade -------------------------- */

/** Gera número sequencial único no formato CT-AAAA-NNN. */
function generateContractNumber() {
  const year = new Date().getFullYear();
  const used = new Set(state.contracts.map((item) => String(item.numero).toUpperCase()));
  let seq = 1;
  let candidate = '';
  do {
    candidate = `CT-${year}-${String(seq).padStart(3, '0')}`;
    seq += 1;
  } while (used.has(candidate.toUpperCase()));
  return candidate;
}

async function createNewRow() {
  const button = refs.container.querySelector('#btn-new-contract');
  if (button) button.disabled = true;
  const today = todayISO();

  try {
    const created = await adapter.createContract({
      numero: generateContractNumber(),
      objeto: 'Novo contrato',
      contratada: 'A definir',
      cnpj: '',
      tipo: 'Prestação de Serviços',
      setor_responsavel: 'A definir',
      gestor: '',
      valor_total: 0,
      valor_mensal: 0,
      data_assinatura: today,
      data_inicio: today,
      data_fim: addYearsISO(today, 1),
      status: 'Vigente',
      forma_reajuste: 'Anual',
      indice_reajuste: 'IPCA',
      observacoes: '',
    });

    upsertContract(created);
    search = '';
    filters = {};
    sort = { key: null, direction: 'asc' };
    refs.searchInput.value = '';
    updateClearButton();
    renderTable();
    refs.ctx.refreshCounters?.();
    toast(`Nova linha criada (${created.numero}). Edite os dados na planilha.`, 'success');

    const cell = findCell(created.id, 'numero');
    if (cell) {
      focusCell(cell);
      beginEdit(cell);
    }
  } catch (error) {
    toast(error.message || 'Não foi possível criar a nova linha.', 'error');
  } finally {
    if (button) button.disabled = false;
  }
}

function openDetail(id) {
  openContractDrawer(id, {
    onChange: async (event) => {
      refs.ctx.refreshCounters?.();
      if (event?.type === 'deleted') {
        renderRows();
      }
    },
  });
}

async function deleteContract(id) {
  const contract = contractById(id);
  if (!contract) return;
  const related = state.files.filter((file) => sameId(file.contrato_id, id));

  const confirmed = await confirmDialog({
    title: 'Excluir contrato',
    message: `Excluir definitivamente o contrato ${contract.numero}?`,
    detail:
      related.length > 0
        ? `"${contract.objeto}" possui ${related.length} arquivo(s). Todos serão removidos junto com o contrato.`
        : `"${contract.objeto}" será removido da base. Esta ação não pode ser desfeita.`,
    confirmLabel: 'Excluir contrato',
  });
  if (!confirmed) return;

  try {
    await adapter.deleteContract(id);
    removeContractFromState(id);
    renderRows();
    refs.ctx.refreshCounters?.();
    toast(`Contrato ${contract.numero} excluído.`, 'success');
  } catch (error) {
    toast(error.message || 'Não foi possível excluir o contrato.', 'error');
  }
}

/* --------------------------- Preferências ---------------------------- */

function loadPreferences() {
  const fallback = { hidden: [...DEFAULT_HIDDEN], widths: { ...DEFAULT_WIDTHS } };
  try {
    const stored = JSON.parse(window.localStorage.getItem(PREFS_KEY) || 'null');
    if (!stored) return fallback;
    return {
      hidden: Array.isArray(stored.hidden) ? stored.hidden : fallback.hidden,
      widths: { ...DEFAULT_WIDTHS, ...(stored.widths || {}) },
    };
  } catch {
    return fallback;
  }
}

function savePreferences() {
  try {
    window.localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ hidden: prefs.hidden, widths: prefs.widths }),
    );
  } catch {
    /* armazenamento indisponível */
  }
}
