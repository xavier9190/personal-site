# 01: Fundação Sketch, Shell de Navegação (Sidebar/BottomNav) e Infra SQLite Sem Seed

**What to build:** A fundação visual e técnica completa do Hub Pessoal (Next.js + TypeScript + Tailwind + SQLite/Drizzle), entregando o Design System Sketch escuro (`Excalifont` sempre em `CAPSLOCK`, cores `#121212`, `#1e1e1e`, `#f1f3f5` e paleta `#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`), a navegação compartilhada via `Module Registry` (Sidebar fixa à esquerda no desktop e `Bottom Navigation Bar` no celular para `Chat`, `Calendário`, `Finanças`, `Acadêmico` e `Compras`), o cabeçalho padronizado com botão `+ ADICIONAR` (exceto no Chat), a inicialização automática do banco SQLite 100% vazio (sem seed) com *Empty States* estilo sketch em todas as 5 rotas, utilitários de precisão monetária em centavos (`pt-BR`) e fuso horário `America/Recife`, e suporte opcional a PIN de acesso local + manifesto PWA.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A aplicação renderiza o tema escuro Sketch com fundo `#121212`, superfícies `#1e1e1e`, traços/textos `#f1f3f5`, fonte `Excalifont` globalmente em `UPPERCASE` e contraste escuro (`#121212`) sobre blocos preenchidos com as 4 cores suaves (`#b2f2bb`, `#ffc9c9`, `#a5d8ff`, `#ffec99`).
- [x] O `Module Registry` central renderiza as 5 abas (`Chat`, `Calendário`, `Finanças`, `Acadêmico`, `Compras`) como Sidebar esquerda compartilhada no desktop e como `Bottom Navigation Bar` fixa em telas mobile (`< 768px`).
- [x] As telas `Calendário`, `Finanças`, `Acadêmico` e `Compras` exibem o botão padronizado de adicionar no canto superior direito, enquanto a tela `Chat` não exibe esse botão.
- [x] O banco SQLite (`better-sqlite3` + Drizzle) inicializa 100% vazio (sem dados de seed) na primeira execução, suporta instância `:memory:` para a suíte de testes (`Vitest`) e exibe estados vazios (*Empty States*) estilo sketch em todas as seções.
- [x] Os utilitários de moeda operam estritamente em centavos inteiros formatados em `R$ (pt-BR)` e os utilitários de data operam no fuso `America/Recife` sem deslocamento de 1 dia em datas puras (`YYYY-MM-DD`).
- [x] Quando `APP_ACCESS_PIN` está definido no ambiente, solicita o PIN antes de liberar o acesso pela rede local; quando vazio, entra diretamente sem tela de login.
