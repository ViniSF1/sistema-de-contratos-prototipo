/**
 * Catálogo compartilhado: a mesma fonte alimenta front e back.
 * Se alguém duplicar uma lista em outro arquivo, estes testes quebram.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import * as shared from '../public/js/shared/catalog.js';
import * as constants from '../public/js/constants.js';
import * as validation from '../server/validation.js';
import * as files from '../server/files.js';

test('front re-exporta exatamente as listas do shared', () => {
  assert.strictEqual(constants.STATUS_OPTIONS, shared.STATUS_OPTIONS);
  assert.strictEqual(constants.TIPO_OPTIONS, shared.TIPO_OPTIONS);
  assert.strictEqual(constants.FILE_CATEGORIES, shared.FILE_CATEGORIES);
  assert.strictEqual(constants.ALLOWED_FILE_EXTENSIONS, shared.ALLOWED_FILE_EXTENSIONS);
  assert.strictEqual(constants.DANGEROUS_FILE_EXTENSIONS, shared.DANGEROUS_FILE_EXTENSIONS);
  assert.strictEqual(constants.MAX_FILE_BYTES, shared.MAX_FILE_BYTES);
  assert.strictEqual(constants.MAX_FILE_MB, shared.MAX_FILE_MB);
});

test('validação do servidor usa as listas do shared', () => {
  assert.strictEqual(validation.STATUS_OPTIONS, shared.STATUS_OPTIONS);
  assert.strictEqual(validation.TIPO_OPTIONS, shared.TIPO_OPTIONS);
});

test('anexos do servidor usam categorias e limite do shared', () => {
  assert.strictEqual(files.CATEGORIAS, shared.FILE_CATEGORIES);
  assert.strictEqual(files.MAX_FILE_BYTES, shared.MAX_FILE_BYTES);
  assert.equal(shared.MAX_FILE_BYTES, 20 * 1024 * 1024);
});

test('parseDecimalBR entende formatos pt-BR e números', () => {
  assert.equal(shared.parseDecimalBR('1.234,56'), 1234.56);
  assert.equal(shared.parseDecimalBR('R$ 1.234,56'), 1234.56);
  assert.equal(shared.parseDecimalBR('10'), 10);
  assert.equal(shared.parseDecimalBR(99.9), 99.9);
  assert.ok(Number.isNaN(shared.parseDecimalBR('')));
  assert.ok(Number.isNaN(shared.parseDecimalBR('abc')));
  assert.ok(Number.isNaN(shared.parseDecimalBR(null)));
});

test('isValidISODate valida calendário real', () => {
  assert.equal(shared.isValidISODate('2026-10-30'), true);
  assert.equal(shared.isValidISODate('2024-02-29'), true); // bissexto
  assert.equal(shared.isValidISODate('2026-02-29'), false); // não bissexto
  assert.equal(shared.isValidISODate('2026-13-01'), false);
  assert.equal(shared.isValidISODate('2026/10/30'), false);
  assert.equal(shared.isValidISODate(''), false);
});
