/** Exportação CSV (pt-BR, ";") e XLSX (3 abas) geradas no servidor. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import XLSX from 'xlsx';
import { buildCsv, buildXlsx, exportDateStamp, formatDateBR } from '../server/export.js';

const contrato = {
  id: 1,
  numero: 'CT-2026-001',
  objeto: 'Suporte técnico; com prioridade',
  contratada: 'ACME Ltda',
  cnpj: '12.345.678/0001-90',
  tipo: 'TI',
  setor_responsavel: 'TI',
  gestor: 'Fulano',
  valor_total: 1234.56,
  valor_mensal: 100,
  data_assinatura: '2025-12-15',
  data_inicio: '2026-01-01',
  data_fim: '2026-12-31',
  status: 'Vigente',
  forma_reajuste: 'Anual',
  indice_reajuste: 'IPCA',
  observacoes: '',
  criado_em: '2025-12-10T12:00:00.000Z',
  atualizado_em: '2026-01-05T09:30:00.000Z',
};

const arquivo = {
  id: 10,
  contrato_id: 1,
  nome_original: 'contrato-assinado.pdf',
  categoria: 'Contrato original',
  tipo: 'application/pdf',
  tamanho: 204800,
  enviado_em: '2026-01-02T10:00:00.000Z',
};

test('buildCsv usa ; , datas BR, valores BR e aspas quando necessário', () => {
  const csv = buildCsv([contrato]);
  const linhas = csv.split('\r\n');
  assert.equal(linhas.length, 2, 'header + 1 linha');
  assert.match(linhas[0], /Nº do contrato/);
  assert.match(linhas[1], /CT-2026-001/);
  assert.match(linhas[1], /1234,56/);
  assert.match(linhas[1], /01\/01\/2026/);
  assert.match(linhas[1], /"Suporte técnico; com prioridade"/);
});

test('buildCsv neutraliza fórmulas (CSV injection)', () => {
  const csv = buildCsv([{ ...contrato, observacoes: '=SUM(A1:A9)' }]);
  assert.match(csv, /'=SUM\(A1:A9\)/);
});

test('buildXlsx gera arquivo válido com as abas Contratos, Arquivos e Resumo', () => {
  const buffer = buildXlsx([contrato], [arquivo]);
  assert.ok(Buffer.isBuffer(buffer));
  assert.equal(buffer.slice(0, 2).toString(), 'PK'); // ZIP válido

  const wb = XLSX.read(buffer, { type: 'buffer' });
  assert.deepEqual(wb.SheetNames, ['Contratos', 'Arquivos', 'Resumo']);

  const contratos = XLSX.utils.sheet_to_json(wb.Sheets.Contratos, { header: 1 });
  assert.match(String(contratos[0].join(' ')), /Nº do contrato/);
  assert.equal(contratos.length, 2);

  const resumo = XLSX.utils.sheet_to_json(wb.Sheets.Resumo, { header: 1 });
  assert.ok(resumo.length > 2);
});

test('exportDateStamp e formatDateBR', () => {
  assert.equal(exportDateStamp(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(exportDateStamp(new Date(2026, 11, 31)), '2026-12-31');
  assert.equal(formatDateBR('2026-10-30'), '30/10/2026');
  assert.equal(formatDateBR(''), '');
});
