# Plano de Implementação — Personal Site (Hub Pessoal Integrado)

## 1. Visão Geral

O **Personal Site** é um webapp pessoal *single-user* que centraliza a rotina diária em cinco módulos integrados: **Chat (Assistente de IA)**, **Calendário**, **Finanças**, **Acadêmico** e **Compras & Entregas**.

O sistema foi projetado sob duas premissas centrais:
1. **Estética Fiel ao Sketch (Excalidraw Dark):** Interface escura (`#121212` e `#1e1e1e`), traços claros (`#f1f3f5`), tipografia `Excalifont` aplicada globalmente em `CAPSLOCK` (`uppercase`), tamanhos e espaçamentos padronizados, e paleta semântica suave de 4 cores (`#b2f2bb` Verde, `#ffc9c9` Vermelho, `#a5d8ff` Azul, `#ffec99` Amarelo/Marrom).
2. **Paridade 100% entre UI e IA:** Toda a lógica de negócio reside em uma camada de **Services** compartilhada. O usuário pode operar 100% do sistema clicando na interface gráfica sem depender da IA, ou conversar com o **Chat** (via **Antigravity SDK**) para ler, adicionar, atualizar e excluir registros em qualquer módulo usando *tool calling* sobre os mesmos *services*.

---

## 2. Escopo e Não-Escopo

### 2.1. Dentro do Escopo (In-Scope)
- **Layout Global e Navegação:**
  - Sidebar esquerda compartilhada no desktop (layouts de 2 ou 3 colunas conforme a tela) e `Bottom Navigation Bar` fixa no celular (`< 768px`).
  - Registro centralizado de módulos (`Module Registry`) permitindo adicionar futuras abas sem refatorar o layout base.
  - Botão padronizado `+ ADICIONAR` no topo de todas as telas exceto `Chat`.
  - Banco de dados inicializado **100% vazio (sem seed)**, com estados vazios (*empty states*) estilo sketch em todos os módulos.
- **Módulo 1 — Chat (IA Central):**
  - Layout em 3 colunas: Sidebar | Chat central | Painel rápido direito (`Próximas Agendas`, `Saldo` com botão de olho para ocultar/exibir, `Falta Pagar` e `Pago`).
  - Integração com **Antigravity SDK (`google-antigravity`)** com streaming de texto, pensamentos e chamadas de ferramentas (*tool calls*).
  - Execução direta para leitura, criação e edição simples (exibindo card de resumo com botão `[DESFAZER]`), e confirmação obrigatória (`[CONFIRMAR] / [CANCELAR]`) para exclusões ou alterações destrutivas em massa.
  - Suporte a anexos multimodais (imagens/prints de comprovantes, PDFs de editais/cronogramas, CSV) e ditado por voz no navegador (`Web Speech API`).
  - Histórico de conversas persistido no SQLite.
- **Módulo 2 — Calendário:**
  - Layout em 3 colunas: Sidebar | Grade do Calendário com seletor dropdown de 5 visões (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`) e navegação `< Hoje >` | Painel direito com Mini-Calendário mensal (com marcadores `o` de eventos) e lista `Agendas de Hoje`.
  - **Projeção Unificada:** Exibe automaticamente tanto os **Eventos de Agenda** criados manualmente (com escolha das 4 cores para diferenciar início/fim e reuniões concorrentes) quanto **Itens Projetados na Agenda** vindos de `Acadêmico` (marcos e entregas finais), `Finanças` (vencimentos de contas/faturas) e `Compras` (previsão de entrega).
  - Grade de 24 horas (`00:00`–`23:59`) com scroll vertical e suporte a eventos sobrepostos lado a lado e recorrência (`Diária`, `Semanal`, `Mensal`).
- **Módulo 3 — Finanças:**
  - Layout em 2 colunas: Sidebar | Área principal com filtro de período (`Este Mês`, etc.), 3 cards de resumo (`Saldo`, `A Pagar` com contador `"Faltam N contas"`, `Previsto`), listagem de `Últimas Transações` coloridas em verde (`#b2f2bb`, entradas) ou vermelho (`#ffc9c9`, saídas) com filtros de `Data` e `Categoria`, e coluna lateral `Parcelas a Pagar`.
  - Gestão de **Contas a Pagar** abrangendo: **Contas Fixas** recorrentes, **Fatura do Cartão de Crédito** e **Dívidas avulsas a pessoas/terceiros**.
  - Gestão de **Cartões de Crédito** (fechamento/vencimento) e **Planos de Parcelamento** exibidos no formato `ITEM N/TOTAL — FALTAM X DE R$ Y,YY`, onde as parcelas do cartão somam na fatura do cartão sem duplicar no card `A Pagar`.
- **Módulo 4 — Acadêmico:**
  - Layout em 2 colunas: Sidebar | Área principal dividida em `Projetos em Andamento` (destaque normal) e `Projetos Já Acabados` (opacidade reduzida).
  - Cards com título, descrição curta e botões de links externos customizáveis (`GitHub ↗`, `Drive ↗`, `Figma ↗`, etc.).
  - Modal de detalhes com contorno tracejado no card selecionado, `Data da Entrega Final`, `Grupo` (integrantes) e linha do tempo vertical de `Marcos Importantes` com toggle interativo de `[OK]` e transição para concluído.
- **Módulo 5 — Compras & Entregas:**
  - Layout em 2 colunas: Sidebar | Área principal com duas seções em carrossel horizontal: `Quero Comprar (Wishlist)` e `Já Comprei (A Caminho)`.
  - Fluxo `Comprei ✓`: abre modal pedindo a `Data Estimada de Chegada` e `App da Compra` (`Mercado Livre`, `AliExpress`, `Shopee`, etc.) e pergunta explicitamente **"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS? [SIM] [NÃO]"**. Se `Não`, coleta pagamento (à vista ou parcelado) e cria o registro em `Finanças`.
  - Cards em `Já Comprei` com barra de progresso calculada por datas, alerta vermelho `(!)` quando atrasado, tag do app e botão `Chegou!` (que arquiva no histórico de entregues).

### 2.2. Fora do Escopo (Out-of-Scope)
- **Sincronização com Google Calendar / iCal externo:** Descartado em definitivo (calendário 100% próprio e local).
- **Integração com APIs bancárias (Open Finance) ou importação OFX complexa no MVP:** Lançamentos são feitos via UI, fluxo de Compras ou via Chat/anexo com IA.
- **APIs externas de rastreio de encomendas (Correios/transportadoras):** O progresso usa cálculo de datas locais e atalho para o app da loja.
- **Integração via API com GitHub/Google Drive:** Os botões nos cards acadêmicos funcionam como atalhos diretos (`↗`) para as URLs cadastradas.
- **Multi-usuário / SaaS em nuvem:** Aplicação estritamente *single-user* rodando localmente.
- **Dados de Seed automáticos:** O banco nasce limpo; apenas o usuário insere seus dados.

---

## 3. Arquitetura e Stack Decididas (com Alternativas Descartadas)

| Camada | Tecnologia Escolhida | Alternativas Descartadas e Motivo |
| :--- | :--- | :--- |
| **Framework Fullstack** | **Next.js (App Router) + TypeScript** | *Vite SPA + Express separado*: exigiria manter dois processos e duplicar contratos de tipos; com Next.js, Server Actions / Route Handlers acessam o SQLite no mesmo processo com tipagem ponta a ponta. |
| **Estilização e UI Base** | **Tailwind CSS + Primitivos `shadcn/ui` (Radix UI) + Fonte `Excalifont`** | *Material UI / Chakra UI / Ant Design*: trazem visual corporativo engessado que conflita com o estilo Sketch (Excalidraw). O Radix (`shadcn/ui`) fornece acessibilidade (modais, dropdowns, popovers) sem impor estética. |
| **Componente de Calendário** | **CSS Grid Customizado + `date-fns` (`@date-fns/tz`)** | *FullCalendar / react-big-calendar*: injetam CSS difícil de sobrescrever para o tema Sketch em uppercase, pesam no bundle e quebram a experiência mobile customizada. |
| **Banco de Dados & ORM** | **SQLite (`better-sqlite3` em WAL mode) + Drizzle ORM** | *PostgreSQL / Prisma*: Postgres exige Docker/serviço rodando em background; SQLite é um único arquivo (`data/personal.db`), com backup instantâneo e latência zero em `localhost`. Drizzle é mais leve e próximo de SQL que Prisma. |
| **Motor de IA (Chat)** | **Antigravity SDK (`google-antigravity`) via Bridge Local + Interface `AIProvider`** | *Chave paga direta da Anthropic/OpenAI como única opção*: o `google-antigravity` permite usar o runtime local autenticado do Antigravity sem custo adicional de API key, mantendo uma interface `AIProvider` caso queira plugar outra LLM no futuro. |
| **Validação e Contratos** | **Zod** | *Validação manual*: Zod valida formulários na UI, inputs nos *services* e gera automaticamente os schemas JSON das *tools* da IA. |
| **Voz (Microfone)** | **Web Speech API (`SpeechRecognition`) nativa do navegador** | *Whisper API paga em streaming contínuo*: adiciona latência e custo para um comando simples de ditado em português (`pt-BR`). |

---

## 4. Estrutura de Pastas

Arquitetura modular orientada a *features* (`src/features/<modulo>`), garantindo que nenhum arquivo fique gigante (limite recomendado de ~200 linhas por arquivo) e que novas abas possam ser adicionadas sem acoplamento:

```text
personal-site/
├── data/
│   └── .gitkeep                      # Onde personal.db (SQLite) será criado automaticamente
├── services/
│   └── ai-bridge/                    # Worker Python leve usando google-antigravity SDK
│       ├── main.py                   # Expõe endpoint local SSE para o Agent do Antigravity SDK
│       └── requirements.txt          # google-antigravity, fastapi, uvicorn
├── src/
│   ├── app/                          # Rotas Next.js (App Router)
│   │   ├── layout.tsx                # Carrega Excalifont, aplica UPPERCASE global e Sidebar/BottomNav
│   │   ├── page.tsx                  # Redireciona ou renderiza a aba inicial (Chat)
│   │   ├── calendario/page.tsx
│   │   ├── financas/page.tsx
│   │   ├── academico/page.tsx
│   │   ├── compras/page.tsx
│   │   └── api/
│   │       ├── chat/route.ts         # Proxy de streaming + despacho de tools para os services
│   │       └── tools/route.ts        # Endpoint interno para o agente invocar os services TS
│   ├── config/
│   │   └── modules.ts                # Module Registry (define abas da Sidebar, ícones, rotas)
│   ├── db/
│   │   ├── index.ts                  # Conexão better-sqlite3 + Drizzle (suporta :memory: em testes)
│   │   ├── schema.ts                 # Re-exporta todos os schemas das features
│   │   └── migrations/               # Migrações SQL geradas pelo drizzle-kit
│   ├── components/
│   │   ├── layout/                   # AppSidebar, MobileBottomNav, PageHeader (+ ADICIONAR)
│   │   └── sketch/                   # SketchCard, SketchButton, SketchModal, SketchBadge, EmptyState
│   ├── lib/
│   │   ├── currency.ts               # Conversão centavos <-> R$ (pt-BR)
│   │   ├── dates.ts                  # Helpers UTC <-> America/Recife (date-fns)
│   │   └── utils.ts
│   └── features/
│       ├── chat/
│       │   ├── components/           # ChatWindow, MessageBubble, AttachmentPicker, VoiceInputButton, QuickSummaryPanel, ToolConfirmationCard
│       │   ├── hooks/
│       │   ├── service.ts            # Orquestração de mensagens, histórico e confirmação de tools
│       │   ├── repository.ts
│       │   ├── schema.ts             # Tabelas chat_threads, chat_messages, pending_tool_actions
│       │   └── tools.ts              # Agregador de todas as tools dos 4 módulos para a IA
│       ├── calendar/
│       │   ├── components/           # CalendarHeader, DayWeekGrid, MonthGrid, YearGrid, ScheduleListView, MiniCalendar, TodayAgendaList, EventModal
│       │   ├── hooks/
│       │   ├── service.ts            # CRUD de Eventos + Projeção Unificada (Acadêmico, Finanças, Compras)
│       │   ├── repository.ts
│       │   ├── schema.ts             # Tabela calendar_events
│       │   └── tools.ts              # Tools de leitura/criação/edição/exclusão de eventos
│       ├── finances/
│       │   ├── components/           # FinanceKpiCards, TransactionsTable, InstallmentsPanel, BillsModal, CreditCardsModal, TransactionModal
│       │   ├── hooks/
│       │   ├── service.ts            # Cálculo de Saldo/A Pagar/Previsto, CRUD de Transações, Contas Fixas, Cartões e Parcelas
│       │   ├── repository.ts
│       │   ├── schema.ts             # Tabelas transactions, payable_bills, credit_cards, installment_plans
│       │   └── tools.ts              # Tools financeiras para o Chat
│       ├── academic/
│       │   ├── components/           # ProjectsGrid, ProjectCard, ProjectDetailsModal, MilestoneTimeline, ProjectFormModal
│       │   ├── hooks/
│       │   ├── service.ts            # CRUD de Projetos, Marcos ([OK]) e Links
│       │   ├── repository.ts
│       │   ├── schema.ts             # Tabelas academic_projects, project_milestones, project_links
│       │   └── tools.ts              # Tools acadêmicas para o Chat
│       └── shopping/
│           ├── components/           # WishlistCarousel, InTransitCarousel, PurchaseConfirmModal, FinancePromptModal, DeliveredHistoryModal
│           ├── hooks/
│           ├── service.ts            # CRUD de Compras, cálculo de progresso/atraso e integração com Finanças
│           ├── repository.ts
│           ├── schema.ts             # Tabela shopping_items
│           └── tools.ts              # Tools de compras/entregas para o Chat
```

---

## 5. Modelo de Dados (Entidades, Atributos e Relações)

Todos os IDs usam `text` (UUID/nanoid), datas são armazenadas em string ISO-8601 UTC (`YYYY-MM-DDTHH:mm:ss.sssZ` ou `YYYY-MM-DD` para datas puras) e valores monetários são armazenados como `integer` em **centavos** (ex.: `R$ 144,00` = `14400`).

### 5.1. Módulo `Calendário`
- **`calendar_events`** (`Evento de Agenda`):
  - `id` (PK), `title` (text), `description` (text, nullable)
  - `start_at` (text ISO UTC), `end_at` (text ISO UTC), `all_day` (boolean)
  - `color` (enum: `'green' | 'red' | 'blue' | 'yellow'`) — define a cor do bloco na grade para diferenciar início/fim de reuniões
  - `recurrence_rule` (enum: `'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY'`), `recurrence_until` (text, nullable)
  - `created_at`, `updated_at`

*(Nota: os `Itens Projetados na Agenda` não ficam duplicados em `calendar_events`; o `CalendarService.getUnifiedAgenda(range)` consulta `calendar_events` + `project_milestones` + `academic_projects` + `payable_bills` + `shopping_items` no período).*

### 5.2. Módulo `Finanças`
- **`credit_cards`** (`Cartão de Crédito`):
  - `id` (PK), `name` (text, ex.: `NUBANK`), `closing_day` (integer 1–31), `due_day` (integer 1–31), `limit_cents` (integer, nullable)
- **`installment_plans`** (`Plano de Parcelamento`):
  - `id` (PK), `description` (text, ex.: `MONITOR 144HZ`), `category` (text)
  - `total_installments` (integer, ex.: `4`), `paid_installments` (integer, ex.: `2`)
  - `installment_amount_cents` (integer, ex.: `14400` para `R$ 144,00`)
  - `credit_card_id` (FK -> `credit_cards.id`, nullable — se vinculado a cartão, compõe a fatura mensal do cartão; se nulo, gera conta parcelada avulsa)
  - `start_month` (text `YYYY-MM`), `shopping_item_id` (FK -> `shopping_items.id`, nullable)
- **`payable_bills`** (`Conta a Pagar`):
  - `id` (PK), `title` (text, ex.: `INTERNET`, `FATURA NUBANK`, `DEVO AO JOÃO`)
  - `bill_type` (enum: `'FIXED_RECURRING' | 'CREDIT_CARD_BILL' | 'DEBT_TO_PERSON' | 'SINGLE_BILL'`)
  - `amount_cents` (integer), `category` (text), `due_date` (text `YYYY-MM-DD`), `competence_month` (text `YYYY-MM`)
  - `status` (enum: `'PENDING' | 'PAID'`), `paid_at` (text, nullable)
  - `credit_card_id` (FK -> `credit_cards.id`, nullable)
- **`transactions`** (`Transação`):
  - `id` (PK), `type` (enum: `'INCOME' | 'EXPENSE'`)
  - `description` (text), `category` (text), `amount_cents` (integer)
  - `occurred_at` (text `YYYY-MM-DD`), `status` (enum: `'PAID' | 'PENDING'`)
  - `payable_bill_id` (FK -> `payable_bills.id`, nullable), `shopping_item_id` (FK -> `shopping_items.id`, nullable)
- **`finance_preferences`**:
  - `hide_balance` (boolean — controla o ícone de olho cortado no card `Saldo`).

### 5.3. Módulo `Acadêmico`
- **`academic_projects`** (`Projeto Acadêmico`):
  - `id` (PK), `title` (text), `description` (text)
  - `final_delivery_date` (text `YYYY-MM-DD`, nullable)
  - `group_members` (text JSON array, ex.: `["XAVIER", "LETICIA", "CAIO", "RUAN"]`)
  - `status` (enum: `'IN_PROGRESS' | 'COMPLETED'`)
  - `created_at`, `updated_at`
- **`project_milestones`** (`Marco de Projeto`):
  - `id` (PK), `project_id` (FK -> `academic_projects.id` ON DELETE CASCADE)
  - `title` (text), `due_date` (text `YYYY-MM-DD`), `is_completed` (boolean — selo `[OK]`), `sort_order` (integer)
- **`project_links`**:
  - `id` (PK), `project_id` (FK -> `academic_projects.id` ON DELETE CASCADE)
  - `label` (text, ex.: `GITHUB`, `DRIVE`, `FIGMA`), `url` (text)

### 5.4. Módulo `Compras & Entregas`
- **`shopping_items`** (`Item da Wishlist` / `Entrega em Trânsito`):
  - `id` (PK), `name` (text), `price_cents` (integer)
  - `product_url` (text, nullable)
  - `status` (enum: `'WISHLIST' | 'IN_TRANSIT' | 'DELIVERED'`)
  - `store_app` (text, nullable — ex.: `MERCADO LIVRE`, `ALIEXPRESS`, `SHOPEE`, `AMAZON`)
  - `tracking_url` (text, nullable)
  - `purchased_at` (text `YYYY-MM-DD`, nullable)
  - `estimated_delivery_date` (text `YYYY-MM-DD`, nullable)
  - `delivered_at` (text `YYYY-MM-DD`, nullable)

### 5.5. Módulo `Chat`
- **`chat_threads`**:
  - `id` (PK), `title` (text), `created_at`, `updated_at`
- **`chat_messages`**:
  - `id` (PK), `thread_id` (FK -> `chat_threads.id` ON DELETE CASCADE)
  - `role` (enum: `'USER' | 'ASSISTANT' | 'SYSTEM'`)
  - `content` (text), `attachments_json` (text JSON), `tool_calls_json` (text JSON)
  - `created_at`
- **`pending_tool_actions`**:
  - `id` (PK), `thread_id` (FK), `tool_name` (text), `args_json` (text JSON)
  - `status` (enum: `'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE'`)
  - `undo_snapshot_json` (text JSON, nullable — permite desfazer criações/edições diretas com 1 clique)

---

## 6. Estratégia de IA (Antigravity SDK + Tool Calling)

1. **Ponte com o Antigravity SDK (`google-antigravity`):**
   - O worker `services/ai-bridge/main.py` inicializa o `Agent(LocalAgentConfig(system_instructions=...))` do pacote oficial `google-antigravity`.
   - O `system_instructions` injeta a data/hora atual em `America/Recife`, o vocabulário do [GLOSSARY.md](file:///C:/Users/pedro/Desktop/personal-site/GLOSSARY.md) e as ferramentas disponíveis.
2. **Catálogo de Tools por Módulo (Paridade Total com os Services):**
   - **Calendário:** `calendar.listAgenda`, `calendar.createEvent`, `calendar.updateEvent`, `calendar.deleteEvent`.
   - **Finanças:** `finances.getSummary`, `finances.listTransactions`, `finances.createTransaction`, `finances.updateTransaction`, `finances.deleteTransaction`, `finances.manageBill`, `finances.markBillPaid`, `finances.manageInstallment`, `finances.manageCreditCard`.
   - **Acadêmico:** `academic.listProjects`, `academic.getProjectDetails`, `academic.createProject`, `academic.updateProject`, `academic.toggleMilestone`, `academic.manageMilestone`, `academic.completeProject`, `academic.deleteProject`.
   - **Compras:** `shopping.listItems`, `shopping.addWishlistItem`, `shopping.markAsPurchased`, `shopping.markAsDelivered`, `shopping.updateItem`, `shopping.deleteItem`.
3. **Política de Execução e Segurança (Guardrails):**
   - **Ações de Leitura, Criação e Atualização Individual:** Executadas imediatamente no banco e retornam um objeto estruturado para a UI renderizar um card no chat com botão `[DESFAZER]` (que restaura o `undo_snapshot_json`).
   - **Ações de Exclusão (`delete*`) ou Alteração em Lote:** Gravadas em `pending_tool_actions` com status `PENDING_CONFIRMATION`. O chat exibe um card `[CONFIRMAR EXCLUSÃO] / [CANCELAR]` e só executa o *service* após o clique do usuário ou confirmação explícita.
4. **Anexos e Voz:**
   - Anexos de imagem/PDF/CSV enviados pelo botão de clipe são salvos localmente em `data/uploads/` e passados ao agente para extração de transações, eventos ou marcos acadêmicos.
   - O botão de microfone usa `webkitSpeechRecognition` / `SpeechRecognition` (`lang = 'pt-BR'`) para transcrever a fala diretamente na caixa de mensagem.

---

## 7. Design System Sketch & Estratégia Responsiva/Mobile

### 7.1. Tokens Visuais (Fidelidade ao Wireframe)
- **Tipografia:** Fonte `Excalifont` carregada localmente (`next/font/local`), `text-transform: uppercase` em toda a aplicação (`body { text-transform: uppercase; }`), `letter-spacing: 0.04em`.
- **Paleta de Cores:**
  - `--bg-page`: `#121212` (Preto de fundo geral)
  - `--bg-surface`: `#1e1e1e` (Fundo de cards, modais, inputs e sidebar)
  - `--stroke-primary` / `--text-primary`: `#f1f3f5` (Branco suave para linhas do sketch e textos)
  - `--text-muted`: `#868e96` (Texto secundário e cards concluídos em `Projetos Já Acabados`)
  - `--accent-green`: `#b2f2bb` (Entradas financeiras, selo `[OK]`, botão `Comprei ✓` / `Chegou!`, eventos verdes)
  - `--accent-red`: `#ffc9c9` (Saídas financeiras, contas pendentes, alerta `(!)` de entrega atrasada, eventos vermelhos)
  - `--accent-blue`: `#a5d8ff` (Eventos azuis, links e destaques informativos)
  - `--accent-yellow`: `#ffec99` (Marcos acadêmicos, destaque tracejado de projeto selecionado, eventos amarelos/marrons)
- **Bordas Sketch:** Borda sólida/desenhada de `2px` com cantos levemente arredondados (`rounded-md`) e sombra dura sutil (`2px 2px 0px #f1f3f5` em elementos interativos e `border-dashed` para seleção de card ativo).

### 7.2. Comportamento Mobile (`< 768px`)
- **Navegação:** A Sidebar esquerda oculta-se e dá lugar a uma `Bottom Navigation Bar` fixa de 5 itens no rodapé.
- **Colunas Secundárias (3ª Coluna e Painéis Direitos):**
  - **Chat:** Toggle superior `[CHAT | RESUMO RÁPIDO]` alternando entre a conversa e os cards `Próximas Agendas` / `Finanças`.
  - **Calendário:** Botão compacto `[📅 MINI-CALENDÁRIO]` abre o seletor mensal em *popover/drawer*; a lista `Agendas de Hoje` empilha-se abaixo da grade diária.
  - **Finanças:** Os 3 KPIs (`Saldo`, `A Pagar`, `Previsto`) ficam em grade compacta no topo; um controle segmentado alterna entre `[TRANSAÇÕES | PARCELAS A PAGAR]`.
  - **Acadêmico:** A grade de 3 colunas passa para 1 coluna vertical; o modal de detalhes abre como *Bottom Sheet* ocupando 90% da tela.
  - **Compras:** Os carrosséis horizontais suportam *swipe* nativo com `scroll-snap-type: x mandatory`.

---

## 8. Convenções de Código e Estratégia de Testes

### 8.1. Convenções de Código
- **Arquivos pequenos e coesos:** Nenhum componente ou módulo deve ultrapassar ~200 linhas.
- **Zero regra de negócio em componentes React:** Componentes apenas exibem dados e disparam chamadas aos *services* (via Server Actions / hooks).
- **Moeda e Datas estritas:** Funções que lidam com dinheiro recebem e retornam `Cents` (`number` inteiro); funções de data recebem ISO strings e formatam sempre com `America/Recife`.

### 8.2. Estratégia de Testes (The Seam)
- **Seam Principal (Camada de Services + SQLite In-Memory):**
  - Seguindo a filosofia de *deep modules*, o ponto de teste primário (*seam*) é a interface pública de cada **Service** (`CalendarService`, `FinancesService`, `AcademicService`, `ShoppingService`, `ChatService`), instanciada contra um banco **SQLite real em memória (`:memory:`)** com as migrações do Drizzle aplicadas.
  - Isso testa o comportamento real ponta a ponta (regras de negócio + queries SQL + constraints + projeções cruzadas entre módulos + execução de tools da IA) em milissegundos, sem mocks frágeis de repositório.
- **Ferramental:** `Vitest` para testes de integração dos services e `Playwright` para fluxos visuais críticos na UI.

---

## 9. Plano de Execução em Fases / Fatias Verticais (Tracer Bullets)

Cada fatia vertical corta todas as camadas (Schema Drizzle → Service + Testes de Integração → UI Sketch Desktop/Mobile → Tools da IA):

1. **Fase 1 — Fundação Sketch, Layout Responsivo e Banco SQLite Limpo:**
   - Setup Next.js + Tailwind + `Excalifont` uppercase + tokens das 6 cores + SQLite/Drizzle + `Module Registry` + Sidebar Desktop / BottomNav Mobile + Empty States em todas as 5 rotas.
2. **Fase 2 — Módulo `Finanças` Completo:**
   - Schema, Service e UI para `Transações` (entradas verdes / saídas vermelhas + filtros Data/Categoria), `Contas a Pagar` (Contas Fixas, Fatura de Cartão e Dívidas a terceiros), `Cartões de Crédito`, `Parcelas a Pagar` (`N/Total — FALTAM X DE R$ Y`) e cálculo dos 3 KPIs (`Saldo` com olho de privacidade, `A Pagar`, `Previsto`).
3. **Fase 3 — Módulo `Acadêmico` Completo:**
   - Schema, Service e UI para `Projetos em Andamento` e `Projetos Já Acabados`, links customizáveis (`GitHub ↗`, `Drive ↗`, etc.), modal de detalhes com `Grupo`, `Data da Entrega Final`, timeline de `Marcos Importantes` com toggle `[OK]` e transição para concluído.
4. **Fase 4 — Módulo `Compras & Entregas` + Integração com `Finanças`:**
   - Schema, Service e UI para carrosséis `Quero Comprar (Wishlist)` e `Já Comprei (A Caminho)`, barra de progresso por data, alerta vermelho `(!)` de atraso, modal `Comprei ✓` com pergunta **"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS? [SIM / NÃO]"** (criando transação ou parcelamento em Finanças quando `Não`), e botão `Chegou!` com histórico de entregues.
5. **Fase 5 — Módulo `Calendário` + Projeção Unificada:**
   - Schema, Service e UI em CSS Grid para as 5 visões (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`), suporte a eventos concorrentes lado a lado, recorrência, Mini-Calendário com marcadores, lista `Agendas de Hoje` e projeção unificada automática dos prazos de `Acadêmico`, `Finanças` e `Compras`.
6. **Fase 6 — Módulo `Chat` + Antigravity SDK + Painel Rápido Direito:**
   - Painel direito do Chat (`Próximas Agendas`, `Saldo`, `Falta Pagar`, `Pago`), worker do **Antigravity SDK (`google-antigravity`)**, catálogo completo de *tools* de CRUD nos 4 módulos, confirmação `[CONFIRMAR / CANCELAR]` para exclusões, botão `[DESFAZER]` para criações/edições, upload de anexos (imagens/PDF/CSV) e ditado por voz (`Web Speech API`).

---

## 10. Riscos e Mitigações

| Risco | Impacto | Mitigação |
| :--- | :--- | :--- |
| **Legibilidade de textos em cores pastéis (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`)** | Médio | Quando o card/bloco usa fundo pastel sólido, o texto interno deve obrigatoriamente usar `#121212` (preto); quando o fundo é `#1e1e1e`, a cor pastel é aplicada na borda e no texto. |
| **Comunicação entre Next.js (Node) e Antigravity SDK (Python)** | Médio | Isolar o `ai-bridge` Python atrás da interface `AIProvider` com healthcheck automático e script `npm run dev` unificado (iniciando Next.js + bridge juntos). |
| **Ações acidentais da IA alterando dados financeiros ou apagando projetos** | Alto | Guardrail determinístico no `ChatService`: qualquer tool destrutiva (`delete*`) nunca executa direto no banco sem antes criar um `pending_tool_action` e receber confirmação explícita do usuário na UI. |
| **Fuso horário deslocando datas puras (`YYYY-MM-DD`) em 1 dia** | Alto | Datas puras (vencimentos, entregas, marcos) são salvas como `YYYY-MM-DD` sem conversão de hora UTC, e timestamps completos usam `America/Recife` de ponta a ponta. |
