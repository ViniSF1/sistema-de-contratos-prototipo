/** Utilitários de formatação, datas, arquivos e pequenos helpers de UI. */
import { parseDecimalBR } from './shared/catalog.js';

export const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

export const numberFormatter = new Intl.NumberFormat('pt-BR');

export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/**
 * Compara identificadores de forma opaca.
 * IDs podem ser numéricos (JSON local) ou UUID (Supabase); nunca converta para Number.
 */
export function sameId(a, b) {
  if (a == null || b == null) return false;
  return String(a) === String(b);
}

export function formatCurrency(value) {
  const number = Number(value);
  return currencyFormatter.format(Number.isFinite(number) ? number : 0);
}

export function formatNumber(value) {
  const number = Number(value);
  return numberFormatter.format(Number.isFinite(number) ? number : 0);
}

/** Converte "2026-10-30" em Date local (sem deslocamento de fuso). */
export function parseDateOnly(value) {
  if (!value) return null;
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

export function formatDateBR(value) {
  if (!value) return '';
  const text = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    const [year, month, day] = text.split('-');
    return `${day}/${month}/${year}`;
  }
  return text;
}

export function formatDateTimeBR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function todayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function addYearsISO(iso, years = 1) {
  const date = parseDateOnly(iso) || new Date();
  date.setFullYear(date.getFullYear() + years);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Dias entre hoje e a data (negativo = passado). */
export function daysUntil(value) {
  const target = parseDateOnly(value);
  if (!target) return 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86400000);
}

export const SITUATIONS = {
  vigente: { key: 'vigente', label: 'Vigente', color: '#15803D' },
  a_vencer: { key: 'a_vencer', label: 'A vencer', color: '#B45309' },
  vencido: { key: 'vencido', label: 'Vencido', color: '#B91C1C' },
  renovacao: { key: 'renovacao', label: 'Em renovação', color: '#1D4ED8' },
  rescindido: { key: 'rescindido', label: 'Rescindido', color: '#4B5563' },
};

/**
 * Situação visual do contrato.
 * Rescindido/Em renovação prevalecem; os demais são calculados pela data de fim,
 * garantindo que alertas de vencimento reflitam a realidade mesmo após editar datas.
 */
export function contractSituation(contract) {
  if (contract?.status === 'Rescindido') return SITUATIONS.rescindido;
  if (contract?.status === 'Em renovação') return SITUATIONS.renovacao;
  if (!contract?.data_fim) return SITUATIONS.vigente;
  const days = daysUntil(contract.data_fim);
  if (days < 0) return SITUATIONS.vencido;
  if (days <= 60) return SITUATIONS.a_vencer;
  return SITUATIONS.vigente;
}

export function daysLabel(days) {
  if (days === 0) return 'vence hoje';
  if (days === 1) return 'vence amanhã';
  if (days > 1) return `vence em ${days} dias`;
  if (days === -1) return 'venceu ontem';
  return `venceu há ${Math.abs(days)} dias`;
}

/** Mesmo parser usado no servidor (módulo compartilhado). */
export function parseMoney(value) {
  return parseDecimalBR(value);
}

export function formatMoneyInput(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  return number.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function debounce(fn, wait = 220) {
  let timer = null;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), wait);
  };
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function formatFileSize(bytes) {
  const size = Number(bytes) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace('.', ',')} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

export function fileExtension(name = '') {
  const parts = String(name).split('.');
  return parts.length > 1 ? `.${parts.pop().toLowerCase()}` : '';
}

export function isPdfFile(file) {
  const mime = String(file?.tipo || '');
  return mime.includes('pdf') || fileExtension(file?.nome_original) === '.pdf';
}

export function isImageFile(file) {
  const mime = String(file?.tipo || '');
  return mime.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(fileExtension(file?.nome_original));
}

export function contractSearchText(contract) {
  return normalizeText(
    [
      contract.numero,
      contract.objeto,
      contract.contratada,
      contract.cnpj,
      contract.tipo,
      contract.setor_responsavel,
      contract.gestor,
      contract.status,
      contract.forma_reajuste,
      contract.indice_reajuste,
      contract.observacoes,
      formatCurrency(contract.valor_total),
      formatCurrency(contract.valor_mensal),
      formatDateBR(contract.data_inicio),
      formatDateBR(contract.data_fim),
    ].join(' '),
  );
}

export function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'AD';
  return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
}

export function sumBy(items, getter) {
  return items.reduce((total, item) => total + Number(getter(item) || 0), 0);
}

export function pluralize(count, singular, plural) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export function truncate(text, size = 80) {
  const value = String(text ?? '');
  return value.length > size ? `${value.slice(0, size - 1)}…` : value;
}

export function statusFromStored(status, dataFim) {
  if (status === 'Rescindido' || status === 'Em renovação') return status;
  const days = daysUntil(dataFim);
  if (days < 0) return 'Vencido';
  if (days <= 60) return 'A vencer';
  return 'Vigente';
}
