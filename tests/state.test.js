/**
 * Estado compartilhado com identificadores opacos:
 * os mesmos fluxos devem funcionar com id numérico (JSON) e UUID (Supabase).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  state,
  contractById,
  filesForContract,
  upsertContract,
  removeContractFromState,
} from '../public/js/state.js';
import { sameId } from '../public/js/utils.js';

const uuid1 = 'a3f8c1e2-4b5d-4e6f-8a9b-0c1d2e3f4a5b';
const uuid2 = 'b4e9d2f3-5c6e-4f70-9b0c-1d2e3f4a5b6c';

test('sameId compara de forma opaca (número, string, UUID)', () => {
  assert.equal(sameId(1, 1), true);
  assert.equal(sameId(1, '1'), true);
  assert.equal(sameId('1', '1'), true);
  assert.equal(sameId(uuid1, uuid1), true);
  assert.equal(sameId(uuid1, uuid2), false);
  assert.equal(sameId(1, 2), false);
  assert.equal(sameId(null, 1), false);
  assert.equal(sameId(undefined, undefined), false);
});

test('cenário JSON: ids numéricos', () => {
  state.contracts = [
    { id: 1, numero: 'CT-A' },
    { id: 2, numero: 'CT-B' },
  ];
  state.files = [{ id: 10, contrato_id: 1, enviado_em: '2026-01-01T00:00:00Z' }];
  state.filteredIds = [1, 2];

  assert.equal(contractById(1)?.numero, 'CT-A');
  assert.equal(contractById('1')?.numero, 'CT-A', 'string vinda de dataset');
  assert.equal(filesForContract(1).length, 1);
  assert.equal(filesForContract('1').length, 1);

  upsertContract({ id: 2, numero: 'CT-B2' });
  assert.equal(state.contracts.length, 2, 'upsert não duplica');
  assert.equal(contractById(2).numero, 'CT-B2');

  removeContractFromState('1');
  assert.equal(state.contracts.length, 1);
  assert.equal(state.files.length, 0, 'arquivos do contrato somem junto');
  assert.deepEqual(state.filteredIds, [2]);
});

test('cenário Supabase: ids UUID', () => {
  state.contracts = [
    { id: uuid1, numero: 'CT-U1' },
    { id: uuid2, numero: 'CT-U2' },
  ];
  state.files = [{ id: 'f1111111-1111-1111-1111-111111111111', contrato_id: uuid1, enviado_em: '2026-01-01T00:00:00Z' }];
  state.filteredIds = [uuid1, uuid2];

  assert.equal(contractById(uuid1)?.numero, 'CT-U1');
  assert.equal(contractById(uuid2)?.numero, 'CT-U2');
  assert.equal(filesForContract(uuid1).length, 1);

  upsertContract({ id: uuid2, numero: 'CT-U2b' });
  assert.equal(state.contracts.length, 2, 'upsert com UUID não duplica');
  assert.equal(contractById(uuid2).numero, 'CT-U2b');

  removeContractFromState(uuid1);
  assert.equal(state.contracts.length, 1);
  assert.equal(state.files.length, 0);
  assert.deepEqual(state.filteredIds, [uuid2]);
});
