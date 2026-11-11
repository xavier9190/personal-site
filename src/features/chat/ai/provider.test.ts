import { describe, expect, it } from 'vitest';
import { AntigravityAIProvider } from './provider';
import { buildChatContext } from './context';

describe('AntigravityAIProvider (streaming token responses with Recife context)', () => {
  it('streams simulated response acknowledging greeting and time context', async () => {
    const provider = new AntigravityAIProvider();
    const context = buildChatContext(undefined, undefined, new Date('2026-11-11T12:00:00Z'));

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
    const provider = new AntigravityAIProvider();
    const context = buildChatContext(undefined, undefined, new Date('2026-11-11T12:00:00Z'));

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
});
