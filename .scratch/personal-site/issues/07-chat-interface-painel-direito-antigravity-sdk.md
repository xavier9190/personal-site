# 07: Chat (Parte 1) — Interface de Conversa, Painel Rápido Direito e Streaming com Antigravity SDK

**What to build:** A tela principal de `Chat` em 3 colunas (Sidebar | Conversa central | Painel rápido direito com `Próximas Agendas`, `Saldo` com olho de privacidade, `Falta Pagar` e `Pago`), persistência de histórico de conversas no SQLite e integração em tempo real (streaming) com o **Antigravity SDK (`google-antigravity`)** através do worker local `ai-bridge`.

**Blocked by:** 06: Calendário — 5 Visões em CSS Grid (`Dia`, `Semana`, `Mês`, `Ano`, `Programação`), Eventos e Projeção Unificada

**Status:** ready-for-agent

- [ ] A coluna central do `Chat` exibe os balões de mensagem alternados (usuário à direita, IA à esquerda), indicador de digitação (`...`), streaming de tokens em tempo real e persistência de conversas no SQLite.
- [ ] O painel direito da tela de `Chat` exibe em tempo real a lista `Próximas Agendas` (usando a projeção unificada do `CalendarService`) e o bloco `Finanças` com `Saldo` (e botão de olho para ocultar), `Falta Pagar` e `Pago` (usando o `FinancesService`).
- [ ] Em telas mobile (`< 768px`), um controle no topo alterna entre `[CONVERSA]` e `[RESUMO RÁPIDO]`.
- [ ] O worker/adapter do **Antigravity SDK (`google-antigravity`)** conecta-se à rota de chat com contexto de data/hora (`America/Recife`) e vocabulário do domínio.
