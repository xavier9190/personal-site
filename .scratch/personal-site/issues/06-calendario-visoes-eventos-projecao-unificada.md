# 06: Calendário — 5 Visões em CSS Grid (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`), Eventos e Projeção Unificada

**What to build:** O módulo `Calendário` completo e 100% local (CSS Grid customizado + `date-fns`): criação, edição e exclusão de `Eventos de Agenda` com as 4 cores da paleta (para diferenciar início/fim de reuniões e eventos concorrentes lado a lado na grade de 24h) e recorrência (`Diária`, `Semanal`, `Mensal`), seletor suspenso das 5 visões (`Dia`, `Semana`, `Mês`, `Ano` e `Programação`), navegação `< Hoje >`, coluna direita com Mini-Calendário mensal (marcadores `o`) e `Agendas de Hoje`, e **Projeção Unificada** automática dos prazos de `Acadêmico`, vencimentos de `Finanças` e previsões de entrega de `Compras`.

**Blocked by:** 03: Finanças (Parte 2) — Contas a Pagar, Cartões de Crédito, Parcelas a Pagar e KPIs (`A Pagar` e `Previsto`), 04: Acadêmico — Projetos em Andamento/Acabados, Links Customizáveis e Modal com Timeline de Marcos (`[OK]`), 05: Compras & Entregas — Wishlist, Fluxo `Comprei ✓` (com Modal `[SIM / NÃO]` para Finanças), `A Caminho` e `Chegou!`

**Status:** ready-for-agent

- [ ] O menu dropdown no cabeçalho alterna entre as 5 visões (`Dia`, `Semana`, `Mês`, `Ano` e `Programação`) e os botões `< Hoje >` navegam pelas datas respeitando o fuso `America/Recife`.
- [ ] As visões `Dia` e `Semana` exibem grade horária de 24h (`00:00`–`23:59`) com rolagem vertical, renderizando blocos coloridos (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`) para diferenciar reuniões e posicionando eventos sobrepostos lado a lado sem ocultá-los.
- [ ] Permite criar, editar e excluir `Eventos de Agenda` com suporte a repetição (`Não se repete`, `Diariamente`, `Semanalmente`, `Mensalmente`).
- [ ] O `CalendarService` projeta automaticamente, sem duplicar tabelas no banco, os marcos e entregas finais de `Acadêmico`, os vencimentos de contas/faturas de `Finanças` e as datas estimadas de chegada de `Compras`.
- [ ] A coluna direita exibe o Mini-Calendário mensal com marcadores `o` nos dias que possuem eventos/prazos e a lista `Agendas de Hoje` (adaptando-se em botão recolhível + lista inferior no mobile).
- [ ] Testes de integração contra SQLite `:memory:` verificam a projeção unificada dos 4 módulos, a expansão de recorrência e a detecção de conflitos de horário.
