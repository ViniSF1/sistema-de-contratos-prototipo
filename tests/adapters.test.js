/**
 * Contrato da camada de dados: verifica que o SupabaseAdapter expõe
 * todos os métodos esperados pela interface do adaptador.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SupabaseAdapter } from '../public/js/data/supabaseAdapter.js';

const METODOS = [
  'login',
  'logout',
  'getSession',
  'listContracts',
  'getContract',
  'createContract',
  'updateContract',
  'deleteContract',
  'listFiles',
  'uploadFile',
  'downloadFile',
  'viewFileUrl',
  'deleteFile',
  'exportData',
  'isAuthenticated',
];

test('SupabaseAdapter implementa todos os métodos da interface', () => {
  const supabase = new SupabaseAdapter({
    URL: 'https://exemplo.supabase.co',
    ANON_KEY: 'chave-fake',
    BUCKET: 'contract-files',
  });

  for (const metodo of METODOS) {
    assert.equal(typeof supabase[metodo], 'function', `SupabaseAdapter.${metodo}`);
  }
});

test('viewFileUrl é assíncrono', () => {
  const supabase = new SupabaseAdapter({ URL: 'x', ANON_KEY: 'y', BUCKET: 'b' });
  assert.equal(supabase.viewFileUrl.constructor.name, 'AsyncFunction');
});

test('SupabaseAdapter monta credenciais no construtor (URL/ANON_KEY maiúsculos)', () => {
  const supabase = new SupabaseAdapter({
    URL: 'https://exemplo.supabase.co',
    ANON_KEY: 'chave-fake',
    BUCKET: 'meu-bucket',
  });
  assert.equal(supabase.url, 'https://exemplo.supabase.co');
  assert.equal(supabase.anonKey, 'chave-fake');
  assert.equal(supabase.bucket, 'meu-bucket');
});

test('SupabaseAdapter sem bucket usa o padrão contract-files', () => {
  const supabase = new SupabaseAdapter({ URL: 'x', ANON_KEY: 'y' });
  assert.equal(supabase.bucket, 'contract-files');
});

test('isAuthenticated é falso sem token (fora do browser)', () => {
  const supabase = new SupabaseAdapter({ URL: 'x', ANON_KEY: 'y' });
  assert.equal(supabase.isAuthenticated(), false);
});
