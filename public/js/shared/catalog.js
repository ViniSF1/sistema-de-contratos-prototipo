/**
 * Catálogo compartilhado entre o front-end (browser) e o back-end (Node).
 *
 * Fonte única de verdade para listas, limites e validadores puros.
 * Importado por:
 *   - public/js/constants.js        (front, via re-export)
 *   - server/validation.js          (Node, via caminho relativo)
 *   - server/files.js               (Node, via caminho relativo)
 *
 * Mantenha este arquivo sem dependências e sem acesso a DOM/Node APIs.
 */

/* ------------------------------- Contratos ------------------------------- */

export const STATUS_OPTIONS = [
  'Vigente',
  'A vencer',
  'Vencido',
  'Rescindido',
  'Em renovação',
];

export const TIPO_OPTIONS = [
  'Prestação de Serviços',
  'Locação',
  'Fornecimento',
  'Manutenção',
  'TI',
  'Consultoria',
  'Outros',
];

/** Limite de caracteres por campo de texto do contrato. */
export const CONTRACT_TEXT_LIMITS = {
  numero: 60,
  objeto: 500,
  contratada: 200,
  cnpj: 24,
  setor_responsavel: 120,
  gestor: 120,
  forma_reajuste: 120,
  indice_reajuste: 40,
  observacoes: 2000,
};

/* -------------------------------- Arquivos ------------------------------- */

export const FILE_CATEGORIES = [
  'Contrato original',
  'Aditivo',
  'Anexo',
  'Nota fiscal',
  'Outros',
];

export const MAX_FILE_MB = 20;
export const MAX_FILE_BYTES = MAX_FILE_MB * 1024 * 1024;

/** Extensões aceitas no upload (minúsculas, com ponto). */
export const ALLOWED_FILE_EXTENSIONS = [
  '.pdf',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.txt',
  '.csv',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.bmp',
];

/** Extensões executáveis/script bloqueadas explicitamente. */
export const DANGEROUS_FILE_EXTENSIONS = [
  '.exe',
  '.bat',
  '.cmd',
  '.com',
  '.msi',
  '.scr',
  '.ps1',
  '.sh',
  '.js',
  '.mjs',
  '.cjs',
  '.vbs',
  '.jsx',
  '.jsp',
  '.php',
  '.py',
  '.rb',
  '.pl',
  '.jar',
  '.dll',
  '.so',
  '.dylib',
  '.html',
  '.htm',
  '.svg',
];

/* ------------------------- Validadores de formato ------------------------ */

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** True somente para "YYYY-MM-DD" que representa uma data real do calendário. */
export function isValidISODate(value) {
  const text = String(value ?? '').slice(0, 10);
  if (!ISO_DATE_PATTERN.test(text)) return false;
  const [year, month, day] = text.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

/**
 * Converte "1.234,56", "1234,56" ou 1234.56 em número.
 * Retorna NaN para valores vazios/ inválidos (quem consome decide o fallback).
 */
export function parseDecimalBR(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  if (value === null || value === undefined) return NaN;
  let text = String(value).trim().replace(/[R$\s]/g, '');
  if (!text) return NaN;
  if (text.includes(',')) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    text = text.replace(/\./g, '');
  }
  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : NaN;
}
