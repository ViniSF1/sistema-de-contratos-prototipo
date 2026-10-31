/** Hash scrypt e ciclo de vida das sessões locais. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSession,
  destroySession,
  getSession,
  hashPassword,
  publicUser,
  verifyPassword,
} from '../server/auth.js';

test('hashPassword + verifyPassword (roundtrip)', () => {
  const { salt, hash } = hashPassword('admin123');
  const user = { id: 1, usuario: 'admin', salt, senha_hash: hash };
  assert.ok(verifyPassword(user, 'admin123'));
  assert.equal(verifyPassword(user, 'outra-senha'), false);
  assert.equal(verifyPassword(user, ''), false);
});

test('verifyPassword rejeita usuário sem hash ou sem salt', () => {
  assert.equal(verifyPassword({}, 'x'), false);
  assert.equal(verifyPassword(null, 'x'), false);
  assert.equal(verifyPassword({ senha_hash: 'aa' }, 'x'), false);
});

test('hash com salt próprio é determinístico', () => {
  const a = hashPassword('segredo', 'salt-fixo');
  const b = hashPassword('segredo', 'salt-fixo');
  assert.deepEqual(a, b);
  assert.notDeepEqual(hashPassword('segredo'), hashPassword('segredo'));
});

test('sessões: criar, recuperar e destruir', () => {
  const user = { id: 1, usuario: 'admin', nome: 'Administrador' };
  const token = createSession(user);
  assert.match(token, /^[a-f0-9]{64}$/);

  const sessao = getSession(token);
  assert.equal(sessao.userId, 1);
  assert.ok(sessao.expiresAt > Date.now());

  destroySession(token);
  assert.equal(getSession(token), null);
  assert.equal(getSession('token-inexistente'), null);
  assert.equal(getSession(''), null);
});

test('publicUser nunca expõe hash/salt', () => {
  const user = { id: 1, usuario: 'admin', nome: 'A', perfil: 'admin', senha_hash: 'x', salt: 'y' };
  const pub = publicUser(user);
  assert.deepEqual(pub, { id: 1, usuario: 'admin', nome: 'A', perfil: 'admin' });
});
