# User Stories — Personal Site (Hub Pessoal Integrado)

> **Persona única em todas as histórias:** *Usuário do Hub Pessoal* (estudante universitário e desenvolvedor que gerencia sua agenda, finanças, projetos acadêmicos e compras localmente).
> **Legenda de Prioridade (MoSCoW):** `MUST` (Obrigatório no MVP) | `SHOULD` (Importante) | `COULD` (Desejável).

---

## Grupo 1 — Transversal, Plataforma e Design System Sketch (`PLAT`)

### `US-PLAT-01` — Identidade Visual Sketch Dark e Fonte Excalifont em Capslock
- **História:** Como usuário, quero que toda a interface utilize o estilo visual Sketch escuro (`#121212` e `#1e1e1e`) com a fonte `Excalifont` exclusivamente em `CAPSLOCK` e a paleta de 4 cores suaves (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`), para que o sistema seja 100% fiel aos meus wireframes desenhados à mão.
- **Prioridade:** `MUST` | **Dependências:** Nenhuma
- **Critérios de Aceitação:**
  - **Dado** que acesso qualquer rota do sistema, **Quando** a página carrega, **Então** o fundo principal é `#121212`, os cards/modais/sidebar usam `#1e1e1e`, os traços e textos principais usam `#f1f3f5`, e todo texto renderizado está em letras maiúsculas (`UPPERCASE`) com a fonte `Excalifont`.
  - **Dado** que um elemento possui fundo preenchido com uma das 4 cores suaves (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`), **Quando** o texto interno é exibido, **Então** a cor da fonte interna deve ser `#121212` para garantir contraste legível.
- **O que muda no Mobile:** Os tamanhos de fonte e espaçamentos escalam proporcionalmente mantendo `CAPSLOCK` e alvos de toque mínimos de `44x44px`.

### `US-PLAT-02` — Navegação Compartilhada via Module Registry (Sidebar / Bottom Nav)
- **História:** Como usuário, quero navegar entre os 5 módulos (`Chat`, `Calendário`, `Finanças`, `Acadêmico`, `Compras`) através de uma barra lateral compartilhada alimentada por um registro central de módulos, para que eu possa alternar de contexto instantaneamente e adicionar novas telas no futuro sem retrabalho.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que estou em qualquer tela do sistema, **Quando** clico em um dos 5 módulos na navegação, **Então** a rota muda imediatamente e o item ativo recebe destaque visual estilo sketch (borda acentuada).
  - **Dado** que um novo módulo é registrado em `src/config/modules.ts`, **Quando** a aplicação renderiza, **Então** o novo item aparece automaticamente na navegação sem editar os componentes das demais telas.
- **O que muda no Mobile:** A Sidebar vertical esquerda oculta-se em telas `< 768px` e transforma-se em uma `Bottom Navigation Bar` fixa na parte inferior com os 5 módulos.

### `US-PLAT-03` — Botão Padronizado `+ ADICIONAR` nas Telas de Módulos
- **História:** Como usuário, quero que todas as telas (exceto a de `Chat`) exibam um botão padronizado de adicionar no canto superior direito da área principal, para que eu saiba exatamente onde criar um novo item em qualquer módulo.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que acesso `Calendário` (`+ NOVA AGENDA`), `Finanças` (`ADICIONAR +`), `Acadêmico` (`+ ADICIONAR`) ou `Compras` (`+ ADICIONAR`), **Quando** olho para o cabeçalho do módulo, **Então** vejo o botão com tamanho, borda sketch e posicionamento padronizados.
  - **Dado** que acesso a tela `Chat`, **Quando** o cabeçalho é exibido, **Então** não há botão `+ ADICIONAR` de entidade, mantendo o foco na conversa.
- **O que muda no Mobile:** O botão mantém-se no cabeçalho superior direito de cada tela com espaçamento adequado para toque.

### `US-PLAT-04` — Inicialização com Banco Limpo (Sem Seed) e Estados Vazios (Empty States)
- **História:** Como usuário, quero que o banco de dados SQLite inicie 100% vazio (sem dados fictícios de seed) e exiba estados vazios claros em cada seção, para que todos os registros do sistema sejam reais e inseridos exclusivamente por mim.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que inicio a aplicação pela primeira vez, **Quando** o arquivo `data/personal.db` é criado e migrado automaticamente, **Então** todas as tabelas iniciam com `0` registros.
  - **Dado** que uma lista ou carrossel não possui itens cadastrados, **Quando** visualizo a tela correspondente, **Então** vejo um card tracejado estilo sketch informando que ainda não há itens e um atalho para adicionar o primeiro.
- **O que muda no Mobile:** Os cards de *Empty State* ocupam 100% da largura útil da coluna móvel.

### `US-PLAT-05` — Tratamento de Erros de Validação, Estados de Loading e Feedback Visual
- **História:** Como usuário, quero ver mensagens claras em português quando tentar salvar um formulário inválido ou quando uma operação estiver carregando, para evitar dados corrompidos ou cliques duplicados.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que abro qualquer modal de criação/edição e deixo um campo obrigatório em branco (ou digito um valor negativo/inválido), **Quando** clico em salvar, **Então** o campo recebe borda vermelha (`#ffc9c9`) com a explicação do erro em `CAPSLOCK` e o envio é bloqueado.
  - **Dado** que submeto um formulário válido, **Quando** a gravação está em andamento, **Então** o botão de salvar fica desabilitado até a conclusão.
- **O que muda no Mobile:** As mensagens de erro aparecem imediatamente abaixo do campo, fazendo scroll automático até o primeiro erro se necessário.

### `US-PLAT-06` — Precisão Monetária em Centavos (`pt-BR`) e Fuso Horário (`America/Recife`)
- **História:** Como usuário, quero que todos os valores monetários sejam armazenados em centavos inteiros e exibidos em Reais (`R$ 0,00`) e todas as datas respeitem o fuso `America/Recife`, para que nunca ocorram erros de arredondamento ou deslocamento de 1 dia nos prazos.
- **Prioridade:** `MUST` | **Dependências:** Nenhuma
- **Critérios de Aceitação:**
  - **Dado** que cadastro valores quebrados como `R$ 19,99` e `R$ 0,01`, **Quando** o sistema soma os valores no banco, **Então** armazena `1999` e `1` centavos e exibe exatamente `R$ 20,00`.
  - **Dado** que cadastro um prazo na data `18/11/2026`, **Quando** visualizo esse prazo em qualquer tela, **Então** ele sempre exibe `18/11/2026` no fuso `America/Recife` (sem recuar para `17/11/2026` por conversão UTC indevida).
- **O que muda no Mobile:** Nenhuma diferença; a formatação `pt-BR` é idêntica.

### `US-PLAT-07` — Proteção Opcional por PIN para Acesso na Rede Wi-Fi Local e Manifesto PWA
- **História:** Como usuário, quero poder instalar o webapp na tela inicial do meu celular via Wi-Fi local (PWA) com suporte opcional a um PIN configurado no `.env.local`, para usar no celular com praticidade e segurança.
- **Prioridade:** `SHOULD` | **Dependências:** `US-PLAT-02`
- **Critérios de Aceitação:**
  - **Dado** que a variável `APP_ACCESS_PIN` está vazia no `.env.local`, **Quando** abro o sistema em `localhost`, **Então** entro direto sem tela de bloqueio.
  - **Dado** que configurei `APP_ACCESS_PIN=1234` para expor na rede local, **Quando** acesso pelo navegador do celular pela primeira vez, **Então** o sistema pede o PIN antes de liberar as rotas e grava um cookie HTTP-only de longa duração.
- **O que muda no Mobile:** Pode ser adicionado à tela inicial em modo *standalone* (sem barra de endereço do navegador).

---

## Grupo 2 — Módulo `Finanças` (`FIN`)

### `US-FIN-01` — Visualização dos 3 Cards de Resumo (`Saldo`, `A Pagar`, `Previsto`) e Filtro de Período
- **História:** Como usuário, quero ver no topo da tela de Finanças os cards de `Saldo`, `A Pagar` (com a contagem de contas pendentes) e `Previsto` filtrados pelo período selecionado (ex.: `Este Mês`), para saber exatamente minha situação financeira atual e quanto sobrará após pagar tudo.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`, `US-PLAT-06`
- **Critérios de Aceitação:**
  - **Dado** que tenho `R$ 100,00` de saldo efetivado e 3 contas pendentes somando `R$ 50,00` em `Este Mês`, **Quando** abro a tela de `Finanças`, **Então** o card `SALDO` exibe `R$ 100,00`, o card `A PAGAR` exibe `R$ 50,00` com o subtítulo `FALTAM 3 CONTAS`, e o card `PREVISTO` exibe `R$ 50,00`.
  - **Dado** que altero o seletor de período no topo (`Este Mês`, `Mês Passado`, `Próximo Mês`, `Todos`), **Quando** a seleção muda, **Então** os 3 cards e a tabela de transações recalculam para o período escolhido.
- **O que muda no Mobile:** Os 3 cards são exibidos em um grid compacto no topo (ou carrossel horizontal rápido) acima da lista.

### `US-FIN-02` — Ocultar e Mostrar o Valor do Saldo (Ícone de Olho)
- **História:** Como usuário, quero clicar no ícone de olho ao lado do `Saldo` (tanto na tela de `Finanças` quanto no painel direito do `Chat`) para ocultar ou revelar os valores monetários, para ter privacidade quando estiver usando o computador ou celular perto de outras pessoas.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-01`
- **Critérios de Aceitação:**
  - **Dado** que o saldo está visível (`R$ 100,00`), **Quando** clico no botão do olho, **Então** o valor é mascarado (`R$ ••••`) em ambas as telas (`Finanças` e `Chat`) e a preferência persiste ao recarregar a página.
- **O que muda no Mobile:** Comportamento idêntico, com botão de toque fácil ao lado do título `SALDO`.

### `US-FIN-03` — Cadastro, Edição e Exclusão de Transações (Entradas Verdes e Saídas Vermelhas)
- **História:** Como usuário, quero registrar, editar e excluir transações de entrada (receitas) e saída (despesas) com data, descrição, categoria e valor, vendo-as na tabela `Últimas Transações` coloridas em verde (`#b2f2bb`) para entradas e vermelho (`#ffc9c9`) para saídas, para controlar meu fluxo de caixa.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-01`
- **Critérios de Aceitação:**
  - **Dado** que clico em `ADICIONAR +` na tela de `Finanças` e escolho `Nova Transação`, **Quando** preencho tipo (`Entrada` ou `Saída`), data (`12/05`), descrição (`SALÁRIO` ou `ALMOÇO`), categoria e valor, **Então** a linha aparece na tabela `Últimas Transações` com destaque verde (`#b2f2bb`) se for entrada ou vermelho (`#ffc9c9`) se for saída, atualizando o `Saldo` imediatamente.
  - **Dado** que clico em uma transação existente, **Quando** altero o valor ou a excluo, **Então** o `Saldo` e o `Previsto` são recalculados na hora.
- **O que muda no Mobile:** A tabela `Data | Desc | Categ | Valor` adapta-se em cards/linhas compactas de duas linhas por item para não cortar textos.

### `US-FIN-04` — Filtragem de Transações por Data e Categoria
- **História:** Como usuário, quero filtrar a tabela `Últimas Transações` usando os seletores `Data v` e `Categ v` (ao lado do ícone de funil), para encontrar gastos específicos e analisar onde estou gastando mais.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-03`
- **Critérios de Aceitação:**
  - **Dado** que existem transações de várias categorias (`Alimentação`, `Transporte`, `Lazer`), **Quando** seleciono `Alimentação` no filtro `Categ v`, **Então** apenas transações dessa categoria são listadas.
  - **Dado** que nenhum registro corresponde à combinação de filtros `Data v` + `Categ v`, **Quando** a lista atualiza, **Então** exibe o estado vazio informando `"NENHUMA TRANSAÇÃO ENCONTRADA PARA ESTE FILTRO"` com botão para limpar filtros.
- **O que muda no Mobile:** Os seletores `Data v` e `Categ v` ficam lado a lado acima da lista ocupando 50% da largura cada.

### `US-FIN-05` — Gestão de Contas a Pagar (Contas Fixas, Fatura de Cartão e Dívidas a Pessoas)
- **História:** Como usuário, quero cadastrar e dar baixa em `Contas a Pagar` — incluindo minhas **Contas Fixas mensais**, a **Fatura do Cartão de Crédito** e **valores que devo a alguém** — para que todas componham o card `A Pagar` (`Faltam N contas`) e as listas `Falta Pagar` / `Pago` na tela de Chat.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-01`
- **Critérios de Aceitação:**
  - **Dado** que cadastro uma Conta Fixa recorrente (ex.: `INTERNET - R$ 100,00`, vencimento dia `10`) ou uma dívida a uma pessoa (ex.: `DEVO AO CAIO - R$ 50,00`), **Quando** ela está com status `Falta Pagar` no mês atual, **Então** seu valor soma no card `A Pagar`, incrementa o contador `"FALTAM N CONTAS"`, aparece em `Falta Pagar` no Chat e projeta seu vencimento no `Calendário`.
  - **Dado** que marco uma conta de `Falta Pagar` como `Pago`, **Quando** confirmo o pagamento, **Então** ela sai de `Falta Pagar`, entra em `Pago` (gerando/efetivando a saída no `Saldo`), diminui o contador `"FALTAM N CONTAS"` e mantém o `Previsto` consistente.
- **O que muda no Mobile:** Ao tocar no card `A Pagar`, abre um modal/drawer listando as contas pendentes do mês para dar baixa rápida com 1 toque.

### `US-FIN-06` — Cadastro de Cartões de Crédito e Consolidação da Fatura Mensal
- **História:** Como usuário, quero cadastrar meus cartões de crédito (nome, dia de fechamento e dia de vencimento) para que minhas compras parceladas ou no crédito fiquem organizadas no cartão e componham a fatura mensal em `Contas a Pagar` sem duplicar valores.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-05`
- **Critérios de Aceitação:**
  - **Dado** que tenho um cartão cadastrado (ex.: `NUBANK`, vencimento dia `15`) e 2 parcelas ativas vinculadas a ele neste mês (`R$ 144,00` e `R$ 50,00`), **Quando** consulto minhas `Contas a Pagar` do mês, **Então** a fatura daquele cartão consolida o total (`R$ 194,00`) como uma obrigação a pagar no vencimento, sem somar as parcelas uma segunda vez fora da fatura.
- **O que muda no Mobile:** Gerenciamento de cartões acessível por modal responsivo dentro de `Finanças`.

### `US-FIN-07` — Painel `Parcelas a Pagar` e Avanço/Quitação de Parcelas
- **História:** Como usuário, quero visualizar na coluna direita de `Finanças` todas as minhas compras parceladas ativas no formato claro `ITEM N/TOTAL` com subtítulo `FALTAM X DE R$ Y,YY` (ex.: `MONITOR 144HZ 2/4` / `FALTAM 2 DE R$ 144,00`), para acompanhar em qual parcela estou e quanto falta para quitar cada compra.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-05`, `US-FIN-06`
- **Critérios de Aceitação:**
  - **Dado** que cadastro um parcelamento de `4` vezes de `R$ 144,00` onde `2` parcelas já foram pagas, **Quando** olho o painel `Parcelas a Pagar`, **Então** vejo `2/4` e exatamente `FALTAM 2 DE R$ 144,00` (calculando `total - pagas = 4 - 2 = 2`).
  - **Dado** que a última parcela (`4/4`) é marcada como paga, **Quando** a lista atualiza, **Então** o plano de parcelamento é concluído e sai da lista de pendências ativas.
- **O que muda no Mobile:** Em telas pequenas, um seletor segmentado permite alternar entre `[ÚLTIMAS TRANSAÇÕES]` e `[PARCELAS A PAGAR]` sem espremer as duas colunas lado a lado.

---

## Grupo 3 — Módulo `Acadêmico` (`ACAD`)

### `US-ACAD-01` — Listagem Separada em `Projetos em Andamento` e `Projetos Já Acabados`
- **História:** Como usuário, quero visualizar meus projetos da faculdade divididos em duas grades de 3 colunas — `Projetos em Andamento` (no topo, com contraste alto) e `Projetos Já Acabados` (abaixo, com opacidade reduzida) — para focar no que está ativo sem perder o histórico do que já entreguei.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que possuo projetos com status `EM_ANDAMENTO` e `CONCLUIDO`, **Quando** abro a tela `Acadêmico`, **Então** os projetos ativos aparecem na seção superior e os concluídos na seção inferior com estilo visual esmaecido (`opacity-60`).
- **O que muda no Mobile:** As grades de 3 colunas passam para 1 coluna vertical com rolagem fluida.

### `US-ACAD-02` — Criação e Edição de Projeto Acadêmico com Links Customizáveis (`GitHub ↗`, `Drive ↗`, etc.)
- **História:** Como usuário, quero criar e editar um projeto acadêmico informando título, mini descrição, data de entrega final, integrantes do grupo e links importantes (`GitHub`, `Drive` ou qualquer outro link), para acessar rapidamente os repositórios e pastas do trabalho direto pelo card.
- **Prioridade:** `MUST` | **Dependências:** `US-ACAD-01`
- **Critérios de Aceitação:**
  - **Dado** que clico em `+ ADICIONAR` na tela `Acadêmico`, **Quando** preencho o título, descrição, data final (`18/11/2026`), integrantes (`Xavier, Leticia, Caio, Ruan`) e adiciono links (ex.: `GitHub` e `Drive`), **Então** o card é exibido em `Projetos em Andamento` com botões clicáveis `GITHUB ↗` e `DRIVE ↗`.
  - **Dado** que clico em um botão de link (`GITHUB ↗`) no card, **Quando** o clique ocorre, **Então** o link abre em uma nova aba (`target="_blank"`) sem abrir o modal de detalhes por engano (`stopPropagation`).
- **O que muda no Mobile:** Os botões de link nos cards mantêm espaçamento de toque seguro para não disparar a abertura do modal acidentalmente.

### `US-ACAD-03` — Modal de Detalhes do Projeto e Destaque Tracejado no Card Selecionado
- **História:** Como usuário, quero clicar em qualquer card de projeto para abrir o modal de detalhes mostrando `Data da Entrega Final`, `Grupo` (integrantes), a linha do tempo de `Marcos Importantes` e os botões de links, enquanto o card selecionado fica com contorno pontilhado amarelo/laranja ao fundo, para inspecionar o plano completo do trabalho.
- **Prioridade:** `MUST` | **Dependências:** `US-ACAD-02`
- **Critérios de Aceitação:**
  - **Dado** que clico no corpo de um card de projeto, **Quando** o modal abre (fiel ao wireframe `academico - detalhes.png`), **Então** o card de origem recebe borda tracejada destacada (`#ffec99`) e o modal exibe todas as informações do projeto.
  - **Dado** que clico no botão `X`, pressiono `ESC` ou clico fora do modal, **Quando** o modal fecha, **Então** o contorno tracejado de seleção é removido.
- **O que muda no Mobile:** O modal de detalhes abre como um *Bottom Sheet* ocupando 90% da altura da tela com scroll interno na timeline.

### `US-ACAD-04` — Gestão de `Marcos Importantes` na Timeline e Marcação Interativa `[OK]`
- **História:** Como usuário, quero adicionar, editar, excluir e clicar nos `Marcos Importantes` dentro da linha do tempo vertical do modal para alternar o selo `[OK]`, para acompanhar cada entrega parcial do trabalho e projetá-las no meu Calendário.
- **Prioridade:** `MUST` | **Dependências:** `US-ACAD-03`
- **Critérios de Aceitação:**
  - **Dado** que visualizo a timeline vertical de `Marcos Importantes` no modal (ordenada por data cronológica), **Quando** clico sobre um marco pendente (ex.: `05/09 - 1 ENTREGA`), **Então** ele recebe o selo verde **`[OK]`** (`#b2f2bb`) imediatamente.
  - **Dado** que adiciono um novo marco com data e nome, **Quando** salvo, **Então** ele entra na posição cronológica correta da timeline e já passa a aparecer na projeção do `Calendário`.
- **O que muda no Mobile:** Cada item da timeline possui área de toque ampla para marcar/desmarcar `[OK]` facilmente.

### `US-ACAD-05` — Conclusão e Reabertura de Projeto Acadêmico
- **História:** Como usuário, quero concluir um projeto (manualmente pelo botão `[CONCLUIR PROJETO]` no modal ou aceitando a sugestão ao marcar o último marco como `[OK]`) ou reabri-lo se necessário, para movê-lo entre `Projetos em Andamento` e `Projetos Já Acabados`.
- **Prioridade:** `MUST` | **Dependências:** `US-ACAD-04`
- **Critérios de Aceitação:**
  - **Dado** que todos os marcos de um projeto em andamento foram marcados com `[OK]`, **Quando** marco o último marco, **Então** o modal oferece mover o projeto para `Projetos Já Acabados` com 1 clique.
  - **Dado** que um projeto está em `Projetos Já Acabados`, **Quando** abro seu modal e clico em `[REABRIR PROJETO]`, **Então** ele volta para a seção `Projetos em Andamento`.
- **O que muda no Mobile:** Botão de ação posicionado no rodapé fixo do *Bottom Sheet*.

---

## Grupo 4 — Módulo `Compras & Entregas` (`SHOP`)

### `US-SHOP-01` — Carrossel `Quero Comprar (Wishlist)` e Cadastro de Desejos
- **História:** Como usuário, quero cadastrar produtos que desejo comprar (com nome, preço em `R$` e link externo) e visualizá-los no carrossel horizontal `Quero Comprar (Wishlist)`, para organizar minha lista de desejos com acesso rápido à página de compra.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`, `US-PLAT-06`
- **Critérios de Aceitação:**
  - **Dado** que clico em `+ ADICIONAR` na tela `Compras` e seleciono `Quero Comprar`, **Quando** informo nome (`MONITOR 144HZ`), preço (`R$ 800,00`) e URL do produto, **Então** o card aparece no carrossel `Quero Comprar (Wishlist)` com o botão `LINK ↗` e o botão `COMPREI ✓`.
- **O que muda no Mobile:** O carrossel horizontal permite deslizar com o dedo (*touch swipe* com `scroll-snap`).

### `US-SHOP-02` — Ação `Comprei ✓` com Data Estimada de Entrega e Pergunta de Integração com `Finanças` (`[SIM / NÃO]`)
- **História:** Como usuário, quero que ao clicar em `Comprei ✓` num item da Wishlist (ou ao adicionar direto uma compra já feita) abra um modal pedindo a **Data Estimada de Chegada**, o **App que comprei** (`Mercado Livre`, `AliExpress`, `Shopee`, etc.) e me pergunte **"VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS? [SIM] [NÃO]"**, para transferir o item para `Já Comprei (A Caminho)` e lançar o gasto em Finanças apenas se eu ainda não tiver lançado.
- **Prioridade:** `MUST` | **Dependências:** `US-SHOP-01`, `US-FIN-03`, `US-FIN-07`
- **Critérios de Aceitação:**
  - **Dado** que clico em `COMPREI ✓` num card da Wishlist, **Quando** informo a data prevista de entrega, o app da compra e clico em **`[SIM, JÁ LANCEI]`**, **Então** o item sai da Wishlist e entra em `Já Comprei (A Caminho)` **sem** criar nova transação ou parcela em `Finanças`.
  - **Dado** que clico em `COMPREI ✓` num card da Wishlist, **Quando** respondo **`[NÃO, LANÇAR AGORA]`** e escolho pagamento **À Vista** ou **Parcelado** (ex.: `4x` no cartão `Nubank`), **Então** o item vai para `Já Comprei (A Caminho)` e o sistema cria automaticamente a transação de saída ou o `Plano de Parcelamento` correspondente em `Finanças`.
- **O que muda no Mobile:** O modal em duas etapas rápidas adapta-se em tela cheia/bottom-sheet no celular.

### `US-SHOP-03` — Carrossel `Já Comprei (A Caminho)`, Barra de Progresso por Data e Alerta Vermelho `(!)` de Atraso
- **História:** Como usuário, quero ver meus produtos em trânsito no carrossel `Já Comprei (A Caminho)` exibindo quantos dias faltam para chegar (ex.: `FALTA 3 DIAS (12/05)`), barra de progresso estilo sketch, o app onde comprei e um sinal **`(!)` em vermelho (`#ffc9c9`)** caso passe do prazo estimado, para saber imediatamente se alguma entrega atrasou.
- **Prioridade:** `MUST` | **Dependências:** `US-SHOP-02`
- **Critérios de Aceitação:**
  - **Dado** que um item foi comprado no dia `02/05` com entrega estimada para `12/05` (prazo de 10 dias) e hoje é `09/05`, **Quando** visualizo o card em `Já Comprei (A Caminho)`, **Então** o subtítulo mostra `FALTA 3 DIAS (12/05)` e a barra de progresso hachurada está em `70%`.
  - **Dado** que a data atual ultrapassou a `Data Estimada de Chegada` e o item ainda não foi marcado como entregue, **Quando** visualizo o card, **Então** o card exibe o ícone de alerta **`(!)`** e destaque em vermelho (`#ffc9c9`) sinalizando atraso.
- **O que muda no Mobile:** Carrossel horizontal com *swipe* nativo e badge `(!)` vermelho bem visível no topo do card.

### `US-SHOP-04` — Botão `Chegou!` e Histórico de Compras Entregues
- **História:** Como usuário, quero clicar no botão `Chegou!` quando receber uma encomenda para que ela saia do carrossel `Já Comprei (A Caminho)` e vá para um histórico consultável de entregues (com opção de desfazer), mantendo a tela principal limpa apenas com o que ainda estou esperando.
- **Prioridade:** `MUST` | **Dependências:** `US-SHOP-03`
- **Critérios de Aceitação:**
  - **Dado** que clico em `CHEGOU!` num item em trânsito, **Quando** confirmo, **Então** o item recebe status `ENTREGUE` com a data de hoje e sai do carrossel `Já Comprei (A Caminho)`.
  - **Dado** que clico no botão `[HISTÓRICO DE ENTREGUES]`, **Quando** o modal abre, **Então** vejo os itens já recebidos e posso clicar em `[REVERTER PARA A CAMINHO]` caso tenha clicado em `Chegou!` por engano.
- **O que muda no Mobile:** Histórico abre em modal responsivo de coluna única.

---

## Grupo 5 — Módulo `Calendário` (`CAL`)

### `US-CAL-01` — Alternância entre as 5 Visões (`Dia`, `Semana`, `Mês`, `Ano` e `Programação`) e Navegação `< Hoje >`
- **História:** Como usuário, quero alternar a visualização do Calendário através do menu suspenso (`Dia`, `Semana`, `Mês`, `Ano` ou `Programação`) e navegar pelas datas com `< Hoje >`, para consultar minha rotina no nível de detalhe que eu precisar.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`, `US-PLAT-06`
- **Critérios de Aceitação:**
  - **Dado** que clico no seletor de visão no topo do Calendário (fiel a `calendario(filtro expandido).png`), **Quando** escolho `Dia`, `Semana`, `Mês`, `Ano` ou `Programação`, **Então** a área central muda imediatamente para a visão selecionada mantendo a data de referência.
  - **Dado** que naveguei para outro mês ou semana usando `<` ou `>`, **Quando** clico em `HOJE`, **Então** o calendário retorna imediatamente para a data atual em `America/Recife`.
- **O que muda no Mobile:** Na visão `Semana`, permite rolagem horizontal suave ou visualização compacta de 3 dias; o seletor de visão fica sempre acessível no topo.

### `US-CAL-02` — Criação, Edição, Exclusão e Recorrência de Eventos com as 4 Cores Sketch
- **História:** Como usuário, quero criar, editar e excluir eventos na agenda escolhendo data, hora de início e fim, uma das 4 cores da paleta (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`) e recorrência opcional (`Não se repete`, `Diário`, `Semanal`, `Mensal`), para diferenciar visualmente onde começa e termina cada reunião ou aula.
- **Prioridade:** `MUST` | **Dependências:** `US-CAL-01`
- **Critérios de Aceitação:**
  - **Dado** que clico em `+ NOVA AGENDA` (ou clico diretamente em um horário vazio na grade de 24h), **Quando** preencho título, horário (`08:00` às `10:00`) e escolho uma das 4 cores, **Então** o bloco colorido correspondente é desenhado exatamente nas linhas de `08:00` a `10:00` com texto escuro (`#121212`) legível.
  - **Dado** que dois eventos ocorrem no mesmo horário (ex.: das `05:00` às `08:00`, como em `calendario(filtro recolhido).png`), **Quando** a grade `Dia` ou `Semana` é renderizada, **Então** os dois blocos dividem a largura da coluna lado a lado (50% cada) sem um esconder o outro.
- **O que muda no Mobile:** Toque em um bloco de evento abre os detalhes e opções de editar/excluir em um *Bottom Sheet*.

### `US-CAL-03` — Projeção Unificada Automática (`Acadêmico`, `Finanças` e `Compras`) no Calendário
- **História:** Como usuário, quero que os prazos dos meus projetos e marcos (`Acadêmico`), os vencimentos de contas/faturas (`Finanças`) e as datas estimadas de chegada (`Compras`) apareçam automaticamente no meu `Calendário` (nas 5 visões, especialmente em `Programação` e `Mês`) sem eu precisar cadastrá-los duas vezes.
- **Prioridade:** `MUST` | **Dependências:** `US-CAL-01`, `US-FIN-05`, `US-ACAD-04`, `US-SHOP-02`
- **Critérios de Aceitação:**
  - **Dado** que possuo um marco acadêmico em `18/11/2026`, uma conta a pagar vencendo em `10/11/2026` e uma entrega prevista para `12/11/2026`, **Quando** consulto novembro de 2026 no `Calendário`, **Então** todos os três itens aparecem nas respectivas datas com identificação de sua origem (`[ACADÊMICO]`, `[FINANÇAS]`, `[COMPRAS]`).
  - **Dado** que clico em um item projetado dentro do Calendário, **Quando** o modal abre, **Então** vejo os detalhes do item e posso navegar para o módulo de origem (ou marcar como concluído/pago).
- **O que muda no Mobile:** Na visão `Programação` (lista cronológica por dia/mês), oferece a leitura mais rápida de todos os eventos e prazos unificados no celular.

### `US-CAL-04` — Painel Direito do Calendário: Mini-Calendário com Marcadores (`o`) e `Agendas de Hoje`
- **História:** Como usuário, quero ver na coluna direita da tela de Calendário um Mini-Calendário mensal (com pequenos marcadores `o` indicando a quantidade de compromissos em cada dia) e a lista de cards `Agendas de Hoje`, para ter uma visão panorâmica do mês e do dia atual.
- **Prioridade:** `MUST` | **Dependências:** `US-CAL-01`, `US-CAL-03`
- **Critérios de Aceitação:**
  - **Dado** que um dia do mês possui eventos ou prazos projetados, **Quando** o Mini-Calendário é renderizado, **Então** exibe marcadores `o` sob o número do dia (até 3 pontos visuais) e clicar no dia navega a grade principal para aquela data.
  - **Dado** que existem compromissos/prazos para o dia selecionado, **Quando** olho para `Agendas de Hoje` abaixo do Mini-Calendário, **Então** vejo os cards resumidos ordenados por horário.
- **O que muda no Mobile:** O Mini-Calendário fica recolhido num botão expansível no topo e `Agendas de Hoje` aparece listada abaixo da grade.

---

## Grupo 6 — Módulo `Chat & IA` (`CHAT`)

### `US-CHAT-01` — Painel Direito de Acesso Rápido no Chat (`Próximas Agendas`, `Saldo`, `Falta Pagar`, `Pago`)
- **História:** Como usuário, quero visualizar na coluna direita da tela de `Chat` minhas `Próximas Agendas`, meu `Saldo` atual (com botão de ocultar), a lista `Falta Pagar` e a lista `Pago`, para ter um dashboard completo da minha vida enquanto converso com a IA e ver as atualizações acontecendo em tempo real.
- **Prioridade:** `MUST` | **Dependências:** `US-FIN-01`, `US-FIN-05`, `US-CAL-03`
- **Critérios de Aceitação:**
  - **Dado** que abro a tela de `Chat` (fiel a `chat.png`), **Quando** o painel direito carrega, **Então** `Próximas Agendas` lista os próximos eventos/prazos unificados em ordem cronológica e `Finanças` exibe o `Saldo` atual e as listas `Falta Pagar` e `Pago` do mês corrente.
  - **Dado** que peço para a IA adicionar um evento ou pagar uma conta no chat, **Quando** a IA executa a tool, **Então** o painel direito atualiza imediatamente sem precisar dar refresh na página.
- **O que muda no Mobile:** Um botão/aba no topo da tela de Chat alterna entre `[CONVERSA]` e `[RESUMO RÁPIDO]`.

### `US-CHAT-02` — Conversa em Streaming com o Antigravity SDK e Persistência de Histórico
- **História:** Como usuário, quero enviar mensagens para a IA na coluna central do `Chat`, vendo o indicador de digitação (`...`) e a resposta chegando em streaming, com todo o histórico salvo localmente no SQLite, para retomar minhas conversas quando quiser.
- **Prioridade:** `MUST` | **Dependências:** `US-PLAT-01`
- **Critérios de Aceitação:**
  - **Dado** que digito uma mensagem e pressiono `Enter`, **Quando** a mensagem é enviada, **Então** meu balão aparece alinhado à direita, o balão da IA aparece à esquerda com animação `...` e o texto é transmitido em tempo real via Antigravity SDK (`google-antigravity`).
  - **Dado** que fecho e reabro o navegador, **Quando** volto para a aba `Chat`, **Então** o histórico da conversa anterior continua disponível (com opção de iniciar `+ NOVA CONVERSA`).
- **O que muda no Mobile:** A barra de entrada fixa-se acima da `Bottom Navigation Bar` (ajustando-se quando o teclado virtual do celular abre).

### `US-CHAT-03` — Execução Direta de Leitura, Criação e Atualização pela IA nos 4 Módulos (com Botão `[DESFAZER]`)
- **História:** Como usuário, quero pedir em linguagem natural para a IA consultar, criar ou atualizar itens em `Calendário`, `Finanças`, `Acadêmico` e `Compras` (ex.: *"marca reunião amanhã às 10h"*, *"gastei 45 reais de Uber"*, *"marca o marco 1 do projeto X como OK"*, *"adiciona um teclado de 300 reais na wishlist"*), com execução imediata e um botão `[DESFAZER]` no chat, para gerenciar tudo conversando rapidamente.
- **Prioridade:** `MUST` | **Dependências:** `US-CHAT-02`, `US-CAL-02`, `US-FIN-03`, `US-ACAD-02`, `US-SHOP-01`
- **Critérios de Aceitação:**
  - **Dado** que peço para a IA criar ou editar um registro em qualquer um dos 4 módulos, **Quando** a IA identifica a intenção, **Então** ela invoca a *tool* correspondente (que chama o mesmo *service* da UI), grava no SQLite e exibe um mini-card no chat confirmando o que foi feito junto com um botão `[DESFAZER]`.
  - **Dado** que a IA acabou de criar ou editar um item e percebo que falei um valor errado, **Quando** clico em `[DESFAZER]` no mini-card da ação, **Então** o registro é revertido no banco e o painel direito atualiza na hora.
- **O que muda no Mobile:** Mini-cards de ação da IA ajustam-se à largura do balão com botão `[DESFAZER]` de fácil toque.

### `US-CHAT-04` — Guardrail de Confirmação Obrigatória (`[CONFIRMAR / CANCELAR]`) para Exclusões pela IA
- **História:** Como usuário, quero que sempre que uma ordem no Chat envolver **excluir** dados ou alterar vários itens em massa, a IA pare e exiba um card de confirmação `[CONFIRMAR] / [CANCELAR]` antes de apagar qualquer coisa do banco, para evitar perda acidental de dados.
- **Prioridade:** `MUST` | **Dependências:** `US-CHAT-03`
- **Critérios de Aceitação:**
  - **Dado** que envio no chat *"apaga o projeto X"* ou *"deleta a transação do almoço"*, **Quando** a IA processa o pedido, **Então** o registro **não** é apagado imediatamente; em vez disso, aparece um card no chat descrevendo exatamente o que será excluído com os botões `[CONFIRMAR EXCLUSÃO]` (vermelho `#ffc9c9`) e `[CANCELAR]`.
  - **Dado** que clico em `[CONFIRMAR EXCLUSÃO]`, **Quando** a confirmação é enviada, **Então** o *service* efetiva a exclusão no SQLite e atualiza a UI.
- **O que muda no Mobile:** Botões `[CONFIRMAR]` e `[CANCELAR]` ocupam largura total do card para evitar toque esbarrado.

### `US-CHAT-05` — Envio de Anexos (Botão de Clipe) para Extração Inteligente pela IA
- **História:** Como usuário, quero clicar no ícone de clipe na barra do Chat para anexar imagens (prints de comprovantes Pix, boletos, notas) ou documentos (PDF de cronograma de disciplina, CSV de extrato), para que a IA leia o arquivo e cadastre automaticamente as transações, eventos ou marcos acadêmicos.
- **Prioridade:** `SHOULD` | **Dependências:** `US-CHAT-03`
- **Critérios de Aceitação:**
  - **Dado** que clico no botão de clipe e seleciono uma imagem ou PDF, **Quando** envio junto com uma instrução (ex.: *"lança esse comprovante em finanças"* ou *"cria o projeto acadêmico com as datas desse PDF"*), **Então** a miniatura do anexo aparece na mensagem e a IA extrai os dados invocando as *tools* correspondentes.
- **O que muda no Mobile:** Clicar no clipe no celular permite tirar uma foto na hora com a câmera (ex.: foto de um cupom fiscal) ou escolher da galeria.

### `US-CHAT-06` — Ditado por Voz no Chat (Botão de Microfone)
- **História:** Como usuário, quero clicar no botão de microfone à direita da barra do Chat para ditar mensagens por voz em português (`pt-BR`), para registrar gastos ou compromissos falando rapidamente pelo celular ou computador sem precisar digitar.
- **Prioridade:** `SHOULD` | **Dependências:** `US-CHAT-02`
- **Critérios de Aceitação:**
  - **Dado** que clico no ícone de microfone, **Quando** começo a falar em português, **Então** o botão pulsa em vermelho (`#ffc9c9`) indicando gravação ativa e o texto reconhecido preenche o campo de mensagem em tempo real para eu revisar e enviar.
  - **Dado** que o navegador não suporta a Web Speech API ou a permissão do microfone foi negada, **Quando** clico no botão, **Então** o sistema exibe um aviso amigável explicando como habilitar o microfone.
- **O que muda no Mobile:** Funciona tanto via Web Speech API quanto com o ditado nativo do teclado móvel.
