/**
 * Camada de persistência local do servidor.
 * Mantém o banco em memória e grava data/db.json de forma atômica e serializada.
 * Em produção este arquivo deixa de existir: os dados vão para o Supabase.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const DB_PATH = path.join(DATA_DIR, 'db.json');
export const STORAGE_DIR = path.join(ROOT_DIR, 'storage');
export const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');

let cache = null;
let writeChain = Promise.resolve();

/** Carrega o JSON para a memória. Cria um banco vazio se ainda não existir. */
export async function initDb() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  try {
    const raw = await fs.readFile(DB_PATH, 'utf8');
    cache = JSON.parse(raw);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    cache = {
      meta: { nextContractId: 1, nextFileId: 1 },
      users: [],
      contracts: [],
      files: [],
    };
    await persist();
  }

  cache.users ??= [];
  cache.contracts ??= [];
  cache.files ??= [];
  cache.meta ??= {};
  cache.meta.nextContractId ??= maxId(cache.contracts) + 1;
  cache.meta.nextFileId ??= maxId(cache.files) + 1;
  return cache;
}

/** Acesso síncrono ao banco já carregado. */
export function db() {
  if (!cache) throw new Error('Banco de dados não inicializado.');
  return cache;
}

/** Grava um snapshot do banco. Escritas são enfileiradas para evitar corrupção. */
export function persist() {
  if (!cache) return Promise.resolve();
  const snapshot = `${JSON.stringify(cache, null, 2)}\n`;
  writeChain = writeChain
    .catch(() => {})
    .then(() => writeAtomic(DB_PATH, snapshot));
  return writeChain;
}

async function writeAtomic(target, content) {
  const temp = `${target}.${process.pid}.tmp`;
  await fs.writeFile(temp, content, 'utf8');
  await fs.rename(temp, target);
}

function maxId(items) {
  return items.reduce((max, item) => Math.max(max, Number(item.id) || 0), 0);
}

/** Reserva o próximo ID de uma coleção e avança o contador do meta. */
export function reserveId(collection) {
  const key = collection === 'contracts' ? 'nextContractId' : 'nextFileId';
  const items = db()[collection];
  const id = Math.max(Number(db().meta[key]) || 1, maxId(items) + 1);
  db().meta[key] = id + 1;
  return id;
}
