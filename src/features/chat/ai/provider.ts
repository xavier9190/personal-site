import {
  createPartFromFunctionResponse,
  FunctionCallingConfigMode,
  GoogleGenAI,
  type Content,
  type GenerateContentConfig,
  type GenerateContentParameters,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { detectToolIntent } from './intent';
import type {
  AIMessageInput,
  AIProvider,
  AIToolCallRequest,
  AIToolResultInput,
  ChatContext,
  GenerateTurnInput,
  GenerateTurnOutput,
} from './types';

export interface GenAIClientLike {
  models: {
    generateContent: (
      params: GenerateContentParameters,
    ) => Promise<GenerateContentResponse>;
    generateContentStream: (
      params: GenerateContentParameters,
    ) => Promise<AsyncGenerator<GenerateContentResponse>>;
  };
}

let aiProviderOverride: AIProvider | null = null;

export function setAIProviderForTesting(provider: AIProvider | null): void {
  aiProviderOverride = provider;
}

export function getAIProvider(): AIProvider {
  if (aiProviderOverride) {
    return aiProviderOverride;
  }
  return new AntigravityAIProvider();
}

export function formatToolExecutionSummary(results: AIToolResultInput[]): string {
  const confirmed = results.filter((r) => r.status === 'CONFIRMED');
  const pending = results.filter((r) => r.status === 'PENDING_CONFIRMATION');
  const reads = results.filter((r) => r.status === 'READ_SUCCESS');
  const errors = results.filter((r) => r.status === 'ERROR');

  if (
    results.length === 1 &&
    confirmed.length === 1 &&
    pending.length === 0 &&
    reads.length === 0 &&
    errors.length === 0
  ) {
    return `AÇÃO EXECUTADA COM SUCESSO!\n${confirmed[0].description}.\nVOCÊ PODE DESFAZER ESSA AÇÃO CLICANDO EM [DESFAZER] NO CARD ABAIXO.`;
  }

  if (
    results.length === 1 &&
    pending.length === 1 &&
    confirmed.length === 0 &&
    reads.length === 0 &&
    errors.length === 0
  ) {
    return `ATENÇÃO: AÇÃO DESTRUTIVA IDENTIFICADA.\n${pending[0].description}.\nPOR MOTIVOS DE SEGURANÇA, ESTA AÇÃO EXIGE SUA CONFIRMAÇÃO ABAIXO:`;
  }

  if (
    results.length === 1 &&
    reads.length === 1 &&
    confirmed.length === 0 &&
    pending.length === 0 &&
    errors.length === 0
  ) {
    return `CONSULTA CONCLUÍDA:\n${reads[0].description}`;
  }

  const lines: string[] = [];
  if (confirmed.length > 0) {
    lines.push(`${confirmed.length} ${confirmed.length === 1 ? 'AÇÃO EXECUTADA' : 'AÇÕES EXECUTADAS'} COM SUCESSO:`);
    for (const item of confirmed) {
      lines.push(`• ${item.description}`);
    }
    lines.push('VOCÊ PODE DESFAZER NO BOTÃO [DESFAZER] DOS CARDS ABAIXO.');
  }
  if (pending.length > 0) {
    lines.push('AÇÕES QUE EXIGEM CONFIRMAÇÃO:');
    for (const item of pending) {
      lines.push(`• ${item.description}`);
    }
    lines.push('CONFIRME OU CANCELE NOS CARDS ABAIXO.');
  }
  if (reads.length > 0) {
    for (const item of reads) {
      lines.push(`CONSULTA CONCLUÍDA: ${item.description}`);
    }
  }
  if (errors.length > 0) {
    for (const item of errors) {
      lines.push(`ERRO AO EXECUTAR ${item.toolName}: ${item.error || item.description}`);
    }
  }

  return lines.join('\n').trim() || 'COMANDO PROCESSADO.';
}

function buildSystemInstruction(context: ChatContext, forFunctionCalling: boolean): string {
  const base = `Você é o assistente inteligente integrado do webapp pessoal "Personal Site".
Regras de estilo e comportamento:
1. Responda SEMPRE em caixa alta (CAPSLOCK / UPPERCASE) mantendo a estética visual Sketch do projeto.
2. Seja direto, conciso, útil e em português brasileiro (pt-BR).
3. Contexto atual:
- Data atual em Recife: ${context.currentDateRecife}
- Horário atual em Recife: ${context.currentTimeRecife}
- Resumo de Finanças: ${context.summaryFinances ?? ''}
- Próximas Agendas: ${context.summaryUpcomingEvents ?? ''}
4. Você está integrado aos módulos Calendário, Finanças, Acadêmico e Compras. Ajude o usuário a gerenciar sua rotina diária.`;

  if (!forFunctionCalling) {
    return base;
  }

  return `${base}
5. Ao identificar uma ou mais solicitações de criação, edição, consulta ou exclusão, invoque as funções declaradas correspondentes (pode emitir múltiplas chamadas na mesma resposta).
6. Nunca invente valores fictícios para campos obrigatórios ausentes (como título de evento ou ID de registro). Campos deriváveis como data atual de Recife, cor padrão ou horário de término (+1h) podem ser omitidos quando não informados.`;
}

function toGeminiParts(message: AIMessageInput): Part[] {
  const parts: Part[] = [];
  if (message.content) {
    parts.push({ text: message.content });
  }
  for (const att of message.attachments ?? []) {
    if (att.textContent) {
      parts.push({ text: `[ANEXO ${att.name}]:\n${att.textContent}` });
    } else if (att.dataUrl) {
      const match = /^data:([^;]+);base64,(.+)$/.exec(att.dataUrl);
      if (match) {
        parts.push({
          inlineData: {
            mimeType: match[1],
            data: match[2],
          },
        });
      }
    } else {
      parts.push({ text: `[ARQUIVO ANEXO: ${att.name} (${att.type})]` });
    }
  }
  return parts.length > 0 ? parts : [{ text: '' }];
}

function buildGeminiContents(messages: AIMessageInput[]): Content[] {
  return messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: toGeminiParts(m),
  }));
}

export class AntigravityAIProvider implements AIProvider {
  private readonly geminiApiKey: string | undefined;
  private readonly createGenAIClient: (apiKey: string) => GenAIClientLike;

  constructor(
    private readonly workerUrl: string | undefined = process.env.ANTIGRAVITY_AI_URL,
    geminiApiKey: string | undefined = process.env.GEMINI_API_KEY,
    private readonly db?: AppDatabase,
    createGenAIClient?: (apiKey: string) => GenAIClientLike,
  ) {
    this.geminiApiKey = geminiApiKey;
    this.createGenAIClient =
      createGenAIClient ?? ((apiKey) => new GoogleGenAI({ apiKey }));
  }

  async generateTurn(input: GenerateTurnInput): Promise<GenerateTurnOutput> {
    const lastUserMessage = [...input.messages].reverse().find((m) => m.role === 'user');
    const userPrompt = lastUserMessage?.content || '';

    // 1. Native Gemini Function Calling when GEMINI_API_KEY is available
    if (this.geminiApiKey) {
      try {
        const ai = this.createGenAIClient(this.geminiApiKey);
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        const contents = buildGeminiContents(input.messages);

        if (input.toolResults && input.toolResults.length > 0) {
          const priorModelContent = input.priorTurn?.rawModelContent as Content | undefined;
          if (priorModelContent) {
            contents.push(priorModelContent);
          } else {
            contents.push({
              role: 'model',
              parts: input.toolResults.map((result) => ({
                functionCall: {
                  id: result.callId,
                  name: result.toolName,
                  args: {},
                },
              })),
            });
          }

          contents.push({
            role: 'user',
            parts: input.toolResults.map((result) =>
              createPartFromFunctionResponse(
                result.callId ?? result.toolName,
                result.toolName,
                result.error
                  ? { error: result.error }
                  : {
                      output: {
                        status: result.status,
                        description: result.description,
                        data: result.data ?? null,
                      },
                    },
              ),
            ),
          });
        }

        const config: GenerateContentConfig = {
          systemInstruction: buildSystemInstruction(input.context, true),
        };

        if (input.tools.length > 0) {
          config.tools = [{ functionDeclarations: input.tools }];
          config.toolConfig = {
            functionCallingConfig: {
              mode: FunctionCallingConfigMode.AUTO,
            },
          };
        }

        const response = await ai.models.generateContent({
          model: modelName,
          contents,
          config,
        });

        const toolCalls: AIToolCallRequest[] = (response.functionCalls ?? [])
          .filter((fc) => typeof fc.name === 'string' && fc.name.length > 0)
          .map((fc) => ({
            id: fc.id,
            name: fc.name!,
            args: (fc.args ?? {}) as Record<string, unknown>,
          }));

        return {
          text: (response.text ?? '').trim().toUpperCase(),
          toolCalls,
          rawModelContent: response.candidates?.[0]?.content,
          source: 'gemini',
        };
      } catch (err) {
        console.error('Gemini API Error, falling back to offline assistance:', err);
      }
    }

    // 2. Offline / no-key fallback (attachment extraction + minimal heuristics)
    if (input.toolResults && input.toolResults.length > 0) {
      return {
        text: formatToolExecutionSummary(input.toolResults),
        toolCalls: [],
        source: 'fallback',
      };
    }

    const detected = await detectToolIntent(
      userPrompt,
      lastUserMessage?.attachments ?? [],
      this.db ?? getDb(),
    );

    if (detected) {
      return {
        text: '',
        toolCalls: [
          {
            name: detected.toolName,
            args: detected.args,
          },
        ],
        source: 'fallback',
      };
    }

    return {
      text: '',
      toolCalls: [],
      source: 'fallback',
    };
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
        const ai = this.createGenAIClient(this.geminiApiKey);
        const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
        const responseStream = await ai.models.generateContentStream({
          model: modelName,
          contents: buildGeminiContents(messages),
          config: {
            systemInstruction: buildSystemInstruction(context, false),
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
    } else if (
      normalized.includes('saldo') ||
      normalized.includes('finança') ||
      normalized.includes('financa') ||
      normalized.includes('gasto') ||
      normalized.includes('conta')
    ) {
      reply = `CONSULTANDO FINANÇAS: ${context.summaryFinances}.\nVOCÊ PODE LANÇAR TRANSAÇÕES OU MARCAR CONTAS COMO PAGAS DIRETAMENTE NO PAINEL OU POR AQUI!`;
    } else if (
      normalized.includes('agenda') ||
      normalized.includes('calendario') ||
      normalized.includes('calendário') ||
      normalized.includes('evento') ||
      normalized.includes('hoje')
    ) {
      reply = `SUAS PRÓXIMAS AGENDAS (${context.currentDateRecife}):\n${context.summaryUpcomingEvents}\nVOCÊ PODE VISUALIZAR OU CRIAR NOVAS AGENDAS NO MÓDULO CALENDÁRIO!`;
    } else if (
      normalized.includes('ajuda') ||
      normalized.includes('o que você faz') ||
      normalized.includes('comandos')
    ) {
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
