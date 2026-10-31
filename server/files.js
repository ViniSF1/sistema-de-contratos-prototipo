/**
 * Regras de segurança e organização dos anexos.
 * Em produção, os bytes vão para o bucket `contract-files` do Supabase Storage.
 *
 * Listas e limites vêm do módulo compartilhado (public/js/shared/catalog.js),
 * os mesmos usados pelo front-end.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { UPLOADS_DIR } from './db.js';
import {
  FILE_CATEGORIES,
  MAX_FILE_BYTES,
  ALLOWED_FILE_EXTENSIONS,
  DANGEROUS_FILE_EXTENSIONS,
} from '../public/js/shared/catalog.js';

export { MAX_FILE_BYTES };

export const CATEGORIAS = FILE_CATEGORIES;

const EXTENSOES_PERMITIDAS = new Set(ALLOWED_FILE_EXTENSIONS);

// Bloqueio explícito (defesa em profundidade, além da lista permitida).
const EXTENSOES_BLOQUEADAS = new Set(DANGEROUS_FILE_EXTENSIONS);

const MIME_POR_EXTENSAO = {
  '.pdf': 'application/pdf',
  '.doc': 'application/msword',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.xls': 'application/vnd.ms-excel',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.ppt': 'application/vnd.ms-powerpoint',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.bmp': 'image/bmp',
};

export function extensionOf(name = '') {
  return path.extname(String(name)).toLowerCase();
}

/** Remove diretórios e caracteres de controle do nome original recebido. */
export function safeOriginalName(name) {
  let base = path.basename(String(name || 'arquivo'));
  // Multer/browsers antigos podem enviar UTF-8 interpretado como latin1.
  if (/[\u00c2\u00c3]/.test(base)) {
    try {
      const decoded = Buffer.from(base, 'latin1').toString('utf8');
      if (!decoded.includes('\uFFFD')) base = decoded;
    } catch {
      /* mantém o nome original */
    }
  }
  base = base.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return base.slice(0, 180) || 'arquivo';
}

/** Nome físico seguro: sem acentos, sem espaços, com prefixo único. */
export function buildStoredName(originalName) {
  const extension = extensionOf(originalName);
  const withoutExtension = originalName.slice(0, originalName.length - extension.length);
  const base = withoutExtension
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80) || 'arquivo';
  const unique = `${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
  return `${unique}-${base}${extension}`;
}

/** Valida presença, tamanho e extensão do arquivo. */
export function validateUpload(file) {
  if (!file || !file.buffer) return 'Selecione um arquivo para enviar.';
  if (file.size === 0) return 'O arquivo está vazio.';
  if (file.size > MAX_FILE_BYTES) return 'O arquivo excede o limite de 20 MB.';

  const extension = extensionOf(file.originalname);
  if (!extension) return 'O arquivo precisa ter uma extensão.';
  if (EXTENSOES_BLOQUEADAS.has(extension) || !EXTENSOES_PERMITIDAS.has(extension)) {
    return `Extensão ${extension} não permitida. Envie PDF, DOCX, XLSX, imagens ou arquivos de texto.`;
  }
  return '';
}

export function mimeOf(fileName, fallback = 'application/octet-stream') {
  return MIME_POR_EXTENSAO[extensionOf(fileName)] || fallback;
}

export function isPreviewable(fileName) {
  const mime = mimeOf(fileName);
  return mime === 'application/pdf' || mime.startsWith('image/');
}

export function contractUploadDir(contractId) {
  if (!/^\d+$/.test(String(contractId))) throw new Error('ID de contrato inválido.');
  return path.join(UPLOADS_DIR, String(contractId));
}

export async function ensureContractDir(contractId) {
  const dir = contractUploadDir(contractId);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

/** Resolve o caminho e garante que ele continua dentro de storage/uploads. */
export function resolveStoredFile(contractId, storedName) {
  const dir = contractUploadDir(contractId);
  const fullPath = path.resolve(dir, path.basename(storedName));
  const uploadsRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!fullPath.startsWith(uploadsRoot)) {
    throw new Error('Caminho de arquivo inválido.');
  }
  return fullPath;
}

export async function removeContractFolder(contractId) {
  const dir = path.resolve(contractUploadDir(contractId));
  const uploadsRoot = path.resolve(UPLOADS_DIR) + path.sep;
  if (!dir.startsWith(uploadsRoot)) throw new Error('Caminho inválido.');
  await fs.rm(dir, { recursive: true, force: true });
}
