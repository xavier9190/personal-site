# 08: Chat (Parte 2) — Tools de CRUD nos 4 Módulos (`[DESFAZER]` e Confirmação `[CONFIRMAR / CANCELAR]`), Anexos e Voz

**What to build:** A integração completa de *tool calling* da IA no `Chat` operando sobre os mesmos *services* dos módulos `Calendário`, `Finanças`, `Acadêmico` e `Compras`, com execução imediata e botão `[DESFAZER]` para criações/edições, guardrail obrigatório `[CONFIRMAR / CANCELAR]` para exclusões, envio de anexos pelo botão de clipe (imagens/PDF/CSV) e ditado por voz em português pelo botão de microfone (`Web Speech API`).

**Blocked by:** 07: Chat (Parte 1) — Interface de Conversa, Painel Rápido Direito e Streaming com Antigravity SDK

**Status:** ready-for-agent

- [ ] A IA consegue ler, criar, atualizar e excluir itens em `Calendário`, `Finanças`, `Acadêmico` e `Compras` invocando as *tools* conectadas aos *services* de cada módulo, atualizando o painel direito do Chat imediatamente após cada ação.
- [ ] Operações de criação e atualização simples executam diretamente e renderizam um mini-card no chat com botão `[DESFAZER]`, que reverte a alteração no SQLite a partir do snapshot salvo.
- [ ] Operações de exclusão ou alterações destrutivas em massa nunca apagam dados diretamente: geram uma ação pendente no chat exibindo os botões `[CONFIRMAR EXCLUSÃO]` e `[CANCELAR]`, executando a remoção somente após confirmação explícita do usuário.
- [ ] O botão de clipe permite anexar imagens (comprovantes, notas, horários) e documentos (PDF/CSV) na mensagem para a IA extrair e lançar os registros correspondentes.
- [ ] O botão de microfone transcreve voz em português (`pt-BR`) via `Web Speech API` diretamente para o campo de texto do chat.
- [ ] Testes de integração contra SQLite `:memory:` validam a execução das *tools* nos 4 módulos, a reversão via `[DESFAZER]` e o bloqueio de exclusão até o clique em `[CONFIRMAR]`.
