/**
 * SupabaseAdapter — implementação de produção.
 *
 * Preencha CONFIG.SUPABASE em js/config.js com as credenciais do seu projeto.
 *
 * Pré-requisitos:
 *   1. Tabelas `contracts` e `files` criadas no Postgres do Supabase (ver README/SQL).
 *   2. Bucket privado `contract-files` no Storage com políticas RLS.
 *   3. Supabase Auth configurado (login via e-mail/senha ou magic link).
 */

import { NotImplementedError, ApiError, AuthError } from './errors.js';

const SUPABASE_CDN = 'https://esm.sh/@supabase/supabase-js@2';

const TOKEN_KEY = 'contrata.token';

let createClient = null;

async function carregarSupabase() {
  if (createClient) return createClient;
  const modulo = await import(SUPABASE_CDN);
  createClient = modulo.createClient;
  return createClient;
}

export class SupabaseAdapter {
  constructor({ URL, ANON_KEY, BUCKET } = {}) {
    this.url = URL;
    this.anonKey = ANON_KEY;
    this.bucket = BUCKET || 'contract-files';
    this.client = null;
  }

  get token() {
    try {
      return window.localStorage.getItem(TOKEN_KEY) || '';
    } catch {
      return '';
    }
  }

  isAuthenticated() {
    return Boolean(this.token);
  }

  async _ensureClient() {
    if (!this.client) {
      const createClientFn = await carregarSupabase();
      if (!this.url || !this.anonKey) {
        throw new ApiError('Credenciais do Supabase não configuradas em js/config.js.');
      }
      this.client = createClientFn(this.url, this.anonKey);
    }
    return this.client;
  }

  /* ------------------------------ Sessão ------------------------------ */

  async login(_usuario, _senha) {
    throw new AuthError(
      'O login no modo Supabase usa Supabase Auth (e-mail/senha), não usuário local.',
    );
  }

  async loginWithEmail(email, senha) {
    const client = await this._ensureClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password: senha });
    if (error) throw new AuthError(error.message || 'Falha no login.', { status: 401 });
    if (!data.user) throw new AuthError('Usuário não retornado.', { status: 401 });
    this._saveToken(data.session?.access_token || '');
    return {
      usuario: {
        id: data.user.id,
        nome: data.user.email,
        email: data.user.email,
        perfil: 'admin',
      },
      token: data.session?.access_token || '',
    };
  }

  _saveToken(token) {
    try {
      window.localStorage.setItem(TOKEN_KEY, token);
    } catch {
      /* storage indisponível */
    }
  }

  async logout() {
    try {
      const client = await this._ensureClient();
      await client.auth.signOut();
    } catch {
      /* ignorar falha ao sair */
    }
    return { ok: true };
  }

  async getSession() {
    const client = await this._ensureClient();
    const { data } = await client.auth.getSession();
    const session = data?.session;
    const user = session?.user;
    if (!user) throw new AuthError('Sessão expirada.', { status: 401 });
    return {
      id: user.id,
      nome: user.email,
      email: user.email,
      perfil: 'admin',
    };
  }

  /* ---------------------------- Contratos ----------------------------- */

  async listContracts() {
    const client = await this._ensureClient();
    const { data, error } = await client
      .from('contracts')
      .select('*')
      .order('numero', { ascending: true });
    if (error) throw new ApiError(error.message || 'Erro ao listar contratos.', { status: 400 });
    return data || [];
  }

  async getContract(id) {
    const client = await this._ensureClient();
    const { data, error } = await client
      .from('contracts')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw new ApiError(error.message || 'Contrato não encontrado.', { status: 404 });
    return data;
  }

  async createContract(dados) {
    const client = await this._ensureClient();
    const payload = {
      ...dados,
      criado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    };
    const { data, error } = await client.from('contracts').insert(payload).select().single();
    if (error) throw new ApiError(error.message || 'Erro ao criar contrato.', { status: 400 });

    // Cria a "pasta" no Supabase Storage com a identificação da linha de contrato (CT-AAAA-NNN)
    if (data?.numero) {
      const folder = String(data.numero).replace(/[^a-zA-Z0-9._-]/g, '_');
      try {
        const keepFile = new Blob([''], { type: 'text/plain' });
        await client.storage.from(this.bucket).upload(`${folder}/.keep`, keepFile, {
          upsert: true,
        });
      } catch {
        // Falha não crítica se as permissões de storage forem restritas a arquivos com conteúdo
      }
    }

    return data;
  }

  async updateContract(id, alteracoes) {
    const client = await this._ensureClient();

    // Se o número do contrato mudou, renomeia a pasta de arquivos no Storage.
    if (alteracoes.numero !== undefined) {
      const novasPasta = String(alteracoes.numero).replace(/[^a-zA-Z0-9._-]/g, '_');
      const { data: arquivos } = await client
        .from('files')
        .select('id, nome_salvo')
        .eq('contrato_id', id);

      if (arquivos && arquivos.length) {
        for (const arquivo of arquivos) {
          const filename = arquivo.nome_salvo.split('/').pop();
          const novoNome = `${novasPasta}/${filename}`;
          // Supabase Storage: copia para novo caminho e remove o antigo.
          const { error: copyError } = await client.storage
            .from(this.bucket)
            .copy(arquivo.nome_salvo, novoNome);
          if (!copyError) {
            await client.storage.from(this.bucket).remove([arquivo.nome_salvo]);
            await client.from('files').update({ nome_salvo: novoNome }).eq('id', arquivo.id);
          }
          // Se a cópia falhar, mantém o arquivo na localização original — não aborta a edição.
        }
      }
    }

    const payload = {
      ...alteracoes,
      atualizado_em: new Date().toISOString(),
    };
    const { data, error } = await client
      .from('contracts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) throw new ApiError(error.message || 'Erro ao atualizar contrato.', { status: 400 });
    return data;
  }

  async deleteContract(id) {
    const client = await this._ensureClient();
    // Busca o número do contrato para remover também a pasta / .keep no Storage
    const { data: contrato } = await client.from('contracts').select('numero').eq('id', id).maybeSingle();
    const folder = contrato?.numero
      ? String(contrato.numero).replace(/[^a-zA-Z0-9._-]/g, '_')
      : String(id);

    // Primeiro remove arquivos vinculados ao contrato no Storage
    const { data: arquivos } = await client.from('files').select('nome_salvo').eq('contrato_id', id);
    const caminhos = (arquivos || []).map((a) => a.nome_salvo);
    if (folder) {
      caminhos.push(`${folder}/.keep`);
    }
    if (caminhos.length) {
      await client.storage.from(this.bucket).remove(caminhos);
    }
    const { error } = await client.from('contracts').delete().eq('id', id);
    if (error) throw new ApiError(error.message || 'Erro ao excluir contrato.', { status: 400 });
    return { ok: true };
  }

  /* ----------------------------- Arquivos ----------------------------- */

  async listFiles(filtros = {}) {
    const client = await this._ensureClient();
    let query = client.from('files').select('*').order('enviado_em', { ascending: false });
    if (filtros.contrato_id) {
      query = query.eq('contrato_id', filtros.contrato_id);
    }
    if (filtros.categoria) {
      query = query.eq('categoria', filtros.categoria);
    }
    const { data, error } = await query;
    if (error) throw new ApiError(error.message || 'Erro ao listar arquivos.', { status: 400 });
    return data || [];
  }

  async uploadFile({ contratoId, contratoNumero, categoria, file, onProgress }) {
    const client = await this._ensureClient();

    // Se o número do contrato não for fornecido diretamente, busca no banco pelo contratoId
    let folder = contratoNumero;
    if (!folder) {
      const { data: c } = await client.from('contracts').select('numero').eq('id', contratoId).maybeSingle();
      if (c?.numero) folder = c.numero;
    }

    // Usa o número do contrato como nome da pasta (ex: CT-2026-001/)
    // para que no Storage do Supabase fique estruturado como uma pasta por linha de contrato.
    const cleanFolder = (folder ? String(folder) : String(contratoId)).replace(/[^a-zA-Z0-9._-]/g, '_');
    const nomeSalvo = `${cleanFolder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // O SDK do Supabase não expõe progresso de upload — simulamos 0 → 50 antes e 100 ao concluir.
    onProgress?.(0);
    const progressTick = window.setInterval(() => onProgress?.(50), 400);

    let uploadError;
    try {
      ({ error: uploadError } = await client.storage
        .from(this.bucket)
        .upload(nomeSalvo, file, { upsert: false, cacheControl: '3600' }));
    } finally {
      window.clearInterval(progressTick);
    }

    onProgress?.(100);
    if (uploadError) throw new ApiError(uploadError.message || 'Erro no upload.', { status: 400 });

    const payload = {
      contrato_id: contratoId,
      nome_original: file.name,
      nome_salvo: nomeSalvo,
      tipo: file.type || 'application/octet-stream',
      tamanho: file.size,
      categoria: categoria || 'Outros',
      enviado_em: new Date().toISOString(),
    };
    const { data, error } = await client.from('files').insert(payload).select().single();
    if (error) throw new ApiError(error.message || 'Erro ao gravar metadados.', { status: 400 });
    return data;
  }

  async downloadFile(id) {
    const client = await this._ensureClient();
    const { data: arquivo, error: erroMeta } = await client
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    if (erroMeta || !arquivo) {
      throw new ApiError('Arquivo não encontrado.', { status: 404 });
    }
    const { data: blob, error: erroDownload } = await client.storage
      .from(this.bucket)
      .download(arquivo.nome_salvo);
    if (erroDownload || !blob) {
      throw new ApiError('Erro ao baixar arquivo.', { status: 400 });
    }
    return { blob, filename: arquivo.nome_original };
  }

  /** Resolve a URL assinada (30 min) para uso em iframe/img. */
  async viewFileUrl(id) {
    const client = await this._ensureClient();
    const { data: arquivo, error } = await client
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !arquivo) throw new ApiError('Arquivo não encontrado.', { status: 404 });
    const { data } = await client.storage
      .from(this.bucket)
      .createSignedUrl(arquivo.nome_salvo, 1800);
    if (data?.signedUrl) return data.signedUrl;
    throw new ApiError('Não foi possível gerar URL de visualização.', { status: 400 });
  }

  async deleteFile(id) {
    const client = await this._ensureClient();
    const { data: arquivo, error: erroMeta } = await client
      .from('files')
      .select('*')
      .eq('id', id)
      .single();
    if (erroMeta || !arquivo) {
      throw new ApiError('Arquivo não encontrado.', { status: 404 });
    }
    await client.storage.from(this.bucket).remove([arquivo.nome_salvo]);
    const { error } = await client.from('files').delete().eq('id', id);
    if (error) throw new ApiError(error.message || 'Erro ao excluir arquivo.', { status: 400 });
    return { ok: true };
  }

  /* ---------------------------- Exportação ---------------------------- */

  async exportData({ formato, escopo = 'all', ids = [] }) {
    if (!['csv', 'xlsx'].includes(formato)) {
      throw new ApiError('Formato de exportação inválido.');
    }
    const client = await this._ensureClient();

    let contratoQuery = client.from('contracts').select('*');
    if (escopo === 'filtered' && ids.length) {
      contratoQuery = contratoQuery.filter('id', 'in', `(${ids.join(',')})`);
    }
    const { data: contratos } = await contratoQuery.order('numero', { ascending: true });

    const { data: files } = await client.from('files').select('*').order('enviado_em', { ascending: false });

    // Gera CSV ou XLSX no navegador com SheetJS (mesma abordagem do server/export.js).
    const XLSX = await import('https://esm.sh/sheetjs@0.18.5');
    const gerarBlob = () => {
      if (formato === 'csv') {
        return this._csvBlob(contratos, files);
      }
      return this._xlsxBlob(XLSX.default, contratos, files);
    };
    const blob = gerarBlob();
    return {
      blob,
      filename: `contratos-${new Date().toISOString().slice(0, 10)}.${formato}`,
    };
  }

  /* ---------------------------- Internos ---------------------------- */

  _csvBlob(contratos, files) {
    const linhas = [];
    const cabecalho = [
      'numero','objeto','contratada','cnpj','tipo','setor_responsavel','gestor',
      'valor_total','valor_mensal','data_assinatura','data_inicio','data_fim','status',
      'forma_reajuste','indice_reajuste','observacoes',
    ];
    linhas.push(cabecalho.join(';'));
    for (const c of contratos || []) {
      linhas.push(
        cabecalho.map((k) => {
          let v = c[k] == null ? '' : String(c[k]);
          if (v.includes(';') || v.includes('"') || v.includes('\n')) {
            v = '"' + v.replace(/"/g, '""') + '"';
          }
          return v;
        }).join(';'),
      );
    }
    const texto = '\uFEFF' + linhas.join('\n'); // UTF-8 BOM
    return new Blob([texto], { type: 'text/csv;charset=utf-8' });
  }

  async _xlsxBlob(XLSX, contratos, files) {
    const wsContratos = XLSX.utils.json_to_sheet(contratos || []);
    const wsArquivos = XLSX.utils.json_to_sheet(files || []);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsContratos, 'Contratos');
    XLSX.utils.book_append_sheet(wb, wsArquivos, 'Arquivos');
    // Aba resumo simples
    const resumo = [
      { metrica: 'Total de contratos', valor: contratos ? contratos.length : 0 },
      { metrica: 'Total de arquivos', valor: files ? files.length : 0 },
    ];
    const wsResumo = XLSX.utils.json_to_sheet(resumo);
    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
}
