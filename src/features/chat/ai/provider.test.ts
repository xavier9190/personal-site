import { afterEach, describe, expect, it, vi } from 'vitest';
import { FunctionCallingConfigMode, type GenerateContentParameters, type GenerateContentResponse } from '@google/genai';
import { createPgliteTestDb } from '@/db/pglite-test';
import { getGeminiFunctionDeclarations } from '../tools/catalog';
import { AntigravityAIProvider, getAIProvider, setAIProviderForTesting } from './provider';
import { buildChatContext } from './context';
import type { AIProvider } from './types';

describe('AntigravityAIProvider (streaming + native Gemini function calling + fallback)', () => {
  afterEach(() => {
    setAIProviderForTesting(null);
  });

  it('streams simulated response acknowledging greeting and time context', async () => {
    const provider = new AntigravityAIProvider(undefined, undefined);
    const context = await buildChatContext(undefined, undefined, new Date('2026-11-11T12:00:00Z'));

    const tokens: string[] = [];
    const stream = provider.generateStream(
      [{ role: 'user', content: 'Olá!' }],
      context,
    );

    for await (const chunk of stream) {
      tokens.push(chunk);
    }

    const fullText = tokens.join('');
    expect(fullText).toContain('OLÁ!');
    expect(fullText).toContain('RECIFE');
    expect(tokens.length).toBeGreaterThan(1);
  });

  it('streams finance summary when queried about balance', async () => {
    const provider = new AntigravityAIProvider(undefined, undefined);
    const context = await buildChatContext(undefined, undefined, new Date('2026-11-11T12:00:00Z'));

    const tokens: string[] = [];
    const stream = provider.generateStream(
      [{ role: 'user', content: 'Qual meu saldo?' }],
      context,
    );

    for await (const chunk of stream) {
      tokens.push(chunk);
    }

    const fullText = tokens.join('');
    expect(fullText).toContain('FINANÇAS');
  });

  it('uses native Gemini Function Calling with Action Catalog declarations when GEMINI_API_KEY is present', async () => {
    const calls: GenerateContentParameters[] = [];
    const mockClient = {
      models: {
        generateContent: vi.fn(async (params: GenerateContentParameters) => {
          calls.push(params);
          if (calls.length === 1) {
            return {
              text: undefined,
              functionCalls: [
                {
                  id: 'call-1',
                  name: 'createCalendarEvent',
                  args: { title: 'DENTISTA', startTime: '10:00' },
                },
                {
                  id: 'call-2',
                  name: 'addWishlistItem',
                  args: { name: 'CAFÉ ESPECIAL', priceCents: 4500 },
                },
              ],
              candidates: [
                {
                  content: {
                    role: 'model',
                    parts: [
                      {
                        functionCall: {
                          id: 'call-1',
                          name: 'createCalendarEvent',
                          args: { title: 'DENTISTA', startTime: '10:00' },
                        },
                      },
                      {
                        functionCall: {
                          id: 'call-2',
                          name: 'addWishlistItem',
                          args: { name: 'CAFÉ ESPECIAL', priceCents: 4500 },
                        },
                      },
                    ],
                  },
                },
              ],
            } as unknown as GenerateContentResponse;
          }
          return {
            text: 'Pronto! Agendei dentista e adicionei café na wishlist.',
            functionCalls: undefined,
          } as unknown as GenerateContentResponse;
        }),
        generateContentStream: vi.fn(),
      },
    };

    const provider = new AntigravityAIProvider(
      undefined,
      'fake-test-gemini-key',
      undefined,
      () => mockClient,
    );
    const context = await buildChatContext(undefined, undefined, new Date('2026-11-20T12:00:00Z'));
    const declarations = getGeminiFunctionDeclarations();

    const turn1 = await provider.generateTurn({
      messages: [
        {
          role: 'user',
          content: 'marca dentista às 10h e bota café especial na wishlist',
          attachments: [
            {
              id: 'att-1',
              name: 'recibo.png',
              type: 'image/png',
              size: 120,
              dataUrl: 'data:image/png;base64,AAAA',
            },
          ],
        },
      ],
      context,
      tools: declarations,
    });

    expect(turn1.source).toBe('gemini');
    expect(turn1.toolCalls).toEqual([
      { id: 'call-1', name: 'createCalendarEvent', args: { title: 'DENTISTA', startTime: '10:00' } },
      { id: 'call-2', name: 'addWishlistItem', args: { name: 'CAFÉ ESPECIAL', priceCents: 4500 } },
    ]);

    expect(calls[0].config?.tools).toEqual([{ functionDeclarations: declarations }]);
    expect(calls[0].config?.toolConfig?.functionCallingConfig?.mode).toBe(
      FunctionCallingConfigMode.AUTO,
    );
    const firstContents = calls[0].contents as Array<{ parts?: Array<{ inlineData?: unknown }> }>;
    expect(firstContents[0].parts?.some((p) => Boolean(p.inlineData))).toBe(true);

    const turn2 = await provider.generateTurn({
      messages: [{ role: 'user', content: 'marca dentista às 10h e bota café especial na wishlist' }],
      context,
      tools: [],
      priorTurn: {
        toolCalls: turn1.toolCalls,
        rawModelContent: turn1.rawModelContent,
      },
      toolResults: [
        {
          callId: 'call-1',
          toolName: 'createCalendarEvent',
          status: 'CONFIRMED',
          description: 'CRIOU EVENTO: DENTISTA (2026-11-20)',
        },
        {
          callId: 'call-2',
          toolName: 'addWishlistItem',
          status: 'CONFIRMED',
          description: 'ADICIONOU À WISHLIST: CAFÉ ESPECIAL (R$ 45,00)',
        },
      ],
    });

    expect(turn2.text).toBe('PRONTO! AGENDEI DENTISTA E ADICIONEI CAFÉ NA WISHLIST.');
    const secondContents = calls[1].contents as Array<{ role?: string; parts?: Array<{ functionResponse?: { name?: string } }> }>;
    const fnRespTurn = secondContents[secondContents.length - 1];
    expect(fnRespTurn.parts?.map((p) => p.functionResponse?.name)).toEqual([
      'createCalendarEvent',
      'addWishlistItem',
    ]);
  });

  it('falls back to attachment & minimal heuristics only when GEMINI_API_KEY is absent', async () => {
    const { db, close } = await createPgliteTestDb();
    try {
      const provider = new AntigravityAIProvider(undefined, undefined, db);
      const context = await buildChatContext(undefined, undefined, new Date('2026-11-20T12:00:00Z'));

      const csvTurn = await provider.generateTurn({
        messages: [
          {
            role: 'user',
            content: 'lança meu extrato',
            attachments: [
              {
                id: 'csv-1',
                name: 'extrato.csv',
                type: 'text/csv',
                size: 100,
                textContent: 'Data,Descricao,Valor\n2026-11-20,CAFETERIA,25.00',
              },
            ],
          },
        ],
        context,
        tools: getGeminiFunctionDeclarations(),
      });

      expect(csvTurn.source).toBe('fallback');
      expect(csvTurn.toolCalls).toHaveLength(1);
      expect(csvTurn.toolCalls[0].name).toBe('createTransaction');
      expect(csvTurn.toolCalls[0].args.amountCents).toBe(2500);

      const chatTurn = await provider.generateTurn({
        messages: [{ role: 'user', content: 'Olá!' }],
        context,
        tools: getGeminiFunctionDeclarations(),
      });
      expect(chatTurn.toolCalls).toEqual([]);
    } finally {
      await close();
    }
  });

  it('allows overriding and resetting the active AIProvider via setAIProviderForTesting', () => {
    const fakeProvider: AIProvider = {
      generateTurn: async () => ({ text: 'TESTE', toolCalls: [], source: 'mock' }),
      async *generateStream() {
        yield 'TESTE';
      },
    };

    expect(getAIProvider()).toBeInstanceOf(AntigravityAIProvider);
    setAIProviderForTesting(fakeProvider);
    expect(getAIProvider()).toBe(fakeProvider);
    setAIProviderForTesting(null);
    expect(getAIProvider()).toBeInstanceOf(AntigravityAIProvider);
  });
});
