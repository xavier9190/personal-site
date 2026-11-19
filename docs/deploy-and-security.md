# Guia de Deploy e Segurança — Personal Site (Hub Pessoal)

Este documento descreve o passo a passo completo para provisionar o **Personal Site** em produção pública com acesso estritamente *single-user*, banco **Supabase (PostgreSQL + RLS)**, hospedagem serverless na **Vercel** e pipeline automatizado de **CI/CD no GitHub Actions**.

---

## 1. Provisionamento Seguro no Supabase (PostgreSQL + RLS)

1. **Criar o projeto no Supabase**
   - Acesse o dashboard do Supabase e crie um novo projeto PostgreSQL (região recomendada: `sa-east-1` / São Paulo para menor latência).
   - Guarde a senha do banco em um gerenciador de senhas; nunca a versione no repositório.

2. **Blindar a Data API pública (PostgREST) e validar RLS**
   - Como toda leitura e escrita do Hub Pessoal acontece exclusivamente pelo servidor Next.js autenticado, a Data API pública do Supabase **não deve expor nenhuma tabela**:
     - **Recomendado:** em *Project Settings → Data API*, desabilite a **Data API** (ou remova o schema `public` dos *Exposed schemas*).
     - **Defesa em profundidade (já garantida pelas migrations):** todas as 13 tabelas de domínio em `src/db/migrations-pg/` executam automaticamente `ENABLE ROW LEVEL SECURITY` e `REVOKE ALL ON TABLE ... FROM anon, authenticated`.
   - O script `npm run security:check` valida no CI que nenhuma nova tabela seja criada sem RLS e revogação de privilégios para `anon` e `authenticated`.

3. **Obter a Connection String do Transaction Pooler**
   - Em *Project Settings → Database → Connection string*, selecione **Transaction pooler** (Supavisor, porta `6543`) e adicione `?pgbouncer=true` ao final da URL:
     ```text
     postgresql://postgres.<project-ref>:<SENHA>@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
     ```
   - O cliente PostgreSQL da aplicação (`src/db/pg.ts`) já utiliza `prepare: false`, garantindo compatibilidade total com o *Transaction Pooler* em ambiente serverless.

4. **Migrations e invariante sem *seed***
   - As migrations são aplicadas automaticamente pelo CI/CD na branch `main` via `npm run db:migrate` (ou manualmente na primeira configuração apontando `DATABASE_URL`).
   - O banco inicia **100% vazio (zero seed)**, preservando o invariante de domínio documentado na ADR 0008.

---

## 2. Geração de `AUTH_SECRET` e Escolha de `APP_ACCESS_PIN`

1. **Gerar `AUTH_SECRET` criptograficamente seguro (256 bits / 64 hex chars)**
   - Via OpenSSL:
     ```bash
     openssl rand -hex 32
     ```
   - Ou via Node.js:
     ```bash
     node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
     ```

2. **Escolher `APP_ACCESS_PIN` forte**
   - Prefira uma frase-senha ou PIN longo alfanumérico (ex.: 16+ caracteres) em vez de PIN numérico curto.
   - A comparação é feita via digest SHA-256 em tempo constante, com rate limiting por IP (bloqueio `429 Too Many Requests` após 5 tentativas inválidas em 15 minutos).
   - **Revogação instantânea:** alterar `APP_ACCESS_PIN` ou `AUTH_SECRET` no servidor invalida automaticamente todas as sessões ativas em todos os dispositivos.

3. **Definir a janela de sessão ("X em X dias")**
   - `AUTH_SESSION_DAYS`: duração padrão em dias (recomendado `30`).
   - `AUTH_MAX_SESSION_DAYS`: teto rígido imposto no servidor (recomendado `90`). A tela de login permite escolher `7`, `30` ou `90` dias respeitando esse teto.

---

## 3. Configuração de Variáveis de Ambiente na Vercel

No painel da Vercel (*Project → Settings → Environment Variables*), configure todas as variáveis abaixo para o ambiente **Production** (e **Preview**, se desejar testar branches de PR):

| Variável | Obrigatória em Produção | Exemplo / Valor | Observação |
| --- | --- | --- | --- |
| `DATABASE_URL` | Sim | `postgresql://postgres:YOUR_PASSWORD@db.example.supabase.co:6543/postgres?pgbouncer=true` | URL do Transaction Pooler do Supabase (porta `6543`) |
| `AUTH_SECRET` | Sim | *(saída de `openssl rand -hex 32`)* | Segredo HMAC-SHA256 dos cookies de sessão |
| `APP_ACCESS_PIN` | Sim | *(senha mestre forte)* | Credencial única do proprietário |
| `AUTH_SESSION_DAYS` | Não (padrão `30`) | `30` | Duração padrão da sessão em dias |
| `AUTH_MAX_SESSION_DAYS` | Não (padrão `90`) | `90` | Limite máximo aceito pelo servidor |
| `GEMINI_API_KEY` | Para o módulo Chat IA | *(chave do Google AI Studio)* | Necessária para streaming do assistente Gemini |

> **Política Fail-Closed:** quando `NODE_ENV=production`, a ausência de `APP_ACCESS_PIN` ou `AUTH_SECRET` bloqueia 100% dos acessos às páginas, Server Actions e rotas privadas (`/api/*` retorna `401 Unauthorized`), impedindo que um erro de configuração exponha dados pessoais.

---

## 4. GitHub Actions Secrets e Branch Protection na `main`

O workflow `.github/workflows/ci-cd.yml` executa dois jobs:
1. **`security-and-tests`** (em Pull Requests para `main` e pushes na `main`): executa `npm ci`, `npm run security:check`, `npm audit --omit=dev --audit-level=high`, `npm run typecheck`, `npm test` (suíte completa em PGlite) e `npm run build`.
2. **`migrate-and-deploy`** (somente em `push` na `main`, após `security-and-tests` passar): executa `npm run db:migrate` no Supabase e faz o deploy de produção na Vercel via CLI (`vercel pull`, `vercel build --prod`, `vercel deploy --prebuilt --prod`).

### 4.1 Configurar GitHub Actions Secrets

Em *GitHub Repository → Settings → Secrets and variables → Actions → New repository secret*, adicione:

- `DATABASE_URL`: mesma connection string PostgreSQL do Supabase usada em produção.
- `VERCEL_TOKEN`: token pessoal criado em *Vercel → Account Settings → Tokens*.
- `VERCEL_ORG_ID`: ID da organização/conta (encontrado em `.vercel/project.json` após rodar `npx vercel link` localmente, ou em *Vercel → Team/Account Settings*).
- `VERCEL_PROJECT_ID`: ID do projeto (encontrado em `.vercel/project.json` ou em *Vercel → Project Settings → General*).

> **Segurança nos logs:** o workflow nunca imprime variáveis de segredo em stdout e usa `permissions: { contents: read }` (privilégio mínimo).

### 4.2 Ativar Branch Protection na `main`

Em *GitHub Repository → Settings → Branches* (ou *Rules → Rulesets*):
1. Crie uma regra para a branch `main`.
2. Habilite **Require a pull request before merging**.
3. Habilite **Require status checks to pass before merging** e selecione o check obrigatório:
   - **`security-and-tests`**
4. Opcionalmente, habilite **Do not allow bypassing the above settings** para garantir que nenhum commit chegue à `main` sem passar pela auditoria de segurança, testes e build.

---

## 5. Checklist de Verificação Pós-Deploy

Após o primeiro deploy na URL de produção, valide cada item abaixo:

- [ ] **Redirecionamento e bloqueio sem sessão:** abrir `/` em aba anônima redireciona para `/pin`; chamar `POST /api/chat/stream` sem cookie retorna `401 Unauthorized` em JSON.
- [ ] **Login com duração configurável (7 / 30 / 90 dias):** autenticar na tela `/pin` selecionando a duração desejada e confirmar nas DevTools que o cookie de sessão possui flags `HttpOnly`, `Secure`, `SameSite=Lax` e `Max-Age` correspondente.
- [ ] **Política Fail-Closed:** confirmar no painel da Vercel que `APP_ACCESS_PIN` e `AUTH_SECRET` estão definidos e, caso sejam removidos em ambiente de teste de produção, o app bloqueia acesso exibindo estado de configuração pendente.
- [ ] **Rate limiting:** confirmar que múltiplas tentativas de credencial incorreta retornam `429 Too Many Requests`.
- [ ] **Headers HTTP de segurança:** inspecionar `curl -I https://<seu-dominio>/pin` e verificar a presença de:
  - `X-Frame-Options: DENY`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `Strict-Transport-Security`
  - `X-Robots-Tag: noindex, nofollow, noarchive`
- [ ] **Anti-indexação (`/robots.txt`):** acessar `/robots.txt` e confirmar `User-agent: *` com `Disallow: /`.
- [ ] **Fallback offline (`/offline`) e Service Worker seguro:** abrir `/offline` e verificar a página estilo Sketch; confirmar no Application → Cache Storage das DevTools que apenas assets estáticos públicos são cacheados (nenhuma rota autenticada ou `/api/*`).
- [ ] **PWA instalável:** confirmar no Chrome/Android/iOS que o app pode ser instalado em modo `standalone` com ícones adequados e os 5 atalhos rápidos (*Chat IA*, *Calendário*, *Finanças*, *Acadêmico*, *Compras*).
- [ ] **Botão "TRANCAR HUB":** clicar em **TRANCAR HUB** (sidebar desktop ou navegação mobile) e confirmar que o cookie de sessão é removido imediatamente e o navegador retorna para `/pin`.
