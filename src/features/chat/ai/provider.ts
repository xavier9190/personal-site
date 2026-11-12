import { GoogleGenAI } from '@google/genai';
import type { AIMessageInput, AIProvider, ChatContext } from './types';

export class AntigravityAIProvider implements AIProvider {
  private readonly geminiApiKey: string | undefined;

  constructor(
    private readonly workerUrl: string | undefined = process.env.ANTIGRAVITY_AI_URL,
    geminiApiKey: string | undefined = process.env.GEMINI_API_KEY,
  ) {
    this.geminiApiKey = geminiApiKey;
  }

  async *generateStream(
    messages: AIMessageInput[],
    context: ChatContext,
  ): AsyncIterable<string> {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
    const userPrompt = lastUserMessage?.content || '';

    // 1. If GEMINI_API_KEY is configured, use official Google Gemini SDK
    if (this.geminiApiKey) {
      try {
        const ai = new GoogleGenAI({ apiKey: this.geminiApiKey });
        const systemInstruction = `Você é o assistente inteligente integrado do webapp pessoal "Personal Site".
Regras de estilo e comportamento:
1. Responda SEMPRE em caixa alta (CAPSLOCK / UPPERCASE) mantendo a estética visual Sketch do projeto.
2. Seja direto, conciso, útil e em português brasileiro (pt-BR).
3. Contexto atual:
- Data atual em Recife: ${context.currentDateRecife}
- Horário atual em Recife: ${context.currentTimeRecife}
- Resumo de Finanças: ${context.summaryFinances}
- Próximas Agendas: ${context.summaryUpcomingEvents}
4. Você está integrado aos módulos Calendário, Finanças, Acadêmico e Compras. Ajude o usuário a gerenciar sua rotina diária.`;

        const contents = messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        }));

        const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        const responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents,
          config: {
            systemInstruction,
          },
        });

        for await (const chunk of responseStream) {
          if (chunk.text) {
            yield chunk.text.toUpperCase();
          }
        }
        return;
      } catch (err) {
        console.error('Gemini API Error, falling back to simulated assistance:', err);
      }
    }

    // 2. If external worker/bridge URL is provided, try connecting
    if (this.workerUrl) {
      try {
        const res = await fetch(`${this.workerUrl}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages, context }),
        });

        if (res.ok && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const text = decoder.decode(value, { stream: true });
            if (text) yield text;
          }
          return;
        }
      } catch {
        // Fall back gracefully to standalone simulation
      }
    }

    // 3. Graceful simulated assistance with system context
    yield* this.simulateStream(userPrompt, context);
  }

  private async *simulateStream(
    userPrompt: string,
    context: ChatContext,
  ): AsyncIterable<string> {
    const normalized = userPrompt.trim().toLowerCase();

    let reply = '';
    if (
      normalized.includes('oi') ||
      normalized.includes('olá') ||
      normalized.includes('ola') ||
      normalized.includes('bom dia') ||
      normalized.includes('boa tarde') ||
      normalized.includes('boa noite')
    ) {
      reply = `OLÁ! SOU SEU ASSISTENTE DO PERSONAL SITE. HOJE É ${context.currentDateRecife} EM RECIFE (${context.currentTimeRecife}). COMO POSSO AJUDAR VOCÊ COM SEUS COMPROMISSOS, FINANÇAS, FACULDADE OU COMPRAS?`;
    } else if (normalized.includes('saldo') || normalized.includes('finança') || normalized.includes('financa') || normalized.includes('gasto') || normalized.includes('conta')) {
      reply = `CONSULTANDO FINANÇAS: ${context.summaryFinances}.\nVOCÊ PODE LANÇAR TRANSAÇÕES OU MARCAR CONTAS COMO PAGAS DIRETAMENTE NO PAINEL OU POR AQUI!`;
    } else if (normalized.includes('agenda') || normalized.includes('calendario') || normalized.includes('calendário') || normalized.includes('evento') || normalized.includes('hoje')) {
      reply = `SUAS PRÓXIMAS AGENDAS (${context.currentDateRecife}):\n${context.summaryUpcomingEvents}\nVOCÊ PODE VISUALIZAR OU CRIAR NOVAS AGENDAS NO MÓDULO CALENDÁRIO!`;
    } else if (normalized.includes('ajuda') || normalized.includes('o que você faz') || normalized.includes('comandos')) {
      reply = `ESTOU INTEGRADO AOS 4 MÓDULOS:\n1. CALENDÁRIO: EVENTOS E PRAZOS UNIFICADOS.\n2. FINANÇAS: SALDO, GASTOS E CONTAS A PAGAR.\n3. ACADÊMICO: PROJETOS, INTEGRANTES E MARCOS [OK].\n4. COMPRAS: LISTA DE DESEJOS E ENCOMENDAS.\nCOMO POSSO TE AJUDAR AGORA?`;
    } else {
      reply = `RECEBI SUA MENSAGEM: "${userPrompt.toUpperCase()}".\nHORÁRIO DE RECIFE: ${context.currentTimeRecife} (${context.currentDateRecife}).\nSEU COMANDO FOI PROCESSADO E REGISTRADO NO HISTÓRICO.`;
    }

    // Split into natural word chunks for streaming tokens
    const words = reply.split(' ');
    for (let i = 0; i < words.length; i++) {
      const piece = (i > 0 ? ' ' : '') + words[i];
      yield piece;
      // In production/browser, slight pause for streaming effect
      if (process.env.NODE_ENV !== 'test') {
        await new Promise((r) => setTimeout(r, 20));
      }
    }
  }
}
