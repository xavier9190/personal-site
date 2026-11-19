# Migração de Persistência para Supabase PostgreSQL, RLS e Seam de Testes PGlite

**Status:** Aceita (substitui a [ADR 0007](./0007-stack-tecnica-sqlite-sem-seed.md) no motor de banco de dados)

## Contexto

A aplicação originalmente persistia dados localmente em SQLite (`better-sqlite3`, arquivo `data/personal.db`), conforme a ADR 0007. Para habilitar o deploy público em infraestrutura *serverless* (Vercel), a dependência nativa `better-sqlite3` e o armazenamento em disco efêmero deixaram de ser viáveis.

## Decisão

1. **PostgreSQL gerenciado (Supabase) com Drizzle ORM (`drizzle-orm/pg-core`):**
   - Todas as 13 tabelas de domínio (`calendar_events`, `credit_cards`, `installment_plans`, `payable_bills`, `transactions`, `finance_preferences`, `academic_projects`, `project_milestones`, `project_links`, `shopping_items`, `chat_threads`, `chat_messages`, `pending_tool_actions`) são definidas em `drizzle-orm/pg-core` e migradas via `src/db/migrations-pg/` (`npm run db:migrate`).
   - O cliente de produção utiliza `postgres` (`drizzle-orm/postgres-js`) com `prepare: false` para compatibilidade com o *Transaction Pooler* (Supavisor) do Supabase.
2. **Segurança por padrão (Row Level Security):**
   - 100% das tabelas de domínio têm `ENABLE ROW LEVEL SECURITY` ativo e todos os privilégios revogados para os papéis `anon` e `authenticated` (`REVOKE ALL ON TABLE ... FROM anon, authenticated`), garantindo que nenhum acesso direto via PostgREST seja possível; toda leitura e escrita ocorre exclusivamente pelo servidor Next.js autenticado.
3. **Seam de testes em memória com `PGlite`:**
   - Toda a suíte automatizada (`Vitest`) executa contra `@electric-sql/pglite` em memória (`src/db/pglite-test.ts`), aplicando as mesmas migrações SQL reais do PostgreSQL sem depender de rede ou serviço externo.
4. **Remoção total do SQLite:**
   - `better-sqlite3`, `@types/better-sqlite3`, `drizzle-orm/sqlite-core`, as migrações SQLite antigas e `serverExternalPackages: ['better-sqlite3']` foram removidos por completo.

## Invariantes Preservados

- **Banco 100% vazio (zero seed):** o banco inicializa sem nenhum registro pré-populado, exibindo *empty states* estilo sketch em todos os módulos.
- **Valores monetários em centavos (`integer`):** nenhum valor financeiro usa ponto flutuante.
- **Fuso horário `America/Recife`:** datas puras `YYYY-MM-DD` e timestamps UTC exibidos no fuso `America/Recife`.
- **Operação 100% assíncrona (`async/await`):** todos os repositórios, serviços de domínio, Server Components (`force-dynamic`), Server Actions (protegidas por `requireSessionAuth()`) e a rota de streaming `/api/chat/stream` operam de forma assíncrona sobre PostgreSQL.
