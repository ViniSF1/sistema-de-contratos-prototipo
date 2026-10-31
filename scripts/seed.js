/**
 * Gera a base fictícia de desenvolvimento (18 contratos, 6 fornecedores e 10 anexos).
 * Uso: npm run seed  — ATENÇÃO: substitui data/db.json e a pasta storage/uploads.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { hashPassword } from '../server/auth.js';
import { mimeOf } from '../server/files.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const STORAGE_DIR = path.join(ROOT, 'storage');
const UPLOADS_DIR = path.join(STORAGE_DIR, 'uploads');

const NEXA = { contratada: 'Nexa Tecnologia e Sistemas Ltda', cnpj: '12.345.678/0001-90' };
const SOLARIS = { contratada: 'Solaris Facilities e Serviços Ltda', cnpj: '23.456.789/0001-01' };
const PRIME = { contratada: 'Prime Office Imóveis Corporativos Ltda', cnpj: '34.567.890/0001-12' };
const ANDRADE = { contratada: 'Andrade Logística S.A.', cnpj: '45.678.901/0001-23' };
const CONSULTE = { contratada: 'Consulte Consultoria Empresarial Ltda', cnpj: '56.789.012/0001-34' };
const VERDE = { contratada: 'Verde Campo Alimentos S.A.', cnpj: '67.890.123/0001-45' };

const CONTRACTS = [
  {
    ...NEXA,
    numero: 'CT-2024-001',
    objeto: 'Fornecimento de licenças Microsoft 365 e suporte técnico especializado',
    tipo: 'TI',
    setor_responsavel: 'TI',
    gestor: 'Mariana Alves',
    valor_total: 288000,
    valor_mensal: 24000,
    data_assinatura: '2023-12-15',
    data_inicio: '2024-01-01',
    data_fim: '2026-12-20',
    status: 'A vencer',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Renovação em análise pela área de TI. Inclui 220 licenças E3.',
    criado_em: '2024-01-02T13:20:00.000Z',
    atualizado_em: '2026-10-15T09:40:00.000Z',
  },
  {
    ...SOLARIS,
    numero: 'CT-2024-002',
    objeto: 'Prestação de serviços de limpeza e conservação predial',
    tipo: 'Prestação de Serviços',
    setor_responsavel: 'Administrativo',
    gestor: 'Carlos Menezes',
    valor_total: 432000,
    valor_mensal: 36000,
    data_assinatura: '2024-01-20',
    data_inicio: '2024-02-01',
    data_fim: '2026-02-28',
    status: 'Vencido',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Aguardando conclusão do processo de nova contratação.',
    criado_em: '2024-01-25T11:10:00.000Z',
    atualizado_em: '2026-03-02T08:15:00.000Z',
  },
  {
    ...PRIME,
    numero: 'CT-2024-003',
    objeto: 'Locação do imóvel comercial - Unidade Vila Olímpia',
    tipo: 'Locação',
    setor_responsavel: 'Facilities',
    gestor: 'Renata Prado',
    valor_total: 1080000,
    valor_mensal: 45000,
    data_assinatura: '2024-02-10',
    data_inicio: '2024-03-01',
    data_fim: '2029-02-28',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IGP-M',
    observacoes: 'Contrato de 60 meses com direito a renovação.',
    criado_em: '2024-02-15T14:00:00.000Z',
    atualizado_em: '2026-02-20T10:30:00.000Z',
  },
  {
    ...ANDRADE,
    numero: 'CT-2024-004',
    objeto: 'Fornecimento de materiais de escritório e suprimentos',
    tipo: 'Fornecimento',
    setor_responsavel: 'Compras',
    gestor: 'Paulo Ribeiro',
    valor_total: 96000,
    valor_mensal: 8000,
    data_assinatura: '2024-03-15',
    data_inicio: '2024-04-01',
    data_fim: '2026-03-31',
    status: 'Vencido',
    forma_reajuste: 'Semestral',
    indice_reajuste: 'IPCA',
    observacoes: 'Último pedido entregue em fevereiro de 2026.',
    criado_em: '2024-03-20T09:45:00.000Z',
    atualizado_em: '2026-04-01T16:20:00.000Z',
  },
  {
    ...CONSULTE,
    numero: 'CT-2024-005',
    objeto: 'Consultoria para reestruturação organizacional e governança',
    tipo: 'Consultoria',
    setor_responsavel: 'Diretoria',
    gestor: 'Ana Beatriz Costa',
    valor_total: 120000,
    valor_mensal: 10000,
    data_assinatura: '2024-05-20',
    data_inicio: '2024-06-01',
    data_fim: '2025-05-31',
    status: 'Rescindido',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Encerrado antecipadamente em dezembro de 2024 por acordo entre as partes.',
    criado_em: '2024-05-25T15:35:00.000Z',
    atualizado_em: '2024-12-20T17:00:00.000Z',
  },
  {
    ...NEXA,
    numero: 'CT-2025-001',
    objeto: 'Sustentação de infraestrutura de rede e firewall',
    tipo: 'Manutenção',
    setor_responsavel: 'TI',
    gestor: 'Mariana Alves',
    valor_total: 216000,
    valor_mensal: 18000,
    data_assinatura: '2024-12-10',
    data_inicio: '2025-01-01',
    data_fim: '2026-12-15',
    status: 'A vencer',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'SLA de 4 horas para incidentes críticos.',
    criado_em: '2024-12-18T10:05:00.000Z',
    atualizado_em: '2026-10-10T11:25:00.000Z',
  },
  {
    ...VERDE,
    numero: 'CT-2025-002',
    objeto: 'Fornecimento de gêneros alimentícios para o refeitório',
    tipo: 'Fornecimento',
    setor_responsavel: 'Administrativo',
    gestor: 'Juliana Freitas',
    valor_total: 144000,
    valor_mensal: 12000,
    data_assinatura: '2025-01-15',
    data_inicio: '2025-02-01',
    data_fim: '2027-01-31',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Entregas semanais às segundas e quintas-feiras.',
    criado_em: '2025-01-20T08:50:00.000Z',
    atualizado_em: '2026-01-28T10:10:00.000Z',
  },
  {
    ...SOLARIS,
    numero: 'CT-2025-003',
    objeto: 'Manutenção preventiva e corretiva de climatização',
    tipo: 'Manutenção',
    setor_responsavel: 'Facilities',
    gestor: 'Carlos Menezes',
    valor_total: 84000,
    valor_mensal: 7000,
    data_assinatura: '2025-02-12',
    data_inicio: '2025-03-01',
    data_fim: '2027-02-28',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Inclui 32 equipamentos e atendimento emergencial.',
    criado_em: '2025-02-18T13:30:00.000Z',
    atualizado_em: '2026-03-04T09:00:00.000Z',
  },
  {
    ...PRIME,
    numero: 'CT-2025-004',
    objeto: 'Locação de estações de trabalho compartilhadas - 20 posições',
    tipo: 'Locação',
    setor_responsavel: 'Operações',
    gestor: 'Renata Prado',
    valor_total: 288000,
    valor_mensal: 12000,
    data_assinatura: '2025-03-10',
    data_inicio: '2025-04-01',
    data_fim: '2026-03-31',
    status: 'Vencido',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IGP-M',
    observacoes: 'Espaço desocupado em abril de 2026.',
    criado_em: '2025-03-15T16:45:00.000Z',
    atualizado_em: '2026-04-02T10:00:00.000Z',
  },
  {
    ...ANDRADE,
    numero: 'CT-2025-005',
    objeto: 'Gestão de transporte e logística de documentos',
    tipo: 'Prestação de Serviços',
    setor_responsavel: 'Operações',
    gestor: 'Paulo Ribeiro',
    valor_total: 156000,
    valor_mensal: 13000,
    data_assinatura: '2025-04-12',
    data_inicio: '2025-05-01',
    data_fim: '2026-10-31',
    status: 'Em renovação',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Processo de renovação iniciado em setembro de 2026.',
    criado_em: '2025-04-18T09:20:00.000Z',
    atualizado_em: '2026-09-22T14:35:00.000Z',
  },
  {
    ...CONSULTE,
    numero: 'CT-2025-006',
    objeto: 'Assessoria tributária e planejamento fiscal',
    tipo: 'Consultoria',
    setor_responsavel: 'Financeiro',
    gestor: 'Ana Beatriz Costa',
    valor_total: 132000,
    valor_mensal: 11000,
    data_assinatura: '2025-05-20',
    data_inicio: '2025-06-01',
    data_fim: '2027-05-31',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Escopo inclui revisão mensal das obrigações acessórias.',
    criado_em: '2025-05-25T11:00:00.000Z',
    atualizado_em: '2026-06-02T09:30:00.000Z',
  },
  {
    ...NEXA,
    numero: 'CT-2025-007',
    objeto: 'Desenvolvimento e manutenção do portal do cliente',
    tipo: 'TI',
    setor_responsavel: 'Tecnologia',
    gestor: 'Rafael Duarte',
    valor_total: 360000,
    valor_mensal: 30000,
    data_assinatura: '2025-07-01',
    data_inicio: '2025-07-15',
    data_fim: '2027-07-14',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Squad dedicado com entregas a cada duas semanas.',
    criado_em: '2025-07-05T10:15:00.000Z',
    atualizado_em: '2026-07-16T09:10:00.000Z',
  },
  {
    ...VERDE,
    numero: 'CT-2025-008',
    objeto: 'Fornecimento de café e insumos para copas',
    tipo: 'Fornecimento',
    setor_responsavel: 'Administrativo',
    gestor: 'Juliana Freitas',
    valor_total: 36000,
    valor_mensal: 3000,
    data_assinatura: '2025-07-20',
    data_inicio: '2025-08-01',
    data_fim: '2026-07-31',
    status: 'Rescindido',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Encerrado em junho de 2026 por mudança de fornecedor.',
    criado_em: '2025-07-25T14:40:00.000Z',
    atualizado_em: '2026-06-05T15:20:00.000Z',
  },
  {
    ...SOLARIS,
    numero: 'CT-2025-009',
    objeto: 'Serviços de portaria e controle de acesso',
    tipo: 'Prestação de Serviços',
    setor_responsavel: 'Facilities',
    gestor: 'Carlos Menezes',
    valor_total: 240000,
    valor_mensal: 20000,
    data_assinatura: '2025-08-15',
    data_inicio: '2025-09-01',
    data_fim: '2027-08-31',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Escala 24x7 com posto fixo na recepção.',
    criado_em: '2025-08-20T08:30:00.000Z',
    atualizado_em: '2026-09-03T10:05:00.000Z',
  },
  {
    ...PRIME,
    numero: 'CT-2025-010',
    objeto: 'Locação de espaço para arquivo físico',
    tipo: 'Locação',
    setor_responsavel: 'Administrativo',
    gestor: 'Renata Prado',
    valor_total: 72000,
    valor_mensal: 6000,
    data_assinatura: '2025-09-10',
    data_inicio: '2025-10-01',
    data_fim: '2026-12-10',
    status: 'A vencer',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IGP-M',
    observacoes: 'Avaliar renovação por mais 12 meses.',
    criado_em: '2025-09-15T12:15:00.000Z',
    atualizado_em: '2026-10-01T10:50:00.000Z',
  },
  {
    ...ANDRADE,
    numero: 'CT-2025-011',
    objeto: 'Fornecimento de equipamentos de proteção individual',
    tipo: 'Fornecimento',
    setor_responsavel: 'Segurança do Trabalho',
    gestor: 'Paulo Ribeiro',
    valor_total: 60000,
    valor_mensal: 5000,
    data_assinatura: '2025-10-10',
    data_inicio: '2025-11-01',
    data_fim: '2026-10-31',
    status: 'A vencer',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Estoque mínimo de 300 unidades por item.',
    criado_em: '2025-10-15T09:00:00.000Z',
    atualizado_em: '2026-10-10T14:20:00.000Z',
  },
  {
    ...CONSULTE,
    numero: 'CT-2026-001',
    objeto: 'Programa de desenvolvimento de lideranças',
    tipo: 'Consultoria',
    setor_responsavel: 'Recursos Humanos',
    gestor: 'Ana Beatriz Costa',
    valor_total: 96000,
    valor_mensal: 8000,
    data_assinatura: '2025-12-20',
    data_inicio: '2026-01-15',
    data_fim: '2027-01-14',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Turmas presenciais e mentoria individual.',
    criado_em: '2025-12-28T10:00:00.000Z',
    atualizado_em: '2026-08-12T11:30:00.000Z',
  },
  {
    ...NEXA,
    numero: 'CT-2026-002',
    objeto: 'Migração de workloads para nuvem e suporte 24x7',
    tipo: 'TI',
    setor_responsavel: 'Tecnologia',
    gestor: 'Rafael Duarte',
    valor_total: 480000,
    valor_mensal: 40000,
    data_assinatura: '2026-01-15',
    data_inicio: '2026-02-01',
    data_fim: '2028-01-31',
    status: 'Vigente',
    forma_reajuste: 'Anual',
    indice_reajuste: 'IPCA',
    observacoes: 'Migração concluída em agosto de 2026; suporte 24x7 até 2028.',
    criado_em: '2026-01-20T09:30:00.000Z',
    atualizado_em: '2026-08-30T12:00:00.000Z',
  },
];

const FILES = [
  {
    contrato: 'CT-2024-001',
    nome: 'Contrato assinado - Nexa 2024.pdf',
    categoria: 'Contrato original',
    enviado_em: '2024-01-02T13:25:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2024-001',
    nome: 'Aditivo de prorrogacao 2025.pdf',
    categoria: 'Aditivo',
    enviado_em: '2025-12-15T10:10:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2024-003',
    nome: 'Contrato de locacao - Vila Olimpia.pdf',
    categoria: 'Contrato original',
    enviado_em: '2024-02-12T15:00:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2024-005',
    nome: 'Termo de rescisao - Consulte.pdf',
    categoria: 'Outros',
    enviado_em: '2024-12-20T17:10:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2025-001',
    nome: 'Proposta tecnica - sustentacao.pdf',
    categoria: 'Anexo',
    enviado_em: '2024-12-28T09:35:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2025-003',
    nome: 'Laudo de climatizacao - Q3 2026.pdf',
    categoria: 'Anexo',
    enviado_em: '2026-10-05T14:20:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2025-005',
    nome: 'Nota fiscal 0926 - Andrade.pdf',
    categoria: 'Nota fiscal',
    enviado_em: '2026-09-30T11:45:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2025-007',
    nome: 'Cronograma do portal do cliente.pdf',
    categoria: 'Anexo',
    enviado_em: '2025-07-10T16:30:00.000Z',
    kind: 'pdf',
  },
  {
    contrato: 'CT-2025-008',
    nome: 'Comprovante de entrega - Verde Campo.png',
    categoria: 'Outros',
    enviado_em: '2026-06-18T08:40:00.000Z',
    kind: 'png',
  },
  {
    contrato: 'CT-2025-010',
    nome: 'Contrato de locacao - arquivo fisico.pdf',
    categoria: 'Contrato original',
    enviado_em: '2025-09-20T10:30:00.000Z',
    kind: 'pdf',
  },
];

/* ------------------------------------------------------------------ */
/* Geradores de placeholders                                           */
/* ------------------------------------------------------------------ */

function escapePdfText(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Cria um PDF de uma página, apenas para demonstração. */
function makePdf(title, subtitle, lines) {
  const content = [
    'BT',
    '/F1 20 Tf',
    '60 760 Td',
    `(${escapePdfText(title)}) Tj`,
    '/F1 11 Tf',
    '0 -28 Td',
    `(${escapePdfText(subtitle)}) Tj`,
    ...lines.map((line) => `0 -22 Td (${escapePdfText(line)}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'latin1')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, 'latin1'));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'latin1');
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buffer) {
  let crc = -1;
  for (let index = 0; index < buffer.length; index += 1) {
    crc = CRC_TABLE[(crc ^ buffer[index]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const typeBuffer = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, crc]);
}

/** Placeholder PNG 800x450 com faixa de cabeçalho e linhas de "documento". */
function makePng() {
  const width = 800;
  const height = 450;
  const stride = width * 3 + 1;
  const raw = Buffer.alloc(stride * height);

  for (let y = 0; y < height; y += 1) {
    const row = y * stride;
    raw[row] = 0;
    for (let x = 0; x < width; x += 1) {
      const offset = row + 1 + x * 3;
      let r = 245;
      let g = 247;
      let b = 250;
      if (y < 70) {
        r = 31;
        g = 56;
        b = 100;
      } else if (y > 110 && y < 126 && x > 60 && x < 560) {
        r = 31;
        g = 56;
        b = 100;
      } else if (y > 150 && y < 162 && x > 60 && x < 690) {
        r = 203;
        g = 213;
        b = 225;
      } else if (y > 185 && y < 197 && x > 60 && x < 640) {
        r = 226;
        g = 232;
        b = 240;
      } else if (y > 220 && y < 232 && x > 60 && x < 700) {
        r = 226;
        g = 232;
        b = 240;
      }
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 2;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    signature,
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

function slugify(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .toLowerCase()
    .slice(0, 70);
}

async function main() {
  const { salt, hash } = hashPassword('admin123');

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.rm(STORAGE_DIR, { recursive: true, force: true });
  await fs.mkdir(UPLOADS_DIR, { recursive: true });

  const contracts = CONTRACTS.map((contract, index) => ({ id: index + 1, ...contract }));
  const byNumber = new Map(contracts.map((contract) => [contract.numero, contract]));
  const files = [];

  for (let index = 0; index < FILES.length; index += 1) {
    const item = FILES[index];
    const contract = byNumber.get(item.contrato);
    if (!contract) throw new Error(`Contrato inexistente no seed: ${item.contrato}`);

    const id = index + 1;
    const extension = item.kind === 'png' ? '.png' : '.pdf';
    const nomeSalvo = `${String(id).padStart(2, '0')}-${slugify(item.nome.replace(/\.[^.]+$/, ''))}${extension}`;
    const directory = path.join(UPLOADS_DIR, String(contract.id));
    await fs.mkdir(directory, { recursive: true });

    let buffer;
    if (item.kind === 'png') {
      buffer = makePng();
    } else {
      buffer = makePdf(
        'Documento ficticio de demonstracao',
        `${contract.numero} - ${item.nome}`,
        [
          'Este arquivo foi gerado automaticamente pelo seed do sistema Contrata.',
          `Contrato: ${contract.numero}`,
          `Contratada: ${contract.contratada}`,
          `Categoria: ${item.categoria}`,
          '',
          'O conteudo e meramente ilustrativo. Nenhum dado real de empresa',
          'ou pessoa foi utilizado neste ambiente de desenvolvimento.',
        ],
      );
    }

    await fs.writeFile(path.join(directory, nomeSalvo), buffer);

    files.push({
      id,
      contrato_id: contract.id,
      nome_original: item.nome,
      nome_salvo: nomeSalvo,
      tipo: mimeOf(item.nome),
      tamanho: buffer.length,
      categoria: item.categoria,
      enviado_em: item.enviado_em,
    });
  }

  const payload = {
    meta: {
      nextContractId: contracts.length + 1,
      nextFileId: files.length + 1,
      seedVersion: 1,
      seedDate: new Date().toISOString(),
    },
    users: [
      {
        id: 1,
        usuario: 'admin',
        nome: 'Administrador',
        perfil: 'admin',
        salt,
        senha_hash: hash,
        criado_em: '2024-01-01T00:00:00.000Z',
      },
    ],
    contracts,
    files,
  };

  await fs.writeFile(DB_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  console.log('Banco fictício criado com sucesso.');
  console.log(`- ${contracts.length} contratos`);
  console.log(`- ${files.length} arquivos`);
  console.log(`- usuário: admin | senha: admin123`);
}

main().catch((error) => {
  console.error('Falha ao gerar o seed:', error);
  process.exit(1);
});
