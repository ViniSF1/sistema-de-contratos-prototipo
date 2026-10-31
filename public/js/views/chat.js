/**
 * Tela "Agente" — assistente conversacional sobre contratos, fornecedores,
 * anexos e funcionamento do sistema. Tudo roda localmente (sem chamada a IA externa).
 */
import { adapter } from '../data/adapter.js';
import { state } from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';
import {
  escapeHtml,
  formatCurrency,
  formatDateBR,
  normalizeText,
  contractSituation,
} from '../utils.js';

const BOT = 'agente';
const USER = 'usuario';

/* --------------------------------- dados --------------------------------- */

function totalContratos() {
  return state.contracts.length;
}

function contratosPorSituacao() {
  const contagem = {};
  for (const c of state.contracts) {
    const s = contractSituation(c).label || c.status;
    contagem[s] = (contagem[s] || 0) + 1;
  }
  return contagem;
}

function fornecedores() {
  const mapa = new Map();
  for (const c of state.contracts) {
    const chave = c.contratada || 'Não informado';
    const atual = mapa.get(chave) || { nome: chave, total: 0, valor: 0 };
    atual.total += 1;
    atual.valor += Number(c.valor_total || 0);
    mapa.set(chave, atual);
  }
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total || b.valor - a.valor);
}

function valorTotalBase() {
  return state.contracts.reduce((s, c) => s + Number(c.valor_total || 0), 0);
}

function proximosVencimentos(limite = 5) {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const lista = [];
  for (const c of state.contracts) {
    if (!c.data_fim) continue;
    const fim = new Date(c.data_fim);
    fim.setHours(0, 0, 0, 0);
    const diff = Math.round((fim - hoje) / 86400000);
    if (diff >= 0 && diff <= 180) {
      lista.push({ ...c, dias: diff });
    }
  }
  return lista.sort((a, b) => a.dias - b.dias).slice(0, limite);
}

function arquivosTotais() {
  return state.files.length;
}

/* ------------------------------- intenções ------------------------------- */

function buscarContratoPorNumero(texto) {
  const alvo = normalizeText(texto);
  return state.contracts.find(
    (c) => normalizeText(c.numero).includes(alvo) || normalizeText(c.objeto).includes(alvo)
  );
}

/**
 * Responde com base em palavras-chave e nos dados reais do state.
 * Retorna { texto, dados? }.
 */
function responder(pergunta) {
  const p = normalizeText(pergunta);

  if (!p.trim()) {
    return { texto: 'Digite algo que eu possa ajudar. Por exemplo: "quantos contratos estão vencidos?"' };
  }

  // Saudações
  if (/^(oi|olá|ola|bom dia|boa tarde|boa noite|e ai|ei)/.test(p)) {
    return {
      texto: `Olá! Sou o agente do Contrata. Posso consultar contratos, fornecedores, vencimentos e anexos da base. O que você gostaria de saber?`,
      sugericoes: [
        'Quantos contratos existem?',
        'Quais contratos estão vencidos?',
        'Quem são os principais fornecedores?',
        'Como funciona a edição inline?',
      ],
    };
  }

  // Total de contratos
  if (/contratos?/.test(p) && (/quantos|total|base/.test(p) || /^quantos/.test(p))) {
    const n = totalContratos();
    const valor = formatCurrency(valorTotalBase());
    return {
      texto: `A base tem <strong>${n} contrato${n !== 1 ? 's' : ''}</strong> cadastrado${n !== 1 ? 's' : ''}, somando <strong>${valor}</strong> em valor total.`,
    };
  }

  // Situação/status dos contratos
  if (/vencid|vencendo|a vencer|próximo|proximo|vigente|rescind|renova|situação|situacao|status/.test(p)) {
    const porSit = contratosPorSituacao();
    const linhas = Object.entries(porSit)
      .map(([s, q]) => `• ${escapeHtml(s)}: <strong>${q}</strong>`)
      .join('<br>');
    return {
      texto: `Contratos por situação atual:<br>${linhas}`,
    };
  }

  // Vencidos
  if (/vencid|rescind/.test(p)) {
    const vencidos = state.contracts.filter(
      (c) => contractSituation(c).key === 'vencido' || contractSituation(c).key === 'rescindido'
    );
    if (!vencidos.length) {
      return { texto: 'Não há contratos vencidos ou rescindidos no momento.' };
    }
    const linhas = vencidos
      .map((c) => `• ${escapeHtml(c.numero)} — ${escapeHtml(c.contratada)} (${escapeHtml(c.status)})`)
      .join('<br>');
    return { texto: `Contratos vencidos/rescindidos:<br>${linhas}` };
  }

  // Situação/status dos contratos
  if (/contratos?/.test(p) && (/situação|situacao|status|por status|no total/.test(p))) {
    const porSit = contratosPorSituacao();
    const linhas = Object.entries(porSit)
      .map(([s, q]) => `• ${escapeHtml(s)}: <strong>${q}</strong>`)
      .join('<br>');
    return {
      texto: `Contratos por situação atual:<br>${linhas}`,
    };
  }

  // A vencer / vencem em breve
  if (/a vencer|vencem|vencendo|próximo|proximo|breve|prazo|vence/.test(p)) {
    const lista = proximosVencimentos(6);
    if (!lista.length) {
      return { texto: 'Não há contratos vencendo nos próximos 180 dias.' };
    }
    const linhas = lista
      .map((c) => {
        const aviso = c.dias <= 30 ? ' <span style="color:#c0392b">⚠ atenção</span>' : '';
        return `• ${escapeHtml(c.numero)} — ${escapeHtml(c.contratada)} — vence em ${formatDateBR(c.data_fim || '—')}${aviso}`;
      })
      .join('<br>');
    return { texto: `Próximos vencimentos:<br>${linhas}` };
  }

  // Fornecedores
  if (/fornecedor|contratada|empresa|parceiro/.test(p)) {
    const lista = fornecedores();
    const linhas = lista
      .slice(0, 6)
      .map((f) => `• ${escapeHtml(f.nome)} — <strong>${f.total}</strong> contrato${f.total !== 1 ? 's' : ''} (${formatCurrency(f.valor)})`)
      .join('<br>');
    return {
      texto: `Principais fornecedores:<br>${linhas}`,
    };
  }

  // Contrato específico
  const contrato = buscarContratoPorNumero(p);
  if (contrato && (/qual|detalhe|situação|situacao|status|valor|vence/.test(p) || /\bCT-\d/.test(p))) {
    const sit = contractSituation(contrato);
    return {
      texto: `
        <strong>${escapeHtml(contrato.numero)}</strong> — ${escapeHtml(contrato.objeto)}<br>
        Contratada: ${escapeHtml(contrato.contratada)}<br>
        Situação: ${escapeHtml(sit.label || contrato.status)}<br>
        Valor total: ${formatCurrency(Number(contrato.valor_total || 0))}<br>
        Vigência: ${formatDateBR(contrato.data_inicio)} até ${formatDateBR(contrato.data_fim || '—')}
      `.trim(),
    };
  }

  // Arquivos/anexos
  if (/arquiv|anexo|documento|pdf|upload|anexar/.test(p)) {
    const n = arquivosTotais();
    return {
      texto: `Existem <strong>${n}</strong> arquivo${n !== 1 ? 's' : ''} anexado${n !== 1 ? 's' : ''} na base. Você pode enviar, visualizar e excluir anexos na ficha de cada contrato ou na tela Arquivos.`,
    };
  }

  // Como usar / funcionalidades
  if (/como|funciona|usar|tutorial|ajuda|o que/.test(p)) {
    return {
      texto: `Aqui vai um resumo rápido:<br>
        • <strong>Contratos:</strong> edite qualquer célula com duplo clique (Enter salva, Esc cancela).<br>
        • <strong>Filtros:</strong> use os menus de cada coluna ou a busca global.<br>
        • <strong>Anexos:</strong> arraste arquivos na dropzone da ficha do contrato (limite 20 MB).<br>
        • <strong>Exportar:</strong> CSV ou XLSX com toda a base ou somente os filtrados.<br>
        Pergunte qualquer coisa sobre os dados da base!`,
      sugericoes: [
        'Quantos contratos existem?',
        'Quais contratos estão vencidos?',
        'Quem são os principais fornecedores?',
        'Quais contratos vencem em breve?',
      ],
    };
  }

  // Despedida
  if (/tchau|adeus|até|valeu|obrigado|obrigada/.test(p)) {
    return { texto: 'Por nada! Estou à disposição se precisar de mais informações sobre os contratos.' };
  }

  // Fallback
  return {
    texto: `Não tenho certeza de entendi. Você pode perguntar sobre quantidade de contratos, situação/vencimentos, fornecedores, anexos ou como usar o sistema.`,
    sugericoes: [
      'Quantos contratos existem?',
      'Quais contratos estão vencidos?',
      'Quem são os principais fornecedores?',
      'Quais contratos vencem em breve?',
    ],
  };
}

/* ------------------------------- render -------------------------------- */

function bubble(kind, text, html = false, tempo = null) {
  const agora = tempo || new Date();
  const hh = String(agora.getHours()).padStart(2, '0');
  const mm = String(agora.getMinutes()).padStart(2, '0');
  const classe = kind === BOT ? 'msg-bot' : 'msg-user';
  const avatar = kind === BOT ? icon('bot') : icon('person');
  const conteudo = html ? text : escapeHtml(text);
  return `
    <div class="msg ${classe}">
      <div class="msg-avatar">${avatar}</div>
      <div class="msg-bubble">${conteudo}</div>
      <div class="msg-time">${hh}:${mm}</div>
    </div>
  `;
}

function sugestaoChip(texto) {
  return `<button type="button" class="chip" data-sug="${escapeHtml(texto)}">${escapeHtml(texto)}</button>`;
}

export async function renderChat(view, { signal }) {
  view.innerHTML = `
    <section class="chat-page">
      <header class="chat-head">
        <span class="eyebrow">Assistente virtual</span>
        <h1>Agente Contrata</h1>
        <div class="chat-status"><span class="status-dot"></span> Online · modo local</div>
      </header>

      <div class="chat-wrap">
        <div class="chat-messages" id="chat-messages" role="log" aria-label="Conversa">
          ${bubble(
            BOT,
            'Olá! Sou o agente do Contrata. Pergunte sobre contratos, fornecedores, vencimentos ou anexos. Como posso ajudar?',
            false
          )}
        </div>

        <div class="chat-quick" id="chat-quick">
          ${['Quantos contratos existem?', 'Quais contratos estão vencidos?', 'Quem são os principais fornecedores?', 'Quais contratos vencem em breve?'].map(sugestaoChip).join('')}
        </div>

        <form class="chat-form" id="chat-form" novalidate>
          <div class="chat-input-wrap">
            <input type="text" id="chat-input" placeholder="Digite sua pergunta…" autocomplete="off" spellcheck="false">
            <button type="submit" class="btn btn-primary btn-sm" id="chat-send">${icon('send')} Enviar</button>
          </div>
          <div class="chat-error" id="chat-error" role="alert" hidden></div>
        </form>
      </div>
    </section>
  `;

  const messages = view.querySelector('#chat-messages');
  const input = view.querySelector('#chat-input');
  const form = view.querySelector('#chat-form');
  const quick = view.querySelector('#chat-quick');
  const error = view.querySelector('#chat-error');

  function scrollBottom() {
    messages.scrollTop = messages.scrollHeight;
  }

  function adicionarMensagem(kind, texto, html = false) {
    messages.insertAdjacentHTML('beforeend', bubble(kind, texto, html));
    scrollBottom();
  }

  function mostrarSugestoes(texto) {
    if (!texto) {
      quick.hidden = true;
      return;
    }
    const resposta = responder(texto);
    const chips = (resposta.sugericoes || [])
      .map(sugestaoChip)
      .join('');
    quick.innerHTML = chips;
    quick.hidden = !chips;
    return resposta;
  }

  async function enviar(texto) {
    if (!texto.trim()) return;
    input.disabled = true;
    document.getElementById('chat-send').disabled = true;
    error.hidden = true;

    adicionarMensagem(USER, texto);
    input.value = '';

    // "digitando" do bot
    const typing = document.createElement('div');
    typing.className = 'msg typing-bot';
    typing.innerHTML = `
      <div class="msg-avatar">${icon('bot')}</div>
      <div class="msg-bubble"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>
    `;
    messages.appendChild(typing);
    scrollBottom();

    try {
      await new Promise((r) => setTimeout(r, 700));
      typing.remove();

      const resposta = responder(texto);
      adicionarMensagem(BOT, resposta.texto, true);
      mostrarSugestoes(texto);
    } catch (e) {
      typing.remove();
      adicionarMensagem(BOT, 'Desculpe, houve um erro ao processar sua pergunta. Tente novamente.');
      error.textContent = escapeHtml(e.message || 'Erro inesperado.');
      error.hidden = false;
      console.error(e);
    } finally {
      input.disabled = false;
      document.getElementById('chat-send').disabled = false;
      input.focus();
    }
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    enviar(input.value);
  });

  input.addEventListener('input', () => {
    const sugestao = mostrarSugestoes(input.value);
    if (sugestao) {
      // chips renderizados por mostrarSugestoes
    }
  });

  quick.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-sug]');
    if (!btn) return;
    enviar(btn.dataset.sug);
  });

  scrollBottom();

  return () => {
    form.removeEventListener('submit', enviar);
    quick.removeEventListener('click', enviar);
  };
}
