/**
 * Exportação da base: CSV compatível com Excel pt-BR e XLSX (SheetJS) com 3 abas.
 * A exportação roda no servidor para manter o front-end independente de bibliotecas.
 */
import XLSX from 'xlsx';

const { CFB } = XLSX;

const CONTRACT_COLUMNS = [
  { key: 'id', label: 'ID', width: 7, type: 'text' },
  { key: 'numero', label: 'Nº do contrato', width: 16, type: 'text' },
  { key: 'objeto', label: 'Objeto', width: 48, type: 'text' },
  { key: 'contratada', label: 'Contratada', width: 32, type: 'text' },
  { key: 'cnpj', label: 'CNPJ', width: 21, type: 'text' },
  { key: 'tipo', label: 'Tipo', width: 20, type: 'text' },
  { key: 'setor_responsavel', label: 'Setor responsável', width: 22, type: 'text' },
  { key: 'gestor', label: 'Gestor', width: 22, type: 'text' },
  { key: 'valor_total', label: 'Valor total (R$)', width: 18, type: 'currency' },
  { key: 'valor_mensal', label: 'Valor mensal (R$)', width: 18, type: 'currency' },
  { key: 'data_assinatura', label: 'Data de assinatura', width: 17, type: 'date' },
  { key: 'data_inicio', label: 'Data de início', width: 15, type: 'date' },
  { key: 'data_fim', label: 'Data de fim', width: 15, type: 'date' },
  { key: 'status', label: 'Status', width: 15, type: 'text' },
  { key: 'forma_reajuste', label: 'Forma de reajuste', width: 20, type: 'text' },
  { key: 'indice_reajuste', label: 'Índice de reajuste', width: 17, type: 'text' },
  { key: 'observacoes', label: 'Observações', width: 45, type: 'text' },
  { key: 'criado_em', label: 'Criado em', width: 18, type: 'datetime' },
  { key: 'atualizado_em', label: 'Atualizado em', width: 18, type: 'datetime' },
];

const FILE_COLUMNS = [
  { key: 'id', label: 'ID', width: 7 },
  { key: 'numero', label: 'Nº do contrato', width: 16 },
  { key: 'contratada', label: 'Contratada', width: 32 },
  { key: 'nome_original', label: 'Nome do arquivo', width: 42 },
  { key: 'categoria', label: 'Categoria', width: 20 },
  { key: 'tipo', label: 'Tipo (MIME)', width: 35 },
  { key: 'tamanho_kb', label: 'Tamanho (KB)', width: 14, type: 'number' },
  { key: 'enviado_em', label: 'Enviado em', width: 18 },
];

const STATUS_COLORS = {
  Vigente: '#15803D',
  'A vencer': '#B45309',
  Vencido: '#B91C1C',
  Rescindido: '#4B5563',
  'Em renovação': '#1D4ED8',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const dateTimeFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDateBR(value) {
  if (!value) return '';
  const iso = String(value).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return String(value);
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatDateTimeBR(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return dateTimeFormatter.format(date);
}

function formatMoneyBR(value) {
  return Number(value || 0).toFixed(2).replace('.', ',');
}

/** Escapa um campo CSV e evita fórmulas acidentais no Excel. */
function csvCell(value) {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  if (/[";\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** CSV em UTF-8 (BOM adicionado na rota), separador ";" e formatos pt-BR. */
export function buildCsv(contracts) {
  const header = CONTRACT_COLUMNS.map((column) => column.label);
  const lines = [header.map(csvCell).join(';')];

  for (const contract of contracts) {
    const row = CONTRACT_COLUMNS.map((column) => {
      const value = contract[column.key];
      if (column.type === 'currency') return formatMoneyBR(value);
      if (column.type === 'date') return formatDateBR(value);
      if (column.type === 'datetime') return formatDateTimeBR(value);
      return value ?? '';
    });
    lines.push(row.map(csvCell).join(';'));
  }
  return lines.join('\r\n');
}

/** Serial do Excel (base 1899-12-30), imune a fuso horário. */
function excelSerial(isoDate) {
  if (!isoDate) return null;
  const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return null;
  return (Date.UTC(year, month - 1, day) - Date.UTC(1899, 11, 30)) / 86400000;
}

function createContractsSheet(contracts) {
  const header = CONTRACT_COLUMNS.map((column) => column.label);
  const rows = contracts.map((contract) =>
    CONTRACT_COLUMNS.map((column) => {
      const value = contract[column.key];
      if (column.type === 'currency') return Number(value || 0);
      if (column.type === 'date' || column.type === 'datetime') return null;
      return value ?? '';
    }),
  );

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);

  // Aplica formatos reais de número/data nas células (não apenas texto).
  contracts.forEach((contract, rowIndex) => {
    CONTRACT_COLUMNS.forEach((column, colIndex) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowIndex + 1, c: colIndex })];
      if (!cell) return;
      if (column.type === 'currency') {
        cell.z = '"R$" #,##0.00';
      } else if (column.type === 'date') {
        const serial = excelSerial(contract[column.key]);
        if (serial !== null) {
          cell.t = 'n';
          cell.v = serial;
          cell.z = 'dd/mm/yyyy';
        } else {
          cell.t = 's';
          cell.v = '';
        }
      } else if (column.type === 'datetime') {
        cell.t = 's';
        cell.v = formatDateTimeBR(contract[column.key]);
      }
    });
  });

  worksheet['!cols'] = CONTRACT_COLUMNS.map((column) => ({ wch: column.width }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(contracts.length, 1), c: CONTRACT_COLUMNS.length - 1 },
    }),
  };
  worksheet['!rows'] = [{ hpt: 24 }];
  worksheet['!margins'] = { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 };
  return worksheet;
}

function createFilesSheet(files, contracts) {
  const contractMap = new Map(contracts.map((item) => [item.id, item]));
  const header = FILE_COLUMNS.map((column) => column.label);
  const rows = files.map((file) => {
    const contract = contractMap.get(file.contrato_id);
    return FILE_COLUMNS.map((column) => {
      if (column.key === 'numero') return contract?.numero ?? '';
      if (column.key === 'contratada') return contract?.contratada ?? '';
      if (column.key === 'tamanho_kb') return Number(((file.tamanho || 0) / 1024).toFixed(1));
      if (column.key === 'enviado_em') return formatDateTimeBR(file.enviado_em);
      return file[column.key] ?? '';
    });
  });

  const worksheet = XLSX.utils.aoa_to_sheet([header, ...rows]);
  worksheet['!cols'] = FILE_COLUMNS.map((column) => ({ wch: column.width }));
  worksheet['!autofilter'] = {
    ref: XLSX.utils.encode_range({
      s: { r: 0, c: 0 },
      e: { r: Math.max(files.length, 1), c: FILE_COLUMNS.length - 1 },
    }),
  };
  worksheet['!rows'] = [{ hpt: 24 }];
  return worksheet;
}

function countBy(contracts, key) {
  const counts = new Map();
  for (const contract of contracts) {
    const value = contract[key] || 'Não informado';
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

function isUpcoming(contract, days = 60) {
  if (contract.status === 'Rescindido') return false;
  const end = new Date(`${String(contract.data_fim).slice(0, 10)}T23:59:59`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = (end.getTime() - today.getTime()) / 86400000;
  return diff >= 0 && diff <= days;
}

function isOverdue(contract) {
  if (contract.status === 'Rescindido') return false;
  const end = new Date(`${String(contract.data_fim).slice(0, 10)}T23:59:59`);
  return end.getTime() < Date.now();
}

function createSummarySheet(contracts, files) {
  const totalValue = contracts.reduce((sum, item) => sum + Number(item.valor_total || 0), 0);
  const monthlyValue = contracts.reduce((sum, item) => sum + Number(item.valor_mensal || 0), 0);
  const upcoming = contracts.filter((item) => isUpcoming(item));
  const overdue = contracts.filter((item) => isOverdue(item));
  const statuses = countBy(contracts, 'status');
  const types = countBy(contracts, 'tipo');

  const rows = [
    ['RESUMO DA BASE DE CONTRATOS'],
    [`Gerado em ${new Date().toLocaleString('pt-BR')}`],
    [],
    ['INDICADORES GERAIS', 'VALOR'],
    ['Total de contratos', contracts.length],
    ['Valor total contratado', totalValue],
    ['Valor mensal somado', monthlyValue],
    ['Contratos a vencer em até 60 dias', upcoming.length],
    ['Contratos vencidos', overdue.length],
    ['Arquivos vinculados', files.length],
    [],
    ['CONTRATOS POR STATUS', 'QUANTIDADE'],
    ...Array.from(statuses.entries()).sort((a, b) => b[1] - a[1]),
    [],
    ['CONTRATOS POR TIPO', 'QUANTIDADE'],
    ...Array.from(types.entries()).sort((a, b) => b[1] - a[1]),
    [],
    ['PRÓXIMOS VENCIMENTOS (60 DIAS)', 'CONTRATO', 'CONTRATADA', 'DATA DE FIM'],
    ...upcoming
      .sort((a, b) => String(a.data_fim).localeCompare(String(b.data_fim)))
      .map((item) => [formatDateBR(item.data_fim), item.numero, item.contratada, item.status]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [{ wch: 38 }, { wch: 24 }, { wch: 34 }, { wch: 16 }];

  // Formata valores monetários da primeira seção.
  [5, 6, 7].forEach((rowNumber) => {
    const cell = worksheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: 1 })];
    if (cell) cell.z = '"R$" #,##0.00';
  });

  return worksheet;
}

/**
 * Adiciona congelamento da primeira linha e cabeçalho visual ao XLSX gerado.
 * O SheetJS Community não escreve estilos/painéis; o ajuste é feito no próprio pacote ZIP.
 */
function polishXlsx(buffer, workbook, sheetsToPolish) {
  try {
    const cfb = CFB.read(buffer, { type: 'buffer' });
    const stylesEntry = CFB.find(cfb, '/xl/styles.xml');
    let headerStyle = 1;

    if (stylesEntry) {
      let styles = stylesEntry.content.toString('utf8');
      const fontsMatch = styles.match(/<fonts count="(\d+)"/);
      const fillsMatch = styles.match(/<fills count="(\d+)"/);
      const xfsMatch = styles.match(/<cellXfs count="(\d+)"/);
      if (fontsMatch && fillsMatch && xfsMatch) {
        const fontCount = Number(fontsMatch[1]);
        const fillCount = Number(fillsMatch[1]);
        const xfCount = Number(xfsMatch[1]);
        headerStyle = xfCount;

        styles = styles
          .replace(`<fonts count="${fontCount}"`, `<fonts count="${fontCount + 1}"`)
          .replace(
            '</fonts>',
            '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/><family val="2"/></font></fonts>',
          )
          .replace(`<fills count="${fillCount}"`, `<fills count="${fillCount + 1}"`)
          .replace(
            '</fills>',
            '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3864"/><bgColor indexed="64"/></patternFill></fill></fills>',
          )
          .replace(`<cellXfs count="${xfCount}"`, `<cellXfs count="${xfCount + 1}"`)
          .replace(
            '</cellXfs>',
            `<xf numFmtId="0" fontId="${fontCount}" fillId="${fillCount}" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf></cellXfs>`,
          );

        stylesEntry.content = Buffer.from(styles, 'utf8');
      }
    }

    workbook.SheetNames.forEach((sheetName, index) => {
      const target = CFB.find(cfb, `/xl/worksheets/sheet${index + 1}.xml`);
      if (!target) return;
      let xml = target.content.toString('utf8');

      if (sheetsToPolish.includes(sheetName)) {
        // Congela a linha 1 (A2 como primeira célula editável).
        if (!xml.includes('state="frozen"')) {
          xml = xml.replace(
            /<sheetView([^>]*)\/>/,
            '<sheetView$1><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/></sheetView>',
          );
        }
        // Aplica o estilo de cabeçalho criado acima.
        xml = xml.replace(/(<row r="1"[^>]*>)([\s\S]*?)(<\/row>)/, (_match, open, inner, close) => {
          const styled = inner.replace(/<c(?=[ >])/g, `<c s="${headerStyle}"`);
          return open + styled + close;
        });
      }

      target.content = Buffer.from(xml, 'utf8');
    });

    return CFB.write(cfb, { type: 'buffer', fileType: 'zip' });
  } catch (error) {
    // Nunca impede a exportação: sem o ajuste, o arquivo continua válido.
    console.warn('[export] Não foi possível aplicar acabamento no XLSX:', error.message);
    return buffer;
  }
}

/** Monta o XLSX com as abas Contratos, Arquivos e Resumo. */
export function buildXlsx(contracts, files) {
  const workbook = XLSX.utils.book_new();
  const contractsSheet = createContractsSheet(contracts);
  const filesSheet = createFilesSheet(files, contracts);
  const summarySheet = createSummarySheet(contracts, files);

  XLSX.utils.book_append_sheet(workbook, contractsSheet, 'Contratos');
  XLSX.utils.book_append_sheet(workbook, filesSheet, 'Arquivos');
  XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumo');

  workbook.Props = {
    Title: 'Base de contratos',
    Subject: 'Exportação do sistema de gestão de contratos',
    Author: 'Contrata - Gestão de Contratos',
    CreatedDate: new Date(),
  };

  const buffer = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    cellDates: true,
    compression: true,
  });

  return polishXlsx(buffer, workbook, ['Contratos', 'Arquivos']);
}

export function exportDateStamp(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export { CONTRACT_COLUMNS, FILE_COLUMNS, STATUS_COLORS };
