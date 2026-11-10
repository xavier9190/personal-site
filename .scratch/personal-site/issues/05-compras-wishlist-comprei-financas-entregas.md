# 05: Compras & Entregas — Wishlist, Fluxo `Comprei ✓` (com Modal `[SIM / NÃO]` para Finanças), `A Caminho` e `Chegou!`

**What to build:** O módulo `Compras & Entregas` completo e integrado ao módulo `Finanças`: carrossel horizontal `Quero Comprar (Wishlist)`, fluxo do botão `Comprei ✓` que coleta a data estimada de entrega + app da compra (`Mercado Livre`, `AliExpress`, `Shopee`, etc.) e pergunta em um modal **"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS? [SIM / NÃO]"** (criando a transação ou parcelamento em `Finanças` quando `Não`), carrossel `Já Comprei (A Caminho)` com barra de progresso por data e alerta vermelho `(!)` para entregas atrasadas, e botão `Chegou!` com histórico de entregues.

**Blocked by:** 03: Finanças (Parte 2) — Contas a Pagar, Cartões de Crédito, Parcelas a Pagar e KPIs (`A Pagar` e `Previsto`)

**Status:** ready-for-agent

- [ ] O carrossel `Quero Comprar (Wishlist)` exibe os itens desejados com nome, preço em `R$`, botão `Link ↗` e botão `Comprei ✓`.
- [ ] Clicar em `Comprei ✓` (ou adicionar diretamente um item comprado) solicita a `Data Estimada de Chegada` e o `App que comprei`, e exibe o modal de confirmação `"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS?"` com opções `[SIM]` e `[NÃO]`.
- [ ] Quando o usuário responde `[SIM]`, o item move-se para `Já Comprei (A Caminho)` sem gerar registros em `Finanças`; quando responde `[NÃO]`, coleta a forma de pagamento (à vista ou parcelado) e cria automaticamente a `Transação` ou `Plano de Parcelamento` correspondente no `FinancesService`.
- [ ] Os cards em `Já Comprei (A Caminho)` exibem a contagem regressiva e data prevista (`FALTA N DIAS (DD/MM)`), barra de progresso hachurada proporcional ao tempo decorrido, nome do app da compra e o alerta **`(!)` em vermelho (`#ffc9c9`)** caso a data atual ultrapasse o prazo estimado sem entrega confirmada.
- [ ] Clicar em `Chegou!` marca o item como entregue, remove-o do carrossel `Já Comprei (A Caminho)` e disponibiliza-o no modal de histórico de entregues (com opção de reverter).
- [ ] Testes de integração contra SQLite `:memory:` validam ambos os ramos (`[SIM]` e `[NÃO]`) da integração `Compras → Finanças`, o cálculo de atraso `(!)` e o arquivamento via `Chegou!`.
