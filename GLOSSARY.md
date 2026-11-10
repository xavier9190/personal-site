# Personal Site

Hub pessoal single-user para gestão integrada de agenda, finanças, projetos acadêmicos e compras, operável tanto por interface visual estilo sketch quanto por assistente de IA.

## Language

**Evento de Agenda (Calendar Event)**:
Compromisso com data/hora de início e fim criado diretamente no módulo de Calendário (ex.: reuniões, aulas, blocos de foco), exibido com uma das 4 cores da paleta para fácil diferenciação visual de início, término e sobreposição.
_Avoid_: Tarefa, lembrete solto

**Item Projetado na Agenda (Calendar Projection Item)**:
Evento de dia inteiro ou prazo originado automaticamente de outro módulo — Marcos/Entregas de `Acadêmico`, Vencimentos de `Finanças` ou Previsões de Entrega de `Compras` — exibido de forma unificada no Calendário e em `Próximas Agendas` sem duplicar dados no banco.
_Avoid_: Evento duplicado, cópia de agenda

**Item da Wishlist (Wishlist Item)**:
Produto que o usuário deseja comprar futuramente, contendo nome, preço estimado e link externo, exibido no carrossel `Quero Comprar`.
_Avoid_: Pedido, compra ativa

**Entrega em Trânsito (In-Transit Purchase)**:
Produto já adquirido que aguarda entrega física, contendo data estimada de chegada, loja/app da compra (`Mercado Livre`, `AliExpress`, `Shopee`, etc.) e status de atraso (`(!)` quando passa da data prevista sem confirmação de `Chegou!`).
_Avoid_: Item da wishlist

**Transação (Transaction)**:
Movimentação financeira de entrada (verde `#b2f2bb`) ou saída (vermelho `#ffc9c9`), registrada em centavos, com data, descrição, categoria e status (`Pago` ou `Falta Pagar`).
_Avoid_: Lançamento genérico

**Conta a Pagar (Payable Bill)**:
Obrigação financeira pendente no mês que compõe o card `A Pagar` (e a lista `Falta Pagar` no Chat), abrangendo três origens: **Contas Fixas** recorrentes (ex.: aluguel, assinaturas), **Fatura do Cartão de Crédito** do mês e **Dívidas Avulsas** (valores devidos a alguém).
_Avoid_: Despesa solta

**Plano de Parcelamento (Installment Plan)**:
Compra dividida em `N` parcelas mensais exibida na coluna `Parcelas a Pagar` (ex.: `MONITOR 144HZ 2/4 — FALTAM 2 DE R$ 144,00`), vinculada a um cartão de crédito (compondo sua fatura mensal) ou avulsa.
_Avoid_: Empréstimo

**Ação de IA (AI Tool Call)**:
Operação de leitura, criação, atualização ou exclusão executada pelo assistente do `Chat` invocando diretamente a camada de *services* dos módulos (`Calendário`, `Finanças`, `Acadêmico`, `Compras`), exigindo confirmação explícita do usuário apenas em exclusões ou alterações destrutivas em lote.
_Avoid_: Automação oculta

**Projeto Acadêmico (Academic Project)**:
Trabalho ou disciplina da faculdade com título, descrição curta, data de entrega final, integrantes do grupo, links externos customizáveis (`GitHub`, `Drive`, etc.) e status (`Em Andamento` ou `Já Acabado`).
_Avoid_: Tarefa avulsa

**Marco de Projeto (Project Milestone)**:
Entrega parcial datada dentro da linha do tempo de um `Projeto Acadêmico`, marcada com `[OK]` quando concluída e projetada automaticamente no `Calendário`.
_Avoid_: Subtarefa sem data




