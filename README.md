# Contrata · Gestão de Contratos

Sistema de gestão de contratos em **pt-BR** com front-end em HTML/CSS/JavaScript puro (sem framework e sem build), API local em **Express**, persistência em **JSON** e camada de dados trocável para **Supabase** em uma linha.

---

## Começando rápido

```bash
# 1. Instale as dependências
npm install      # neste ambiente PowerShell use: npm.cmd install

# 2. Gere o banco de dados fictício (opcional se data/db.json já existir)
npm run seed

# 3. Inicie o servidor
npm start        # porta 3000

# 4. Acesse
# http://localhost:3000
```

Não é necessária configuração extra. O sistema roda em **modo local (JSON)** por padrão.

### Credenciais de acesso

| Usuário | Senha | Perfil |
|---------|-------|--------|
| `admin` | `admin123` | admin |

O login é único, a sessão é por token (válido por 8h) armazenado em `localStorage` no cliente e em memória no servidor. A senha é validada **apenas no servidor** (hash scrypt). Nunca valide a senha no front-end.

---

## Telas

- **Painel** (`/`): cartões de indicadores, próximos vencimentos e gráfico CSS/SVG.
- **Contratos** (`/#/contratos`): grade estilo Excel com edição inline e autosave, navegação por teclado (Enter/Esc/setas), ordenação, filtros por coluna, busca global, colunas redimensionáveis/ocultáveis, datas/status/valores tipados, destaques por vencimento, totais no rodapé e validações.
- **Arquivos** (`/#/arquivos`): biblioteca de documentos com busca, filtros por contrato/categoria e envio vinculado a um contrato.
- **Exportar** (`/#/exportar`): exportação de "Toda a base" ou "Somente filtrados" em CSV (UTF-8 + BOM, separador `;`, datas em formato BR) e XLSX (SheetJS, abas Contratos, Arquivos e Resumo, cabeçalho congelado e estilo).
- **Agente** (`/#/chat`): assistente conversacional sobre contratos, fornecedores, vencimentos e anexos, acessível também pelo **balão flutuante** no canto inferior direito. Responde com dados reais da base (sem chamada a IA externa).

### Contratos — edição inline

- Duplo clique em uma célula (ou Enter) inicia a edição.
- Enter salva (autosave via adapter), Esc cancela.
- Setas navegam entre células.

### Anexos

- Upload por arrasta-e-solta ou clique, também na ficha do contrato.
- Limite de **20 MB** por arquivo.
- Extensões perigosas bloqueadas (`.exe`, `.bat`, `.js`, `.php`, etc.).
- Download, preview (PDF e imagem) e exclusão.

---

## Estrutura do projeto

```
contratos/
├── server.js                 # API REST, auth, uploads, exportação, estáticos
├── package.json              # dependências: express, multer, cors, xlsx
├── .gitignore
├── README.md
├── scripts/
│   └── seed.js               # gera data/db.json, hash scrypt, PDFs/PNG placeholders
├── tests/                    # suíte automatizada (node --test, sem dependências)
│   ├── catalog.test.js       # listas/parsers compartilhados front ⇄ back
│   ├── validation.test.js    # regras de contrato e numeração
│   ├── files.test.js         # segurança de anexos (extensões, paths)
│   ├── export.test.js        # CSV e XLSX (3 abas)
│   ├── auth.test.js          # scrypt e sessões
│   ├── state.test.js         # IDs opacos (numérico JSON e UUID Supabase)
│   └── adapters.test.js      # paridade de interface entre adapters
├── data/
│   └── db.json               # banco fictício (users, contracts, files, meta)
├── server/
│   ├── db.js                 # persistência atômica JSON + IDs
│   ├── auth.js               # scrypt, sessões, middleware de autenticação
│   ├── validation.js         # regras de contrato, número único, datas, valores
│   ├── files.js              # sanitização, extensões permitidas/bloqueadas, caminhos
│   └── export.js             # CSV (BOM, ';', datas BR) e XLSX (SheetJS + CFB)
├── storage/uploads/          # anexos enviados (organizados por contrato)
└── public/
    ├── index.html            # shell da aplicação (router por hash)
    ├── login.html            # tela de login
    ├── css/styles.css        # todos os estilos (grade, modais, drawer, responsivo)
    └── js/
        ├── app.js            # router, navegação, sessão, logout
        ├── login.js
        ├── config.js         # CONFIG.ADAPTER ('json' | 'supabase')
        ├── shared/
        │   └── catalog.js    # fonte única de listas/limites/validadores (front ⇄ back)
        ├── constants.js      # listas compartilhadas (status, tipos, categorias, limites)
        ├── icons.js
        ├── utils.js          # formatação, datas, moeda, extensão, situação do contrato
        ├── toast.js
        ├── modal.js
        ├── filePreview.js    # preview e download de arquivo
        ├── contractDrawer.js # ficha do contrato + anexos
        ├── state.js          # estado reativo (contratos, arquivos, filtros)
        ├── errors.js         # ApiError / AuthError
        ├── data/
        │   ├── adapter.js    # fachada única; troca JSON↔Supabase em 1 linha
        │   ├── jsonAdapter.js# camada de fetch autenticado (JSON)
        │   └── supabaseAdapter.js  # esqueleto comentado (Supabase)
        └── views/
            ├── dashboard.js
            ├── contracts.js  # grade estilo planilha (maior risco de bugs)
            ├── files.js
            └── export.js
```

---

## Camada de dados trocável (JSON → Supabase)

Todo acesso a dados passa pelo `adapter` (`public/js/data/adapter.js`). A implementação ativa é escolhida por `CONFIG.ADAPTER` em `public/js/config.js`.

Para trocar para Supabase, basta alterar uma linha:

```js
// public/js/config.js
export const CONFIG = { ADAPTER: 'supabase' }; // era 'json'
```

O `SupabaseAdapter` (`public/js/data/supabaseAdapter.js`) é um esqueleto comentado com a mesma assinatura do `JsonAdapter` (login, logout, listContracts, createContract, uploadFile, exportData, etc.), prontopara ser preenchido com as chamadas ao cliente Supabase.

---

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm start` | Inicia o servidor na porta 3000 |
| `npm run dev` | Inicia com `--watch` (reinício automático) |
| `npm run seed` | Gera `data/db.json` (18 contratos, 6 fornecedores, 10 anexos) e arquivos fictícios |
| `npm test` | Roda a suíte automatizada (`node --test tests/`, sem dependências extras) |

### Testes automatizados

A suíte cobre: catálogo compartilhado entre front e back, regras de validação,
segurança de anexos (extensões bloqueadas, path traversal, sanitização de nomes),
exportação CSV/XLSX, hash scrypt/sessões, IDs opacos (funciona com número no JSON
e UUID no Supabase) e paridade de interface entre os adapters.

```
npm test
```

---

## Testes de aceitação (smoke test)

1. `npm install && npm start`
2. Abra `http://localhost:3000` → login com `admin` / `admin123`.
3. Painel: cartões, próximos vencimentos e gráfico carregam.
4. Contratos: 18 linhas, duplo clique para editar, Enter salva, Esc cancela, filtro/status/colunas funcionam.
5. Ficha do contrato: upload de anexo (PDF/PNG), preview, download, exclusão.
6. Arquivos: biblioteca, busca e filtros.
7. Exportar: CSV e XLSX baixam corretamente (3 abas no XLSX).
8. Recarregar a página: dados persistem em `data/db.json`.

O back-end foi validado com 25 verificações (login, sessão, CRUD, validações, upload/download/preview, exclusão, bloqueio `.exe`, CSV BOM/`;`, XLSX ZIP válido com 3 abas/freeze/cabeçalho, export filtrado, logout).

---

## Tecnologias

- **Front-end**: HTML5, CSS3, JavaScript vanilla (ES modules), sem build.
- **Back-end**: Node.js + Express.
- **Dependências**: `express`, `multer`, `cors`, `xlsx` (SheetJS CE).
- **Banco**: JSON (`data/db.json`), troca para Supabase via adapter.

---

## Migração para Supabase (JSON → Supabase em 1 linha)

Todo acesso a dados passa pelo `adapter` (`public/js/data/adapter.js`). A implementação ativa é escolhida por `CONFIG.ADAPTER` em `public/js/config.js`.

### O que é necessário do Supabase

Do painel do Supabase (**Project Settings > API**), anote:

| Informação | Exemplo | Onde configurar no sistema |
|------------|---------|----------------------------|
| Project URL | `https://abcdefghijklmnop.supabase.co` | `CONFIG.SUPABASE.URL` |
| Anon Public Key | `eyJhbGciOiJ...` | `CONFIG.SUPABASE.ANON_KEY` |
| Bucket Storage | `contract-files` | `CONFIG.SUPABASE.BUCKET` |

Você pode injetar esses valores por variáveis de ambiente (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) ou preencher diretamente em `public/js/config.js`. Nunca commite a `service_role key`.

### Passos da migração

1. Execute o SQL abaixo no **SQL Editor** do Supabase para criar as tabelas.
2. Crie o bucket privado `contract-files` no **Storage** (ou via SQL).
3. Preencha `CONFIG.SUPABASE.URL` e `CONFIG.SUPABASE.ANON_KEY`.
4. Troque uma linha em `public/js/config.js`:

```js
export const CONFIG = {
  ADAPTER: 'supabase', // era 'json'
  // ...
};
```

5. No front, o login passa a usar **e-mail/senha** via Supabase Auth (`loginWithEmail`). O campo "usuário" da tela de login funciona como e-mail nesse modo.

### SQL de criação das tabelas

```sql
CREATE TABLE IF NOT EXISTS public.contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text UNIQUE NOT NULL,
  objeto text NOT NULL,
  contratada text NOT NULL,
  cnpj text,
  tipo text,
  setor_responsavel text,
  gestor text,
  valor_total numeric DEFAULT 0,
  valor_mensal numeric DEFAULT 0,
  data_assinatura date,
  data_inicio date,
  data_fim date,
  status text,
  forma_reajuste text,
  indice_reajuste text,
  observacoes text,
  criado_em timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  nome_original text NOT NULL,
  nome_salvo text NOT NULL,
  tipo text,
  tamanho bigint,
  categoria text,
  criado_por uuid REFERENCES auth.users(id),
  enviado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_files_contrato_id ON public.files(contrato_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON public.contracts(status);
CREATE INDEX IF NOT EXISTS idx_contracts_data_fim ON public.contracts(data_fim);

ALTER TABLE public.contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir leitura a autenticados" ON public.contracts FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gravação a autenticados" ON public.contracts FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Permitir leitura de arquivos a autenticados" ON public.files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Permitir gravação de arquivos a autenticados" ON public.files FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

> O bucket `contract-files` deve ser **privado**. O adapter usa `createSignedUrl` para download/preview (URL expira em 30 min).

### Licença

Uso interno / demonstração.
