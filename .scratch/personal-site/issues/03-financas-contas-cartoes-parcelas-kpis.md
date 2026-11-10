# 03: Finanças (Parte 2) — Contas a Pagar, Cartões de Crédito, Parcelas a Pagar e KPIs (`A Pagar` e `Previsto`)

**What to build:** A gestão completa de obrigações financeiras no módulo `Finanças`: cadastro e baixa de `Contas a Pagar` (incluindo **Contas Fixas** recorrentes, **Fatura do Cartão de Crédito** e **Dívidas avulsas a pessoas**), cadastro de `Cartões de Crédito` (fechamento e vencimento), painel lateral `Parcelas a Pagar` no formato `ITEM N/TOTAL — FALTAM X DE R$ Y,YY`, e cálculo dos cards `A Pagar` (`Faltam N contas`) e `Previsto` (`Saldo - A Pagar`).

**Blocked by:** 02: Finanças (Parte 1) — Transações (Entradas/Saídas), Filtros e Card de Saldo (com Olho de Privacidade)

**Status:** ready-for-agent

- [ ] Permite cadastrar, editar e marcar como `Pago` ou `Falta Pagar` as `Contas a Pagar` do mês (Contas Fixas recorrentes, Faturas de Cartão e Dívidas a terceiros).
- [ ] Permite cadastrar `Cartões de Crédito` e `Planos de Parcelamento` (vinculados a um cartão ou avulsos), exibindo-os na coluna direita `Parcelas a Pagar` exatamente no formato `NOME N/TOTAL` com subtítulo `FALTAM X DE R$ Y,YY` (onde `X = Total - Pagas`).
- [ ] Parcelas vinculadas a um cartão de crédito consolidam seu valor mensal dentro da fatura daquele cartão em `Contas a Pagar`, sem somar duas vezes no card `A Pagar`.
- [ ] Os 3 cards do topo de `Finanças` exibem em tempo real: `Saldo`, `A Pagar` (com soma das pendências do período e subtítulo `"FALTAM N CONTAS"`) e `Previsto` (`Saldo - A Pagar`).
- [ ] No mobile, um controle segmentado permite alternar facilmente entre `Últimas Transações` e `Parcelas a Pagar`.
- [ ] Testes de integração contra SQLite `:memory:` validam a matemática de `Saldo`, `A Pagar`, `Previsto`, baixa de contas e agregação de parcelas na fatura do cartão.
