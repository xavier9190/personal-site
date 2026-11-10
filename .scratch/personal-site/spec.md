# Spec: Personal Site (Hub Pessoal Integrado)

**Status:** `ready-for-agent`

## Problem Statement

O usuário precisa gerenciar sua rotina diária — compromissos de agenda, finanças pessoais (transações, contas fixas, cartões de crédito e compras parceladas), projetos acadêmicos da faculdade (com prazos, integrantes, links e marcos) e compras/entregas (wishlist e encomendas em trânsito) — em um único webapp pessoal *single-user* que rode localmente, seja responsivo no celular, siga fielmente o Design System Sketch escuro dos seus 7 wireframes (`Excalifont` em `CAPSLOCK`) e permita operar 100% das funções tanto pela interface visual quanto conversando com um assistente de IA no Chat.

## Solution

Construir uma aplicação web modular em **Next.js (App Router) + TypeScript + Tailwind CSS + SQLite (Drizzle ORM)** com tema escuro estilo Sketch (`#121212` fundo, `#1e1e1e` superfícies, `#f1f3f5` traço/texto e paleta de 4 cores `#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`) e fonte `Excalifont` sempre em `UPPERCASE`.

Toda a lógica de negócio dos 5 módulos (`Chat`, `Calendário`, `Finanças`, `Acadêmico`, `Compras`) fica concentrada em uma camada de **Services** compartilhada:
- A interface gráfica consome os *services* diretamente (funcionando 100% sem IA).
- O módulo `Chat` conecta-se ao **Antigravity SDK (`google-antigravity`)** e expõe *tools* que invocam os mesmos *services* para ler, criar, editar (com opção `[DESFAZER]`) e excluir (com confirmação obrigatória `[CONFIRMAR / CANCELAR]`) registros em qualquer módulo.
- O `Calendário` realiza uma **Projeção Unificada** automática dos prazos de `Acadêmico`, vencimentos de `Finanças` e entregas de `Compras`.
- O fluxo `Comprei ✓` em `Compras` pergunta se o usuário já lançou o gasto em `Finanças` (`[SIM / NÃO]`) antes de criar a transação ou plano de parcelamento automaticamente.

## User Stories

1. Como usuário, quero que toda a interface utilize o estilo visual Sketch escuro (`#121212` e `#1e1e1e`) com a fonte `Excalifont` exclusivamente em `CAPSLOCK` e a paleta de 4 cores suaves (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`), para que o sistema seja 100% fiel aos meus wireframes.
2. Como usuário, quero navegar entre os 5 módulos (`Chat`, `Calendário`, `Finanças`, `Acadêmico`, `Compras`) através de uma Sidebar compartilhada no desktop e uma `Bottom Navigation Bar` no celular alimentadas por um registro central de módulos, para alternar de contexto rapidamente.
3. Como usuário, quero que todas as telas (exceto `Chat`) exibam um botão padronizado `+ ADICIONAR` no canto superior direito, para criar novos registros de forma consistente.
4. Como usuário, quero que o banco SQLite inicie 100% vazio (sem dados de seed) e exiba *Empty States* estilo sketch quando não houver registros, para que todos os dados sejam reais e inseridos por mim.
5. Como usuário, quero que todos os valores monetários sejam salvos em centavos inteiros (`R$` formatado em `pt-BR`) e todas as datas respeitem o fuso `America/Recife`, para evitar erros de arredondamento ou deslocamento de datas.
6. Como usuário, quero ver no topo de `Finanças` os cards `Saldo`, `A Pagar` (`Faltam N contas`) e `Previsto` filtrados por período (`Este Mês`, etc.), para saber quanto tenho disponível e quanto sobrará após quitar as pendências do mês.
7. Como usuário, quero ocultar ou exibir o valor do `Saldo` clicando no ícone de olho (em `Finanças` e no `Chat`), para ter privacidade ao usar o sistema perto de outras pessoas.
8. Como usuário, quero adicionar, editar, filtrar (por `Data` e `Categoria`) e excluir transações de entrada (linhas verdes `#b2f2bb`) e saída (linhas vermelhas `#ffc9c9`), para registrar meu fluxo de caixa.
9. Como usuário, quero cadastrar e dar baixa em `Contas a Pagar` — abrangendo **Contas Fixas** recorrentes, **Fatura do Cartão de Crédito** e **Dívidas a terceiros** — para alimentar o card `A Pagar` e as listas `Falta Pagar` e `Pago` no painel direito do Chat.
10. Como usuário, quero cadastrar meus cartões de crédito e visualizar minhas compras parceladas na coluna `Parcelas a Pagar` no formato `ITEM N/TOTAL — FALTAM X DE R$ Y,YY`, agregando as parcelas do cartão na fatura mensal sem duplicar valores em `A Pagar`.
11. Como usuário, quero visualizar meus projetos da faculdade separados em `Projetos em Andamento` e `Projetos Já Acabados`, com botões de atalho customizáveis (`GitHub ↗`, `Drive ↗`, etc.), para organizar meus trabalhos acadêmicos.
12. Como usuário, quero clicar num card de projeto acadêmico para abrir o modal de detalhes (destacando o card ao fundo com borda tracejada) exibindo `Data da Entrega Final`, `Grupo` e a linha do tempo de `Marcos Importantes` com selo `[OK]` interativo.
13. Como usuário, quero concluir ou reabrir projetos acadêmicos para movê-los entre `Projetos em Andamento` e `Projetos Já Acabados`.
14. Como usuário, quero gerenciar minha `Quero Comprar (Wishlist)` em um carrossel horizontal com nome, preço e link externo.
15. Como usuário, quero clicar em `Comprei ✓` num item da Wishlist, informar a data estimada de entrega e o app da compra (`Mercado Livre`, `AliExpress`, `Shopee`), e responder ao modal `"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS? [SIM / NÃO]"` para que o gasto seja criado em `Finanças` apenas quando eu responder `Não`.
16. Como usuário, quero acompanhar minhas encomendas no carrossel `Já Comprei (A Caminho)` com contagem regressiva de dias, barra de progresso por data, alerta vermelho `(!)` quando atrasado e botão `Chegou!` (que move para o histórico de entregues).
17. Como usuário, quero alternar o `Calendário` entre as 5 visões (`Dia`, `Semana`, `Mês`, `Ano` e `Programação`), navegar com `< Hoje >` e visualizar o Mini-Calendário com marcadores `o` e a lista `Agendas de Hoje` na coluna direita.
18. Como usuário, quero criar, editar e excluir eventos na agenda (com suporte a recorrência e eventos sobrepostos lado a lado) usando as 4 cores da paleta para diferenciar onde começa e termina cada reunião.
19. Como usuário, quero que o `Calendário` e o painel `Próximas Agendas` do `Chat` projetem automaticamente os marcos/entregas de `Acadêmico`, os vencimentos de `Finanças` e as previsões de entrega de `Compras`.
20. Como usuário, quero conversar com a IA no `Chat` (usando o **Antigravity SDK**) para ler, criar, atualizar (com botão `[DESFAZER]`) e excluir (com confirmação obrigatória `[CONFIRMAR / CANCELAR]`) dados de qualquer módulo, incluindo suporte a anexos (clipe) e ditado por voz (microfone).

*(A especificação detalhada com critérios Dado/Quando/Então e comportamento mobile de todas as histórias encontra-se em [docs/user-stories.md](file:///C:/Users/pedro/Desktop/personal-site/docs/user-stories.md)).*

## Implementation Decisions

- **Arquitetura Modular por Features:** Cada domínio (`chat`, `calendar`, `finances`, `academic`, `shopping`) é isolado com seu próprio `schema`, `repository`, `service`, `tools` e `components`, registrados em um `Module Registry` central para a Sidebar/BottomNav.
- **Camada de Services Compartilhada (UI + IA):** Os componentes React e as *tools* do Chat chamam exatamente os mesmos métodos de *service* validados por Zod.
- **Projeção Unificada do Calendário (ADR-0001):** O `CalendarService` agrega em leitura os eventos próprios (`calendar_events`) e os prazos de `Acadêmico`, `Finanças` e `Compras`.
- **Integração Compras → Finanças (ADR-0002):** Modal explícito `[SIM / NÃO]` pergunta se o gasto já foi lançado antes de criar a transação à vista ou o plano de parcelamento em `Finanças`.
- **Modelo Financeiro Consolidado (ADR-0003):** `Contas a Pagar` unifica Contas Fixas, Fatura do Cartão e Dívidas a pessoas; `Planos de Parcelamento` em cartão somam na fatura do respectivo cartão sem duplicar no card `A Pagar`. Dinheiro salvo em centavos (`integer`).
- **IA via Antigravity SDK com Guardrails (ADR-0004):** Worker local conectado ao `google-antigravity` SDK; mutações simples geram snapshot de `[DESFAZER]` e exclusões exigem confirmação `[CONFIRMAR / CANCELAR]`.
- **Calendário Customizado em CSS Grid (ADR-0005):** Construído com CSS Grid + `date-fns` (`America/Recife`) sem bibliotecas engessadas de terceiros e sem Google Calendar.
- **Design System Sketch & Mobile (ADR-0006):** Fonte `Excalifont` em `CAPSLOCK`, cores `#121212` / `#1e1e1e` / `#f1f3f5` + 4 pastéis (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`), Sidebar no desktop e `Bottom Navigation Bar` + abas alternáveis no mobile.
- **Banco SQLite sem Seed (ADR-0007):** Inicialização 100% limpa com estados vazios estilo sketch.

## Testing Decisions

- **O que define um bom teste:** Testar exclusivamente o comportamento externo observável através da fronteira pública dos módulos, nunca detalhes internos de implementação ou mocks de SQL.
- **Seam Principal de Testes (Camada de Services + SQLite `:memory:`):**
  - Todos os 5 *services* (`FinancesService`, `AcademicService`, `ShoppingService`, `CalendarService`, `ChatService`) e o despacho de *tools* da IA serão testados com `Vitest` rodando contra uma instância real do **SQLite em memória (`:memory:`)** com o schema Drizzle aplicado.
  - Um único *seam* valida regras de cálculo financeiro em centavos, fluxo condicional `Comprei ✓ → Finanças`, projeção unificada de datas no Calendário e guardrails de confirmação/undo das tools do Chat.

## Out of Scope

- Sincronização com Google Calendar (no MVP e no futuro).
- Integrações externas pagas/complexas com bancos (Open Finance), APIs de transportadoras/Correios ou API do GitHub.
- Dados fictícios de *seed* pré-cadastrados.
- Autenticação multi-usuário em nuvem.

## Further Notes

- Documentação completa gerada em [docs/implementation-plan.md](file:///C:/Users/pedro/Desktop/personal-site/docs/implementation-plan.md), [docs/user-stories.md](file:///C:/Users/pedro/Desktop/personal-site/docs/user-stories.md) e [docs/decisions/](file:///C:/Users/pedro/Desktop/personal-site/docs/decisions).
