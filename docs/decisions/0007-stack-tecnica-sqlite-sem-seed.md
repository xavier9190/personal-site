# Stack Técnica (Next.js + SQLite/Drizzle) e Banco Inicial Limpo (Sem Seed)

> **Superseded (persistência):** O motor de persistência SQLite (`better-sqlite3`) foi substituído por Supabase PostgreSQL + RLS + PGlite na [ADR 0008](./0008-migracao-supabase-postgresql-rls-pglite.md). Os invariantes de banco 100% vazio sem *seed*, valores em centavos (`integer`) e fuso `America/Recife` permanecem vigentes.

A aplicação utiliza Next.js (App Router) com TypeScript, Tailwind CSS e primitivos `shadcn/ui` customizados para o tema Sketch, persistindo dados localmente em SQLite (`better-sqlite3`) com Drizzle ORM e validação Zod. Valores monetários são salvos em centavos (`integer`) e datas em UTC exibidas no fuso `America/Recife`. O banco de dados é inicializado 100% vazio (sem dados de *seed* pré-populados), exibindo estados vazios (*empty states*) estilo sketch em cada módulo para que todos os dados reais sejam inseridos pelo próprio usuário.
