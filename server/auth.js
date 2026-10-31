/**
 * Autenticação local (desenvolvimento).
 *
 * ATENÇÃO: este login é apenas para o modo JSON local.
 * Em produção, TROCAR POR SUPABASE AUTH: o front-end usará supabase.auth.signInWithPassword,
 * as sessões serão JWT do Supabase e a tabela `users`/senha local deixará de ser usada.
 */
import crypto from 'node:crypto';
import { db } from './db.js';

const SESSION_TTL_MS = 8 * 60 * 60 * 1000; // 8 horas
const sessions = new Map();

/** Gera o hash scrypt de uma senha (usado pelo seed e por testes). */
export function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash };
}

/** Comparação em tempo constante entre a senha digitada e o hash salvo. */
export function verifyPassword(user, password) {
  if (!user?.senha_hash || !user?.salt || typeof password !== 'string') return false;
  const saved = Buffer.from(user.senha_hash, 'hex');
  const test = crypto.scryptSync(password, user.salt, 64);
  return saved.length === test.length && crypto.timingSafeEqual(saved, test);
}

export function createSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, {
    userId: user.id,
    usuario: user.usuario,
    nome: user.nome,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  cleanupSessions();
  return token;
}

export function destroySession(token) {
  if (token) sessions.delete(token);
}

export function getSession(token) {
  if (!token) return null;
  const session = sessions.get(token);
  if (!session) return null;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return null;
  }
  return session;
}

/** Token aceito no header Authorization ou na query (necessário para iframes de PDF/imagem). */
export function tokenFromRequest(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  if (typeof req.query?.token === 'string') return req.query.token;
  return '';
}

export function requireAuth(req, res, next) {
  const token = tokenFromRequest(req);
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada. Faça login novamente.' });
  }
  const user = db().users.find((item) => item.id === session.userId);
  if (!user) {
    sessions.delete(token);
    return res.status(401).json({ erro: 'Usuário não encontrado. Faça login novamente.' });
  }
  req.user = user;
  req.session = session;
  req.token = token;
  next();
}

/** Usuário seguro para enviar ao front-end (nunca inclui hash/salt). */
export function publicUser(user) {
  return {
    id: user.id,
    usuario: user.usuario,
    nome: user.nome,
    perfil: user.perfil,
  };
}

function cleanupSessions() {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (session.expiresAt < now) sessions.delete(token);
  }
}

// Limpeza periódica sem impedir o encerramento do processo.
setInterval(cleanupSessions, 30 * 60 * 1000).unref();
