/** Segurança e organização dos anexos (sem tocar o disco). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  buildStoredName,
  contractUploadDir,
  extensionOf,
  isPreviewable,
  mimeOf,
  resolveStoredFile,
  safeOriginalName,
  validateUpload,
} from '../server/files.js';

test('extensionOf normaliza para minúsculas com ponto', () => {
  assert.equal(extensionOf('Contrato.PDF'), '.pdf');
  assert.equal(extensionOf('imagem.JPeG'), '.jpeg');
  assert.equal(extensionOf('sem-ponto'), '');
});

test('safeOriginalName remove diretórios e caracteres de controle', () => {
  assert.equal(safeOriginalName('..\\..\\etc\\passwd.pdf'), 'passwd.pdf');
  assert.equal(safeOriginalName('/etc/passwd.pdf'), 'passwd.pdf');
  assert.equal(safeOriginalName('rel\u0000atorio\n.pdf'), 'relatório.pdf'.replace('ó', 'o')); // controles removidos
});

test('safeOriginalName recupera UTF-8 interpretado como latin1', () => {
  assert.equal(safeOriginalName('cafÃ©.pdf'), 'café.pdf');
});

test('buildStoredName gera nome único, sanitizado e com extensão', () => {
  const nome = buildStoredName('Meu Contrato çã.pdf');
  assert.match(nome, /^\d+-[a-f0-9]{8}-Meu-Contrato-ca\.pdf$/);
  const outro = buildStoredName('Meu Contrato çã.pdf');
  assert.notEqual(nome, outro); // prefixo único por upload
});

test('validateUpload aceita permitidos e bloqueia perigosos', () => {
  const arquivo = (name, size = 100) => ({ originalname: name, size, buffer: Buffer.from('x') });
  assert.equal(validateUpload(arquivo('doc.pdf')), '');
  assert.equal(validateUpload(arquivo('planilha.XLSX')), '');
  assert.equal(validateUpload(arquivo('foto.png')), '');

  assert.ok(validateUpload(arquivo('malware.exe')));
  assert.ok(validateUpload(arquivo('script.sh')));
  assert.ok(validateUpload(arquivo('pagina.html')));
  assert.ok(validateUpload(arquivo('vetor.svg')));

  assert.ok(validateUpload(arquivo('sem-extensao')));
  assert.ok(validateUpload(arquivo('vazio.pdf', 0)));
  assert.ok(validateUpload(arquivo('grande.pdf', 21 * 1024 * 1024)));
  assert.ok(validateUpload(null));
});

test('contractUploadDir exige id numérico', () => {
  assert.ok(contractUploadDir('1').endsWith(path.join('uploads', '1')));
  assert.throws(() => contractUploadDir('ab/cd'), /inválido/i);
});

test('resolveStoredFile mantém o caminho dentro de storage/uploads', () => {
  const normal = resolveStoredFile(1, 'arquivo.pdf');
  assert.ok(normal.endsWith(path.join('uploads', '1', 'arquivo.pdf')));

  // Tentativa de path traversal: basename garante que continua na pasta do contrato.
  const malicioso = resolveStoredFile(1, '..\\..\\evil.pdf');
  assert.ok(malicioso.endsWith(path.join('uploads', '1', 'evil.pdf')));
  assert.ok(!malicioso.includes('..'));
});

test('mimeOf e isPreviewable', () => {
  assert.equal(mimeOf('a.pdf'), 'application/pdf');
  assert.equal(mimeOf('a.png'), 'image/png');
  assert.equal(mimeOf('a.xyz'), 'application/octet-stream');
  assert.equal(isPreviewable('a.pdf'), true);
  assert.equal(isPreviewable('a.png'), true);
  assert.equal(isPreviewable('a.docx'), false);
});
