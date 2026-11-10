# 04: Acadêmico — Projetos em Andamento/Acabados, Links Customizáveis e Modal com Timeline de Marcos (`[OK]`)

**What to build:** O módulo `Acadêmico` completo de ponta a ponta: visualização dividida nas grades `Projetos em Andamento` e `Projetos Já Acabados`, criação/edição de projetos com links externos customizáveis (`GitHub ↗`, `Drive ↗`, etc.), e modal de detalhes (com contorno tracejado no card selecionado) exibindo `Data da Entrega Final`, `Grupo` (integrantes), linha do tempo vertical de `Marcos Importantes` com selo `[OK]` interativo e ação de concluir/reabrir projeto.

**Blocked by:** 01: Fundação Sketch, Shell de Navegação (Sidebar/BottomNav) e Infra SQLite Sem Seed

**Status:** ready-for-agent

- [ ] A tela `Acadêmico` exibe os projetos separados nas seções `Projetos em Andamento` (destaque normal) e `Projetos Já Acabados` (opacidade reduzida), em grade de 3 colunas no desktop e 1 coluna no mobile.
- [ ] Permite criar, editar e excluir um `Projeto Acadêmico` com título, descrição curta, data de entrega final, integrantes do grupo e múltiplos links customizáveis (`GitHub ↗`, `Drive ↗` ou outro rótulo), onde clicar nos botões de link abre a URL em nova aba sem disparar o modal.
- [ ] Clicar em um card aplica borda tracejada de seleção ao card e abre o modal de detalhes exibindo título, `Data da Entrega Final`, `Grupo`, timeline vertical de `Marcos Importantes` e links.
- [ ] Dentro da timeline do modal, permite adicionar, editar, remover e clicar sobre qualquer marco para alternar seu status concluído com o selo monocromático `[OK]`.
- [ ] Permite concluir um projeto (movendo-o para `Projetos Já Acabados` via botão no modal ou ao concluir o último marco) e reabri-lo de volta para `Projetos em Andamento`.
- [ ] Testes de integração contra SQLite `:memory:` cobrem todo o ciclo de vida de projetos, links e marcos no `AcademicService`.
