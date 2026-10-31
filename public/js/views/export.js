/** Tela "Exportar": CSV compatível com Excel pt-BR e XLSX com três abas. */
import { adapter } from '../data/adapter.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';
import { downloadBlob, formatCurrency, sumBy } from '../utils.js';

export async function renderExport(container) {
  const contracts = state.contracts;
  const filteredSet = new Set(state.filteredIds || []);
  const filtered = state.filteredIds ? contracts.filter((contract) => filteredSet.has(contract.id)) : [];
  const hasFiltered = filtered.length > 0;

  container.innerHTML = `
    <section class="view-intro">
      <div>
        <h2>Exportar base de contratos</h2>
        <p>Gere uma cópia organizada da base para análise, auditoria ou compartilhamento.</p>
      </div>
      <a class="btn btn-secondary" href="#/contratos">${icon('arrowLeft')} Voltar para contratos</a>
    </section>

    <section class="card export-scope-card">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Escopo</span>
          <h3>O que deseja exportar?</h3>
        </div>
      </div>
      <div class="scope-options" role="radiogroup" aria-label="Escopo da exportação">
        <label class="scope-option ${hasFiltered ? '' : 'selected'}">
          <input type="radio" name="export-scope" value="all" ${hasFiltered ? '' : 'checked'}>
          <span class="scope-radio"></span>
          <span class="scope-content">
            <strong>Toda a base</strong>
            <span>${contracts.length} contratos · ${formatCurrency(sumBy(contracts, (item) => item.valor_total))}</span>
          </span>
        </label>
        <label class="scope-option ${hasFiltered ? 'selected' : 'disabled'}">
          <input type="radio" name="export-scope" value="filtered" ${hasFiltered ? 'checked' : 'disabled'}>
          <span class="scope-radio"></span>
          <span class="scope-content">
            <strong>Somente filtrados</strong>
            <span>${
              hasFiltered
                ? `${filtered.length} contratos · ${formatCurrency(sumBy(filtered, (item) => item.valor_total))}`
                : 'Aplique filtros na tela Contratos para habilitar'
            }</span>
          </span>
        </label>
      </div>
      ${
        hasFiltered
          ? `<p class="scope-hint">${icon('info')} O último filtro aplicado na planilha foi preservado para esta exportação.</p>`
          : ''
      }
    </section>

    <section class="export-grid">
      <article class="card export-card">
        <span class="export-icon tone-green">${icon('table')}</span>
        <div class="export-card-head">
          <span class="eyebrow">Planilha rápida</span>
          <h3>CSV para Excel</h3>
        </div>
        <p>Arquivo leve, ideal para abrir diretamente no Excel brasileiro.</p>
        <ul class="export-features">
          <li>${icon('check')} Codificação UTF-8 com BOM (acentos corretos)</li>
          <li>${icon('check')} Separador ponto e vírgula (;)</li>
          <li>${icon('check')} Datas em dd/mm/aaaa e valores com vírgula</li>
          <li>${icon('check')} Todos os campos dos contratos</li>
        </ul>
        <div class="export-card-foot">
          <code class="filename">contratos_AAAA-MM-DD.csv</code>
          <button type="button" class="btn btn-primary" data-export="csv">
            ${icon('download')} Baixar CSV
          </button>
        </div>
      </article>

      <article class="card export-card export-card-featured">
        <span class="export-badge">Recomendado</span>
        <span class="export-icon tone-blue">${icon('contracts')}</span>
        <div class="export-card-head">
          <span class="eyebrow">Relatório completo</span>
          <h3>Excel com 3 abas</h3>
        </div>
        <p>Relatório estruturado, com cabeçalhos formatados e filtros automáticos.</p>
        <ul class="export-features">
          <li>${icon('check')} Aba <strong>Contratos</strong> com todos os campos</li>
          <li>${icon('check')} Aba <strong>Arquivos</strong> com anexos por contrato</li>
          <li>${icon('check')} Aba <strong>Resumo</strong> por status, tipo e totais</li>
          <li>${icon('check')} Primeira linha congelada e filtro automático</li>
        </ul>
        <div class="export-card-foot">
          <code class="filename">contratos_AAAA-MM-DD.xlsx</code>
          <button type="button" class="btn btn-primary" data-export="xlsx">
            ${icon('download')} Baixar Excel
          </button>
        </div>
      </article>
    </section>

    <section class="card export-note">
      <span class="export-note-icon">${icon('shield')}</span>
      <div>
        <strong>Exportação processada localmente</strong>
        <p>
          Os arquivos são gerados pelo servidor a partir da mesma camada de dados usada pelas telas.
          Nenhum dado é enviado para serviços externos neste ambiente.
        </p>
      </div>
    </section>
  `;

  let scope = hasFiltered ? 'filtered' : 'all';

  container.querySelectorAll('input[name="export-scope"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      scope = radio.value;
      container.querySelectorAll('.scope-option').forEach((option) => {
        option.classList.toggle('selected', option.querySelector('input').checked);
      });
    });
  });

  container.querySelectorAll('[data-export]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (scope === 'filtered' && !hasFiltered) {
        toast('Nenhum contrato filtrado para exportar.', 'info');
        return;
      }

      const formato = button.dataset.export;
      const originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="spinner spinner-tiny"></span> Gerando arquivo…';

      try {
        const { blob, filename } = await adapter.exportData({
          formato,
          escopo: scope,
          ids: scope === 'filtered' ? filtered.map((contract) => contract.id) : [],
        });
        downloadBlob(blob, filename);
        toast(
          `Exportação ${formato.toUpperCase()} concluída${scope === 'filtered' ? ` com ${filtered.length} contratos filtrados` : ''}.`,
          'success',
        );
      } catch (error) {
        toast(error.message || 'Não foi possível gerar a exportação.', 'error');
      } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
      }
    });
  });
}
