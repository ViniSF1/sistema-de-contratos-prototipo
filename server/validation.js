/**
 * Validações e normalização dos contratos no servidor.
 *
 * Listas, limites e formatos vêm do módulo compartilhado
 * (public/js/shared/catalog.js), também usado pelo front-end.
 */
import {
  STATUS_OPTIONS,
  TIPO_OPTIONS,
  CONTRACT_TEXT_LIMITS,
  isValidISODate,
  parseDecimalBR,
} from '../public/js/shared/catalog.js';

export { STATUS_OPTIONS, TIPO_OPTIONS };

export const CONTRACT_FIELDS = [
  'numero',
  'objeto',
  'contratada',
  'cnpj',
  'tipo',
  'setor_responsavel',
  'gestor',
  'valor_total',
  'valor_mensal',
  'data_assinatura',
  'data_inicio',
  'data_fim',
  'status',
  'forma_reajuste',
  'indice_reajuste',
  'observacoes',
];

const LIMITS = CONTRACT_TEXT_LIMITS;

/** Converte "1.234,56", "1234,56" ou 1234.56 em número (vazio vira 0). */
export function parseNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return 0;
  return parseDecimalBR(value);
}

/** Compatibilidade: mesma regra do módulo compartilhado. */
export function isValidDate(value) {
  return isValidISODate(value);
}

/** Normaliza o texto (trim + limite) para evitar lixo no banco. */
function text(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

/**
 * Mescla os campos editáveis em uma base (contrato existente ou vazio) e valida tudo.
 * Retorna { values, errors } — errors é um objeto campo -> mensagem.
 */
export function validateContract(input, existing = null, contracts = []) {
  const base = existing
    ? { ...existing }
    : {
        numero: '',
        objeto: '',
        contratada: '',
        cnpj: '',
        tipo: 'Prestação de Serviços',
        setor_responsavel: '',
        gestor: '',
        valor_total: 0,
        valor_mensal: 0,
        data_assinatura: '',
        data_inicio: '',
        data_fim: '',
        status: 'Vigente',
        forma_reajuste: 'Anual',
        indice_reajuste: 'IPCA',
        observacoes: '',
      };

  for (const field of CONTRACT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      base[field] = input[field];
    }
  }

  const values = { ...base };
  const errors = {};

  for (const field of [
    'numero',
    'objeto',
    'contratada',
    'cnpj',
    'setor_responsavel',
    'gestor',
    'forma_reajuste',
    'indice_reajuste',
    'observacoes',
  ]) {
    values[field] = text(values[field], LIMITS[field]);
  }

  values.tipo = text(values.tipo, 80);
  values.status = text(values.status, 40);
  values.valor_total = parseNumber(values.valor_total);
  values.valor_mensal = parseNumber(values.valor_mensal);
  values.data_assinatura = text(values.data_assinatura, 10);
  values.data_inicio = text(values.data_inicio, 10);
  values.data_fim = text(values.data_fim, 10);

  if (!values.numero) {
    errors.numero = 'Informe o número do contrato.';
  } else {
    const normalized = values.numero.toLocaleLowerCase('pt-BR');
    const duplicate = contracts.some(
      (item) =>
        item.id !== existing?.id &&
        String(item.numero ?? '').trim().toLocaleLowerCase('pt-BR') === normalized,
    );
    if (duplicate) errors.numero = 'Já existe um contrato com este número.';
  }

  if (!values.objeto) errors.objeto = 'Informe o objeto do contrato.';
  if (!values.contratada) errors.contratada = 'Informe a razão social da contratada.';

  if (!TIPO_OPTIONS.includes(values.tipo)) {
    errors.tipo = 'Selecione um tipo de contrato válido.';
  }
  if (!STATUS_OPTIONS.includes(values.status)) {
    errors.status = 'Selecione um status válido.';
  }

  if (!Number.isFinite(values.valor_total) || values.valor_total < 0) {
    errors.valor_total = 'O valor total deve ser um número maior ou igual a zero.';
  }
  if (!Number.isFinite(values.valor_mensal) || values.valor_mensal < 0) {
    errors.valor_mensal = 'O valor mensal deve ser um número maior ou igual a zero.';
  }

  if (values.data_assinatura && !isValidDate(values.data_assinatura)) {
    errors.data_assinatura = 'Data de assinatura inválida.';
  }
  if (!isValidDate(values.data_inicio)) {
    errors.data_inicio = 'Informe uma data de início válida.';
  }
  if (!isValidDate(values.data_fim)) {
    errors.data_fim = 'Informe uma data de fim válida.';
  }
  if (
    isValidDate(values.data_inicio) &&
    isValidDate(values.data_fim) &&
    values.data_fim < values.data_inicio
  ) {
    errors.data_fim = 'A data de fim deve ser igual ou posterior à data de início.';
  }

  return { values, errors };
}

/** Gera um número sequencial único, usado quando a nova linha é criada vazia. */
export function generateContractNumber(contracts) {
  const year = new Date().getFullYear();
  const used = new Set(contracts.map((item) => String(item.numero).toUpperCase()));
  let sequence = 1;
  let candidate = '';
  do {
    candidate = `CT-${year}-${String(sequence).padStart(3, '0')}`;
    sequence += 1;
  } while (used.has(candidate.toUpperCase()));
  return candidate;
}
