# 02: Finanças (Parte 1) — Transações (Entradas/Saídas), Filtros e Card de Saldo (com Olho de Privacidade)

**What to build:** O fluxo ponta a ponta de gerenciamento de `Transações` e `Saldo` no módulo `Finanças`: cadastro, edição e exclusão de transações de entrada e saída (mantendo a tabela monocromática `#121212`/`#1e1e1e`/`#f1f3f5` e exibindo apenas um círculo colorido com seta para cima `↑` verde `#b2f2bb` para entrada ou seta para baixo `↓` vermelha `#ffc9c9` para saída), filtragem combinada por período (`Este Mês`, etc.), `Data` e `Categoria`, e cálculo em tempo real do card `Saldo` no topo da tela com botão de olho para ocultar/exibir os valores monetários.

**Blocked by:** 01: Fundação Sketch, Shell de Navegação (Sidebar/BottomNav) e Infra SQLite Sem Seed

**Status:** ready-for-agent

- [ ] O botão `ADICIONAR +` na tela de `Finanças` permite registrar uma nova `Transação` (`Entrada` ou `Saída`) com data, descrição, categoria e valor em reais (armazenado em centavos).
- [ ] A tabela `Últimas Transações` mantém visual monocromático e exibe em cada linha apenas um ícone circular colorido com seta para cima (`#b2f2bb`) se for entrada ou seta para baixo (`#ffc9c9`) se for saída, permitindo editar ou excluir qualquer registro.
- [ ] Os seletores de período no topo (`Este Mês`, `Mês Passado`, `Próximo Mês`, `Todos`) e os filtros `Data v` e `Categ v` filtram a listagem de transações e exibem estado vazio amigável quando nenhum item corresponde ao filtro.
- [ ] O card `Saldo` calcula em tempo real o total de entradas efetivadas menos as saídas pagas, e o ícone de olho alterna e persiste a ocultação do valor (`R$ ••••`).
- [ ] Testes de integração contra SQLite `:memory:` validam a criação, edição, exclusão, filtragem e precisão em centavos do `FinancesService`.
