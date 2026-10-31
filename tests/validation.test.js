/** Regras de validação e numeração de contratos no servidor. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateContract, generateContractNumber, parseNumber, isValidDate } from '../server/validation.js';

function contratoValido(extra = {}) {
  return {
    numero: 'CT-2026-100',
    objeto: 'Prestação de serviços de TI',
    contratada: 'ACME Ltda',
    cnpj: '12.345.678/0001-90',
    tipo: 'TI',
    setor_responsavel: 'TI',
    gestor: 'Fulano',
    valor_total: '10.000,00',
    valor_mensal: 500,
    data_assinatura: '2025-12-15',
    data_inicio: '2026-01-01',
    data_fim: '2026-12-31',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: '',
    ...extra,
  };
}

test('contrato válido passa sem erros e normaliza valores', () => {
  const { values, errors } = validateContract(contratoValido(), null, []);
  assert.deepEqual(errors, {});
  assert.equal(values.valor_total, 10000);
  assert.equal(values.valor_mensal, 500);
  assert.equal(values.status, 'Vigente');
});

test('campos obrigatórios e listas são validados', () => {
  const { errors } = validateContract(
    { numero: '', objeto: '', contratada: '', tipo: 'Inválido', status: 'Nada', data_inicio: '', data_fim: '' },
    null,
    [],
  );
  assert.ok(errors.numero);
  assert.ok(errors.objeto);
  assert.ok(errors.contratada);
  assert.ok(errors.tipo);
  assert.ok(errors.status);
  assert.ok(errors.data_inicio);
  assert.ok(errors.data_fim);
});

test('número duplicado é rejeitado (case-insensitive)', () => {
  const existentes = [{ id: 1, numero: 'CT-2026-001' }];
  const { errors } = validateContract(contratoValido({ numero: 'ct-2026-001' }), null, existentes);
  assert.ok(errors.numero);
});

test('mesmo contrato não conflita com o próprio número', () => {
  const existente = { ...contratoValido({ numero: 'CT-2026-001' }), id: 7 };
  const { errors } = validateContract({ numero: 'CT-2026-001' }, existente, [existente]);
  assert.equal(errors.numero, undefined);
});

test('valores negativos e datas invertidas são rejeitados', () => {
  const { errors } = validateContract(
    contratoValido({ valor_total: -5, data_inicio: '2026-12-01', data_fim: '2026-01-01' }),
    null,
    [],
  );
  assert.ok(errors.valor_total);
  assert.ok(errors.data_fim);
});

test('parseNumber legado continua compatível', () => {
  assert.equal(parseNumber(''), 0);
  assert.equal(parseNumber('1.234,56'), 1234.56);
  assert.ok(Number.isNaN(parseNumber('x')));
  assert.equal(isValidDate('2026-02-30'), false);
});

test('generateContractNumber gera sequencial livre no ano atual', () => {
  const ano = new Date().getFullYear();
  const primeiro = generateContractNumber([]);
  assert.equal(primeiro, `CT-${ano}-001`);
  const segundo = generateContractNumber([{ numero: primeiro }]);
  assert.equal(segundo, `CT-${ano}-002`);
  const pulando = generateContractNumber([{ numero: `CT-${ano}-001` }, { numero: `CT-${ano}-002` }]);
  assert.equal(pulando, `CT-${ano}-003`);
});
