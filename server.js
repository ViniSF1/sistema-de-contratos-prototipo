/**
 * Servidor local do sistema de contratos.
 * - API REST para login, contratos, arquivos e exportação
 * - Serve o front-end estático em /public
 * - Persiste em data/db.json e storage/uploads
 *
 * Em produção, estas rotas serão substituídas pelo Supabase (ver README e adapter do front-end).
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import { initDb, db, persist, reserveId, ROOT_DIR } from './server/db.js';
import {
  createSession,
  destroySession,
  getSession,
  publicUser,
  requireAuth,
  tokenFromRequest,
  verifyPassword,
} from './server/auth.js';
import {
  buildStoredName,
  CATEGORIAS,
  ensureContractDir,
  extensionOf,
  isPreviewable,
  MAX_FILE_BYTES,
  mimeOf,
  removeContractFolder,
  resolveStoredFile,
  safeOriginalName,
  validateUpload,
} from './server/files.js';
import {
  buildCsv,
  buildXlsx,
  exportDateStamp,
} from './server/export.js';
import {
  generateContractNumber,
  validateContract,
} from './server/validation.js';

const PORT = Number(process.env.PORT) || 3000;
const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
const MAX_LOGIN_ATTEMPTS = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

const app = express();
const loginAttempts = new Map();

app.disable('x-powered-by');
app.use(
  cors({
    origin: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
);
app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'same-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  next();
});

app.use('/api', (_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});

/* ------------------------------------------------------------------ */
/* Autenticação                                                        */
/* ------------------------------------------------------------------ */

app.post('/api/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'desconhecido';
  if (isRateLimited(ip)) {
    return res.status(429).json({
      erro: 'Muitas tentativas de login. Aguarde alguns minutos e tente novamente.',
    });
  }

  const usuario = String(req.body?.usuario ?? '').trim();
  const senha = String(req.body?.senha ?? '');
  if (!usuario || !senha) {
    return res.status(400).json({ erro: 'Informe usuário e senha.' });
  }

  const user = db().users.find(
    (item) => String(item.usuario).toLowerCase() === usuario.toLowerCase(),
  );

  // Comparação em tempo constante; a senha nunca é enviada nem validada no front-end.
  if (!user || !verifyPassword(user, senha)) {
    registerFailedLogin(ip);
    return res.status(401).json({ erro: 'Usuário ou senha inválidos.' });
  }

  loginAttempts.delete(ip);
  const token = createSession(user);
  res.json({ token, usuario: publicUser(user) });
});

app.post('/api/logout', requireAuth, (req, res) => {
  destroySession(req.token);
  res.json({ ok: true });
});

app.get('/api/session', (req, res) => {
  const session = getSession(tokenFromRequest(req));
  if (!session) {
    return res.status(401).json({ erro: 'Sessão inválida ou expirada.' });
  }
  const user = db().users.find((item) => item.id === session.userId);
  if (!user) return res.status(401).json({ erro: 'Sessão inválida.' });
  res.json({ usuario: publicUser(user) });
});

/* ------------------------------------------------------------------ */
/* Contratos                                                           */
/* ------------------------------------------------------------------ */

app.get('/api/contracts', requireAuth, (_req, res) => {
  res.json(db().contracts);
});

app.get('/api/contracts/:id', requireAuth, (req, res) => {
  const contract = findContract(req.params.id);
  if (!contract) return res.status(404).json({ erro: 'Contrato não encontrado.' });
  res.json(contract);
});

app.post('/api/contracts', requireAuth, async (req, res, next) => {
  try {
    const payload = { ...req.body };
    if (!String(payload.numero ?? '').trim()) {
      payload.numero = generateContractNumber(db().contracts);
    }

    const { values, errors } = validateContract(payload, null, db().contracts);
    if (Object.keys(errors).length) {
      return res.status(422).json({ erro: 'Verifique os campos destacados.', campos: errors });
    }

    const now = new Date().toISOString();
    const contract = {
      id: reserveId('contracts'),
      ...values,
      criado_em: now,
      atualizado_em: now,
    };
    db().contracts.push(contract);
    await persist();
    res.status(201).json(contract);
  } catch (error) {
    next(error);
  }
});

app.patch('/api/contracts/:id', requireAuth, async (req, res, next) => {
  try {
    const contract = findContract(req.params.id);
    if (!contract) return res.status(404).json({ erro: 'Contrato não encontrado.' });

    const { values, errors } = validateContract(req.body ?? {}, contract, db().contracts);
    if (Object.keys(errors).length) {
      return res.status(422).json({ erro: 'Verifique os campos destacados.', campos: errors });
    }

    Object.assign(contract, values, { atualizado_em: new Date().toISOString() });
    await persist();
    res.json(contract);
  } catch (error) {
    next(error);
  }
});

app.delete('/api/contracts/:id', requireAuth, async (req, res, next) => {
  try {
    const contract = findContract(req.params.id);
    if (!contract) return res.status(404).json({ erro: 'Contrato não encontrado.' });

    const related = db().files.filter((file) => file.contrato_id === contract.id);
    db().files = db().files.filter((file) => file.contrato_id !== contract.id);
    db().contracts = db().contracts.filter((item) => item.id !== contract.id);
    await removeContractFolder(contract.id);
    await persist();
    res.json({ ok: true, arquivosRemovidos: related.length });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Arquivos                                                            */
/* ------------------------------------------------------------------ */

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES, files: 1 },
});

function receiveFile(req, res, next) {
  upload.single('arquivo')(req, res, (error) => {
    if (!error) return next();
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ erro: 'O arquivo excede o limite de 20 MB.' });
    }
    return res.status(400).json({ erro: 'Não foi possível receber o arquivo.', detalhe: error.message });
  });
}

app.get('/api/files', requireAuth, (_req, res) => {
  res.json(db().files);
});

app.post('/api/files', requireAuth, receiveFile, async (req, res, next) => {
  try {
    const contractId = Number(req.body?.contrato_id);
    const contract = db().contracts.find((item) => item.id === contractId);
    if (!contract) {
      return res.status(422).json({ erro: 'Selecione um contrato válido para o anexo.' });
    }

    const categoria = String(req.body?.categoria ?? '').trim();
    if (!CATEGORIAS.includes(categoria)) {
      return res.status(422).json({ erro: 'Selecione uma categoria válida.' });
    }

    const validationError = validateUpload(req.file);
    if (validationError) return res.status(422).json({ erro: validationError });

    const nomeOriginal = safeOriginalName(req.file.originalname);
    const extensao = extensionOf(nomeOriginal);
    if (!extensao) return res.status(422).json({ erro: 'Arquivo sem extensão.' });

    const nomeSalvo = buildStoredName(nomeOriginal);
    const directory = await ensureContractDir(contract.id);
    const destination = path.join(directory, nomeSalvo);
    await fs.writeFile(destination, req.file.buffer);

    const metadata = {
      id: reserveId('files'),
      contrato_id: contract.id,
      nome_original: nomeOriginal,
      nome_salvo: nomeSalvo,
      tipo: mimeOf(nomeOriginal, req.file.mimetype),
      tamanho: req.file.size,
      categoria,
      enviado_em: new Date().toISOString(),
    };
    db().files.push(metadata);
    await persist();
    res.status(201).json(metadata);
  } catch (error) {
    next(error);
  }
});

app.get('/api/files/:id/download', requireAuth, async (req, res, next) => {
  try {
    const file = findFile(req.params.id);
    if (!file) return res.status(404).json({ erro: 'Arquivo não encontrado.' });
    const fullPath = resolveStoredFile(file.contrato_id, file.nome_salvo);
    await fs.access(fullPath);
    res.download(fullPath, file.nome_original);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ erro: 'Arquivo físico não encontrado no storage.' });
    }
    next(error);
  }
});

app.get('/api/files/:id/view', requireAuth, async (req, res, next) => {
  try {
    const file = findFile(req.params.id);
    if (!file) return res.status(404).json({ erro: 'Arquivo não encontrado.' });
    const fullPath = resolveStoredFile(file.contrato_id, file.nome_salvo);
    await fs.access(fullPath);

    if (!isPreviewable(file.nome_original)) {
      return res.download(fullPath, file.nome_original);
    }

    const fallback = file.nome_original.replace(/[^\x20-\x7E]/g, '_').replace(/["\\]/g, '_');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(file.nome_original)}`,
    );
    res.sendFile(fullPath);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return res.status(404).json({ erro: 'Arquivo físico não encontrado no storage.' });
    }
    next(error);
  }
});

app.delete('/api/files/:id', requireAuth, async (req, res, next) => {
  try {
    const file = findFile(req.params.id);
    if (!file) return res.status(404).json({ erro: 'Arquivo não encontrado.' });

    const fullPath = resolveStoredFile(file.contrato_id, file.nome_salvo);
    await fs.unlink(fullPath).catch((error) => {
      if (error.code !== 'ENOENT') throw error;
    });
    db().files = db().files.filter((item) => item.id !== file.id);
    await persist();
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Exportação                                                          */
/* ------------------------------------------------------------------ */

app.get('/api/export', requireAuth, (req, res, next) => {
  try {
    const format = String(req.query.formato || 'xlsx').toLowerCase();
    if (!['csv', 'xlsx'].includes(format)) {
      return res.status(400).json({ erro: 'Formato inválido. Use csv ou xlsx.' });
    }

    const scope = String(req.query.escopo || 'all');
    const rawIds = String(req.query.ids || '')
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0);
    const idSet = new Set(rawIds);

    let contracts = [...db().contracts];
    if (scope === 'filtered') {
      if (!rawIds.length) {
        return res.status(422).json({ erro: 'Nenhum contrato filtrado para exportar.' });
      }
      contracts = contracts.filter((contract) => idSet.has(contract.id));
    }

    contracts.sort((a, b) => String(a.numero).localeCompare(String(b.numero), 'pt-BR'));
    const contractsIds = new Set(contracts.map((contract) => contract.id));
    const files = db().files.filter((file) => contractsIds.has(file.contrato_id));

    const stamp = exportDateStamp();
    const filename = `contratos_${stamp}.${format}`;

    if (format === 'csv') {
      const csv = buildCsv(contracts);
      const buffer = Buffer.from(`\uFEFF${csv}`, 'utf8');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      return res.send(buffer);
    }

    const buffer = buildXlsx(contracts, files);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

/* ------------------------------------------------------------------ */
/* Saúde, estáticos e erros                                            */
/* ------------------------------------------------------------------ */

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, modo: 'json', contratos: db().contracts.length, arquivos: db().files.length });
});

app.use(
  express.static(PUBLIC_DIR, {
    index: 'index.html',
    extensions: ['html'],
    maxAge: 0,
  }),
);

app.get('/login', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'login.html')));

app.use('/api', (_req, res) => {
  res.status(404).json({ erro: 'Rota da API não encontrada.' });
});

app.use((error, req, res, _next) => {
  console.error('[api]', error);
  if (res.headersSent) return;
  res.status(500).json({ erro: 'Erro interno do servidor.', detalhe: error.message });
});

/* ------------------------------------------------------------------ */
/* Utilitários                                                         */
/* ------------------------------------------------------------------ */

function findContract(id) {
  const numericId = Number(id);
  return db().contracts.find((item) => item.id === numericId) || null;
}

function findFile(id) {
  const numericId = Number(id);
  return db().files.find((item) => item.id === numericId) || null;
}

function isRateLimited(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.delete(ip);
    return false;
  }
  return entry.count >= MAX_LOGIN_ATTEMPTS;
}

function registerFailedLogin(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || Date.now() - entry.firstAt > LOGIN_WINDOW_MS) {
    loginAttempts.set(ip, { count: 1, firstAt: Date.now() });
    return;
  }
  entry.count += 1;
}

/* ------------------------------------------------------------------ */
/* Inicialização                                                       */
/* ------------------------------------------------------------------ */

await initDb();
app.listen(PORT, () => {
  console.log('');
  console.log('  Contrata · Gestão de Contratos');
  console.log(`  Servidor local: http://localhost:${PORT}`);
  console.log(`  Banco local:    data/db.json`);
  console.log(`  Modo de dados:  JSON (troque ADAPTER em public/js/config.js para usar Supabase)`);
  console.log('');
});
