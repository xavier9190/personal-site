# 02: Finanças (Parte 1) — Transações (Entradas/Saídas), Filtros e Card de Saldo (com Olho de Privacidade)

**What to build:** O fluxo ponta a ponta de gerenciamento de `Transações` e `Saldo` no módulo `Finanças`: cadastro, edição e exclusão de transações de entrada (linhas verdes `#b2f2bb`) e saída (linhas vermelhas `#ffc9c9`), filtragem combinada por período (`Este Mês`, etc.), `Data` e `Categoria`, e cálculo em tempo real do card `Saldo` no topo da tela com botão de olho para ocultar/exibir os valores monetários.

**Blocked by:** 01: Fundação Sketch, Shell de Navegação (Sidebar/BottomNav) e Infra SQLite Sem Seed

**Status:** ready-for-agent

- [ ] O botão `ADICIONAR +` na tela de `Finanças` permite registrar uma nova `Transação` (`Entrada` ou `Saída`) com data, descrição, categoria e valor em reais (armazenado em centavos).
- [ ] A tabela `Últimas Transações` exibe as entradas com destaque verde (`#b2f2bb`) e as saídas com destaque vermelho (`#ffc9c9`), permitindo editar ou excluir qualquer registro.
- [ ] Os seletores de período no topo (`Este Mês`, `Mês Passado`, `Próximo Mês`, `Todos`) e os filtros `Data v` e `Categ v` filtram a listagem de transações e exibem estado vazio amigável quando nenhum item corresponde ao filtro.
- [ ] O card `Saldo` calcula em tempo real o total de entradas efetivadas menos as saídas pagas, e o ícone de olho alterna e persiste a ocultação do valor (`R$ ••••`).
- [ ] Testes de integração contra SQLite `:memory:` validam a criação, edição, exclusão, filtragem e precisão em centavos do `FinancesService`.
