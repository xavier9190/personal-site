# 03: FinanÃ§as (Parte 2) â€” Contas a Pagar, CartÃµes de CrÃ©dito, Parcelas a Pagar e KPIs (`A Pagar` e `Previsto`)

**What to build:** A gestÃ£o completa de obrigaÃ§Ãµes financeiras no mÃ³dulo `FinanÃ§as`: cadastro e baixa de `Contas a Pagar` (incluindo **Contas Fixas** recorrentes, **Fatura do CartÃ£o de CrÃ©dito** e **DÃ­vidas avulsas a pessoas**), cadastro de `CartÃµes de CrÃ©dito` (fechamento e vencimento), painel lateral `Parcelas a Pagar` no formato `ITEM N/TOTAL â€” FALTAM X DE R$ Y,YY`, e cÃ¡lculo dos cards `A Pagar` (`Faltam N contas`) e `Previsto` (`Saldo - A Pagar`).

**Blocked by:** 02: FinanÃ§as (Parte 1) â€” TransaÃ§Ãµes (Entradas/SaÃ­das), Filtros e Card de Saldo (com Olho de Privacidade)

**Status:** done

- [x] Permite cadastrar, editar e marcar como `Pago` ou `Falta Pagar` as `Contas a Pagar` do mÃªs (Contas Fixas recorrentes, Faturas de CartÃ£o e DÃ­vidas a terceiros).
- [x] Permite cadastrar `CartÃµes de CrÃ©dito` e `Planos de Parcelamento` (vinculados a um cartÃ£o ou avulsos), exibindo-os na coluna direita `Parcelas a Pagar` exatamente no formato `NOME N/TOTAL` com subtÃ­tulo `FALTAM X DE R$ Y,YY` (onde `X = Total - Pagas`).
- [x] Parcelas vinculadas a um cartÃ£o de crÃ©dito consolidam seu valor mensal dentro da fatura daquele cartÃ£o em `Contas a Pagar`, sem somar duas vezes no card `A Pagar`.
- [x] Os 3 cards do topo de `FinanÃ§as` exibem em tempo real: `Saldo`, `A Pagar` (com soma das pendÃªncias do perÃ­odo e subtÃ­tulo `"FALTAM N CONTAS"`) e `Previsto` (`Saldo - A Pagar`).
- [x] No mobile, um controle segmentado permite alternar facilmente entre `Ãšltimas TransaÃ§Ãµes` e `Parcelas a Pagar`.
- [x] Testes de integraÃ§Ã£o contra SQLite `:memory:` validam a matemÃ¡tica de `Saldo`, `A Pagar`, `Previsto`, baixa de contas e agregaÃ§Ã£o de parcelas na fatura do cartÃ£o.
