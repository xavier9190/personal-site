# Graph Report - personal-site  (2026-11-12)

## Corpus Check
- 127 files · ~54,168 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: (none) 2, .example 1, .woff2 1)

## Summary
- 854 nodes · 2419 edges · 43 communities (28 shown, 15 thin omitted)
- Extraction: 92% EXTRACTED · 8% INFERRED · 0% AMBIGUOUS · INFERRED: 201 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `fe02d296`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- finances/service.ts
- ShoppingService
- ShoppingDashboardClient.tsx
- package.json
- Grupo 1 — Transversal, Plataforma e Design System Sketch (`PLAT`)
- next
- CalendarClient.tsx
- definitions.ts
- academic/service.ts
- logic.ts
- shopping/service.ts
- AcademicDashboardClient.tsx
- cn
- BillsModal.tsx
- calendar/service.ts
- SketchButton
- CalendarService
- stream/route.ts
- Plano de Implementação — Personal Site (Hub Pessoal Integrado)
- compilerOptions
- AcademicService
- ChatService
- ChatConversation.tsx
- dates.ts
- EmptyState
- Spec: Personal Site (Hub Pessoal Integrado)
- AppDatabase
- Agent skills
- Domain Docs
- Issue tracker: GitHub
- Personal Site
- triage-labels.md
- 0001-projecao-unificada-calendario.md
- 0002-integracao-compras-financas.md
- 0003-modelo-financeiro-contas-cartoes-parcelas.md
- 0005-calendario-custom-grid-local.md
- 0006-design-system-sketch-e-responsividade-mobile.md
- 0007-stack-tecnica-sqlite-sem-seed.md
- postcss.config.mjs
- README.md
- 01-fundacao-sketch-navegacao-sqlite.md
- 08-chat-tools-crud-confirmacao-anexos-voz.md

## God Nodes (most connected - your core abstractions)
1. `FinancesService` - 61 edges
2. `CalendarService` - 41 edges
3. `SketchButton()` - 37 edges
4. `ChatService` - 34 edges
5. `ShoppingService` - 33 edges
6. `AcademicService` - 32 edges
7. `cn()` - 30 edges
8. `toRecifeDateString()` - 29 edges
9. `react` - 28 edges
10. `FinancesRepository` - 27 edges

## Surprising Connections (you probably didn't know these)
- `Implementation Decisions` --references--> `CalendarService`  [INFERRED]
  .scratch/personal-site/spec.md → src/features/calendar/service.ts
- `8.2. Estratégia de Testes (The Seam)` --references--> `AcademicService`  [INFERRED]
  docs/implementation-plan.md → src/features/academic/service.ts
- `04: Acadêmico — Projetos em Andamento/Acabados, Links Customizáveis e Modal com Timeline de Marcos (`[OK]`)` --references--> `AcademicService`  [INFERRED]
  .scratch/personal-site/issues/04-academico-projetos-links-modal-marcos.md → src/features/academic/service.ts
- `Testing Decisions` --references--> `AcademicService`  [INFERRED]
  .scratch/personal-site/spec.md → src/features/academic/service.ts
- `8.2. Estratégia de Testes (The Seam)` --references--> `CalendarService`  [INFERRED]
  docs/implementation-plan.md → src/features/calendar/service.ts

## Import Cycles
- None detected.

## Communities (43 total, 15 thin omitted)

### Community 0 - "finances/service.ts"
Cohesion: 0.05
Nodes (56): 02: Finanças (Parte 1) — Transações (Entradas/Saídas), Filtros e Card de Saldo (com Olho de Privacidade), 05: Compras & Entregas — Wishlist, Fluxo `Comprei ✓` (com Modal `[SIM / NÃO]` para Finanças), `A Caminho` e `Chegou!`, dynamic, FinancasPage(), VALID_PERIODS, ChatPage(), detectToolIntent(), buildNewCreditCard() (+48 more)

### Community 1 - "ShoppingService"
Cohesion: 0.06
Nodes (27): 6. Estratégia de IA (Antigravity SDK + Tool Calling), ComprasPage(), buildNewMilestoneRecord(), buildNewProjectRecord(), buildUpdatedMilestoneRecord(), buildUpdatedProjectRecord(), mapProjectView(), MilestoneTimelineProps (+19 more)

### Community 2 - "ShoppingDashboardClient.tsx"
Cohesion: 0.08
Nodes (51): dynamic, ChatRightPanel(), ChatRightPanelProps, sourceLabel(), ActionResult, createTransactionAction(), deleteTransactionAction(), toggleHideBalanceAction() (+43 more)

### Community 3 - "package.json"
Cohesion: 0.05
Nodes (51): dependencies, better-sqlite3@^13.0.3, clsx@^2.1.1, date-fns@^4.1.0, @date-fns/tz@^1.2.0, drizzle-orm@^0.45.4, @google/genai@^3.2.0, lucide-react@^0.475.0 (+43 more)

### Community 4 - "Grupo 1 — Transversal, Plataforma e Design System Sketch (`PLAT`)"
Cohesion: 0.05
Nodes (40): Grupo 1 — Transversal, Plataforma e Design System Sketch (`PLAT`), Grupo 2 — Módulo `Finanças` (`FIN`), Grupo 3 — Módulo `Acadêmico` (`ACAD`), Grupo 4 — Módulo `Compras & Entregas` (`SHOP`), Grupo 5 — Módulo `Calendário` (`CAL`), Grupo 6 — Módulo `Chat & IA` (`CHAT`), `US-ACAD-01` — Listagem Separada em `Projetos em Andamento` e `Projetos Já Acabados`, `US-ACAD-02` — Criação e Edição de Projeto Acadêmico com Links Customizáveis (`GitHub ↗`, `Drive ↗`, etc.) (+32 more)

### Community 5 - "next"
Cohesion: 0.11
Nodes (23): nextConfig, next, POST(), excalifont, metadata, RootLayout(), viewport, AppSidebar() (+15 more)

### Community 6 - "CalendarClient.tsx"
Cohesion: 0.17
Nodes (31): CalendarioPage(), dynamic, listCalendarItemsAction(), CalendarClient(), AgendaView(), dayNum(), ItemChip(), MiniMonth() (+23 more)

### Community 7 - "definitions.ts"
Cohesion: 0.06
Nodes (33): addMilestoneSchema, addWishlistItemSchema, calendarColors, completeProjectSchema, createCalendarEventSchema, createInstallmentPlanSchema, createPayableBillSchema, createProjectSchema (+25 more)

### Community 8 - "academic/service.ts"
Cohesion: 0.18
Nodes (23): ConfirmDeleteModal(), ConfirmDeleteModalProps, SketchModal(), ActionResult, addMilestoneAction(), completeProjectAction(), deleteMilestoneAction(), deleteProjectAction() (+15 more)

### Community 9 - "logic.ts"
Cohesion: 0.14
Nodes (25): CalendarActionResult, createEventAction(), deleteEventAction(), run(), updateEventAction(), EventForm(), addDaysPure(), CalendarItemSource (+17 more)

### Community 10 - "shopping/service.ts"
Cohesion: 0.15
Nodes (12): vitest, createDbClient(), getDb(), MIGRATIONS_FOLDER, base, setup(), AddMessageInput, ChatThreadRecord (+4 more)

### Community 11 - "AcademicDashboardClient.tsx"
Cohesion: 0.14
Nodes (14): AcademicoPage(), dynamic, createProjectAction(), updateProjectAction(), AcademicDashboardClient(), AcademicDashboardClientProps, ProjectCard(), ProjectCardProps (+6 more)

### Community 12 - "cn"
Cohesion: 0.16
Nodes (15): lucide-react, PinAccessForm(), PinAccessPage(), SketchBadge(), SketchBadgeProps, CALENDAR_EVENT_COLOR_CLASS, SketchCard(), SketchCardProps (+7 more)

### Community 13 - "BillsModal.tsx"
Cohesion: 0.17
Nodes (20): advanceInstallmentAction(), BillActionResult, BillFormPayload, CardFormPayload, createPayableBillAction(), deleteInstallmentPlanAction(), deletePayableBillAction(), InstallmentFormPayload (+12 more)

### Community 14 - "calendar/service.ts"
Cohesion: 0.15
Nodes (15): drizzle-orm, academicProjects, projectLinks, projectMilestones, calendarEvents, SEMANTIC, chatMessages, chatThreads (+7 more)

### Community 15 - "SketchButton"
Cohesion: 0.21
Nodes (11): react, SketchButton(), createInstallmentPlanAction(), CategorySelector(), CategorySelectorProps, FinancesDashboardClient(), PERIOD_LABELS, FixedBillsSection() (+3 more)

### Community 16 - "CalendarService"
Cohesion: 0.18
Nodes (9): 06: Calendário — 5 Visões em CSS Grid (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`), Eventos e Projeção Unificada, 07: Chat (Parte 1) — Interface de Conversa, Painel Rápido Direito e Streaming com Antigravity SDK, CalendarClientProps, EventFormModalProps, CalendarItem, CalendarEventRecord, CalendarService, datePart() (+1 more)

### Community 17 - "stream/route.ts"
Cohesion: 0.18
Nodes (11): Arquitetura de IA com Antigravity SDK e Tool Calling sobre Services Compartilhados, 10. Riscos e Mitigações, 3. Arquitetura e Stack Decididas (com Alternativas Descartadas), dynamic, ChatAttachment, DetectedToolIntent, AntigravityAIProvider, AIMessageInput (+3 more)

### Community 18 - "Plano de Implementação — Personal Site (Hub Pessoal Integrado)"
Cohesion: 0.10
Nodes (19): 1. Visão Geral, 2.1. Dentro do Escopo (In-Scope), 2.2. Fora do Escopo (Out-of-Scope), 2. Escopo e Não-Escopo, 4. Estrutura de Pastas, 5.1. Módulo `Calendário`, 5.2. Módulo `Finanças`, 5.3. Módulo `Acadêmico` (+11 more)

### Community 19 - "compilerOptions"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 20 - "AcademicService"
Cohesion: 0.28
Nodes (8): 04: Acadêmico — Projetos em Andamento/Acabados, Links Customizáveis e Modal com Timeline de Marcos (`[OK]`), AcademicService, cancelPendingAction(), ChatToolDispatcher, confirmPendingAction(), executeChatTool(), undoChatAction(), setup()

### Community 22 - "ChatConversation.tsx"
Cohesion: 0.32
Nodes (12): ActionResult, cancelPendingActionAction(), clearThreadMessagesAction(), confirmPendingActionAction(), createNewThreadAction(), executeDirectToolAction(), revalidateAllModules(), undoActionAction() (+4 more)

### Community 23 - "dates.ts"
Cohesion: 0.31
Nodes (8): dynamic, buildChatContext(), APP_TIMEZONE, daysBetweenPureDates(), parseBRDateToPureDate(), PureDateString, toRecifeDateString(), toRecifeTimeHHMM()

### Community 24 - "EmptyState"
Cohesion: 0.26
Nodes (10): EmptyState(), EmptyStateProps, SketchAddButton(), SketchAddButtonProps, SketchButtonProps, createCreditCardAction(), deleteCreditCardAction(), CreditCardsModal() (+2 more)

### Community 25 - "Spec: Personal Site (Hub Pessoal Integrado)"
Cohesion: 0.22
Nodes (8): Further Notes, Implementation Decisions, Out of Scope, Problem Statement, Solution, Spec: Personal Site (Hub Pessoal Integrado), Testing Decisions, User Stories

### Community 27 - "Agent skills"
Cohesion: 0.33
Nodes (5): Agent skills, Domain docs, Issue tracker, Personal Site, Triage labels

### Community 28 - "Domain Docs"
Cohesion: 0.33
Nodes (5): Before exploring, read these, Domain Docs, File structure, Flag ADR conflicts, Use the glossary's vocabulary

### Community 29 - "Issue tracker: GitHub"
Cohesion: 0.33
Nodes (5): Conventions, Issue tracker: GitHub, Pull requests as a triage surface, When a skill says "fetch the relevant ticket", When a skill says "publish to the issue tracker"

## Knowledge Gaps
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `FinancesService` connect `finances/service.ts` to `ShoppingService`, `ShoppingDashboardClient.tsx`, `shopping/service.ts`, `BillsModal.tsx`, `CalendarService`, `stream/route.ts`, `Plano de Implementação — Personal Site (Hub Pessoal Integrado)`, `AcademicService`, `ChatService`, `dates.ts`, `Spec: Personal Site (Hub Pessoal Integrado)`, `AppDatabase`?**
  _High betweenness centrality (0.076) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `FinancesService` (e.g. with `8.2. Estratégia de Testes (The Seam)` and `02: Finanças (Parte 1) — Transações (Entradas/Saídas), Filtros e Card de Saldo (com Olho de Privacidade)`) actually correct?**
  _`FinancesService` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `finances/service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05193171608265948 - nodes in this community are weakly interconnected._
- **Why does `next` connect `next` to `ShoppingDashboardClient.tsx`, `package.json`, `CalendarClient.tsx`, `academic/service.ts`, `logic.ts`, `shopping/service.ts`, `cn`, `BillsModal.tsx`, `SketchButton`, `stream/route.ts`, `ChatConversation.tsx`?**
  _High betweenness centrality (0.071) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `CalendarService` (e.g. with `8.2. Estratégia de Testes (The Seam)` and `06: Calendário — 5 Visões em CSS Grid (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`), Eventos e Projeção Unificada`) actually correct?**
  _`CalendarService` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `ShoppingService` be split into smaller, more focused modules?**
  _Cohesion score 0.05759623861298854 - nodes in this community are weakly interconnected._
- **Why does `ChatService` connect `ChatService` to `finances/service.ts`, `ShoppingService`, `ShoppingDashboardClient.tsx`, `shopping/service.ts`, `stream/route.ts`, `Plano de Implementação — Personal Site (Hub Pessoal Integrado)`, `AcademicService`, `ChatConversation.tsx`, `Spec: Personal Site (Hub Pessoal Integrado)`, `AppDatabase`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._