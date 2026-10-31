/** Painel inicial: indicadores, gráfico por situação e próximos vencimentos. */
import { state, refreshContracts, refreshFiles } from '../state.js';
import { icon } from '../icons.js';
import {
  contractSituation,
  daysLabel,
  daysUntil,
  escapeHtml,
  formatCurrency,
  formatDateBR,
  pluralize,
  SITUATIONS,
  sumBy,
} from '../utils.js';
import { openContractDrawer } from '../components/contractDrawer.js';

const CHART_ORDER = ['vigente', 'a_vencer', 'vencido', 'renovacao', 'rescindido'];

export async function renderDashboard(container, ctx) {
  const draw = () => {
    const contracts = state.contracts;
    const situations = contracts.map((contract) => contractSituation(contract));
    const counts = { vigente: 0, a_vencer: 0, vencido: 0, renovacao: 0, rescindido: 0 };
    situations.forEach((situation) => {
      counts[situation.key] = (counts[situation.key] || 0) + 1;
    });

    const totalValue = sumBy(contracts, (contract) => contract.valor_total);
    const monthlyValue = sumBy(contracts, (contract) => contract.valor_mensal);
    const upcoming = contracts
      .filter((contract) => contract.status !== 'Rescindido')
      .map((contract) => ({ contract, days: daysUntil(contract.data_fim) }))
      .filter((item) => item.days >= 0 && item.days <= 60)
      .sort((a, b) => a.days - b.days)
      .slice(0, 6);

    const attention = counts.a_vencer + counts.vencido;

    container.innerHTML = `
      <section class="dashboard-intro">
        <div>
          <h2>Olá, ${escapeHtml(state.user?.nome || 'Administrador')}</h2>
          <p>
            ${
              attention
                ? `Você tem <strong>${pluralize(counts.a_vencer, 'contrato a vencer', 'contratos a vencer')}</strong> em até 60 dias e <strong>${pluralize(counts.vencido, 'contrato vencido', 'contratos vencidos')}</strong>.`
                : 'Nenhum contrato vencido ou próximo do vencimento. Sua base está em dia.'
            }
          </p>
        </div>
        <span class="dashboard-today">
          ${icon('calendar')}
          ${escapeHtml(
            new Intl.DateTimeFormat('pt-BR', {
              weekday: 'long',
              day: '2-digit',
              month: 'long',
              year: 'numeric',
            }).format(new Date()),
          )}
        </span>
      </section>

      <section class="kpi-grid" aria-label="Indicadores da base">
        <a class="kpi-card" href="#/contratos">
          <span class="kpi-top"><span class="kpi-icon tone-neutral">${icon('contracts')}</span><span class="kpi-link">Ver todos ${icon('arrowRight')}</span></span>
          <span class="kpi-label">Total de contratos</span>
          <strong class="kpi-value">${contracts.length}</strong>
          <span class="kpi-foot">${pluralize(contracts.length, 'contrato cadastrado', 'contratos cadastrados')}</span>
        </a>

        <a class="kpi-card" href="#/contratos">
          <span class="kpi-top"><span class="kpi-icon tone-green">${icon('checkCircle')}</span></span>
          <span class="kpi-label">Vigentes</span>
          <strong class="kpi-value">${counts.vigente}</strong>
          <span class="kpi-foot"><span class="dot green"></span> em plena vigência</span>
        </a>

        <a class="kpi-card kpi-attention" href="#/contratos">
          <span class="kpi-top"><span class="kpi-icon tone-amber">${icon('clock')}</span>${counts.a_vencer ? '<span class="kpi-flag">Atenção</span>' : ''}</span>
          <span class="kpi-label">A vencer em 60 dias</span>
          <strong class="kpi-value">${counts.a_vencer}</strong>
          <span class="kpi-foot"><span class="dot amber"></span> exigem acompanhamento</span>
        </a>

        <a class="kpi-card" href="#/contratos">
          <span class="kpi-top"><span class="kpi-icon tone-red">${icon('alert')}</span></span>
          <span class="kpi-label">Vencidos</span>
          <strong class="kpi-value">${counts.vencido}</strong>
          <span class="kpi-foot"><span class="dot red"></span> ${counts.vencido ? 'necessitam de ação' : 'nenhuma pendência'}</span>
        </a>

        <article class="kpi-card kpi-value-card">
          <span class="kpi-top"><span class="kpi-icon tone-blue">${icon('wallet')}</span><span class="kpi-tag">Portfólio</span></span>
          <span class="kpi-label">Valor total</span>
          <strong class="kpi-value kpi-value-currency">${formatCurrency(totalValue)}</strong>
          <span class="kpi-foot">Mensalidades somam ${formatCurrency(monthlyValue)}</span>
        </article>
      </section>

      <section class="dashboard-grid">
        <article class="card chart-card">
          <header class="card-header">
            <div>
              <span class="eyebrow">Distribuição</span>
              <h3>Contratos por situação</h3>
            </div>
            <a class="text-link" href="#/contratos">Abrir planilha ${icon('arrowRight')}</a>
          </header>
          ${renderChart(counts, contracts.length)}
        </article>

        <article class="card upcoming-card">
          <header class="card-header">
            <div>
              <span class="eyebrow">Agenda</span>
              <h3>Próximos vencimentos</h3>
            </div>
            <span class="subtle-badge">60 dias</span>
          </header>
          ${renderUpcoming(upcoming)}
        </article>
      </section>

      <section class="dashboard-footer card">
        <div class="dashboard-footer-icon">${icon('shield')}</div>
        <div>
          <strong>Base demonstrativa</strong>
          <p>Os dados exibidos são fictícios. Toda leitura e gravação passa pela camada de dados, pronta para migrar ao Supabase.</p>
        </div>
        <a class="btn btn-secondary btn-sm" href="#/exportar">${icon('download')} Exportar base</a>
      </section>
    `;

    container.querySelectorAll('[data-contract-id]').forEach((button) => {
      button.addEventListener('click', () => {
        openContractDrawer(button.dataset.contractId, {
          onChange: async () => {
            await Promise.all([refreshContracts(), refreshFiles()]);
            ctx.refreshCounters?.();
            draw();
          },
        });
      });
    });
  };

  draw();
}

function renderChart(counts, total) {
  if (!total) {
    return `
      <div class="empty-state compact">
        <span class="empty-icon">${icon('dashboard')}</span>
        <p>Nenhum contrato para exibir no gráfico.</p>
        <a class="btn btn-primary btn-sm" href="#/contratos">Cadastrar contrato</a>
      </div>
    `;
  }

  const entries = CHART_ORDER.map((key) => ({
    ...SITUATIONS[key],
    count: counts[key] || 0,
  })).filter((entry) => entry.count > 0);

  let start = 0;
  const stops = entries.map((entry) => {
    const end = start + (entry.count / total) * 360;
    const stop = `${entry.color} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    start = end;
    return stop;
  });

  return `
    <div class="chart-body">
      <div class="donut-wrap">
        <div class="donut" style="background: conic-gradient(${stops.join(', ')})">
          <div class="donut-hole">
            <strong>${total}</strong>
            <span>contratos</span>
          </div>
        </div>
      </div>
      <ul class="chart-legend">
        ${CHART_ORDER.map((key) => {
          const meta = SITUATIONS[key];
          const count = counts[key] || 0;
          const percent = total ? Math.round((count / total) * 100) : 0;
          return `
            <li>
              <span class="legend-dot" style="background:${meta.color}"></span>
              <span class="legend-label">${escapeHtml(meta.label)}</span>
              <span class="legend-value">${count}</span>
              <span class="legend-percent">${percent}%</span>
            </li>
          `;
        }).join('')}
      </ul>
    </div>
  `;
}

function renderUpcoming(upcoming) {
  if (!upcoming.length) {
    return `
      <div class="empty-state compact">
        <span class="empty-icon success">${icon('checkCircle')}</span>
        <p>Nenhum contrato vence nos próximos 60 dias.</p>
      </div>
    `;
  }

  return `
    <ul class="upcoming-list">
      ${upcoming
        .map(({ contract, days }) => {
          const urgency = days <= 15 ? 'red' : days <= 30 ? 'amber' : 'blue';
          return `
            <li>
              <button type="button" class="upcoming-item" data-contract-id="${contract.id}">
                <span class="upcoming-date">
                  <strong>${formatDateBR(contract.data_fim).slice(0, 2)}</strong>
                  <small>${formatDateBR(contract.data_fim).slice(3, 5)}</small>
                </span>
                <span class="upcoming-main">
                  <span class="upcoming-title">${escapeHtml(contract.numero)} · ${escapeHtml(contract.objeto)}</span>
                  <span class="upcoming-company">${escapeHtml(contract.contratada)}</span>
                </span>
                <span class="upcoming-days tone-${urgency}">
                  ${days === 0 ? 'Hoje' : days === 1 ? 'Amanhã' : `${days} dias`}
                  <small>${escapeHtml(daysLabel(days))}</small>
                </span>
                <span class="upcoming-arrow">${icon('chevronRight')}</span>
              </button>
            </li>
          `;
        })
        .join('')}
    </ul>
  `;
}
