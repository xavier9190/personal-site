process.env.DATABASE_PATH = ':memory:';

import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { POST } from './route';

describe('POST /api/chat/stream', () => {
  it('returns 400 when message is empty', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: '   ' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toBe('MENSAGEM NÃO PODE SER VAZIA');
  });

  it('streams response chunks for valid message', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Olá assistente' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let streamText = '';
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      streamText += decoder.decode(value, { stream: true });
    }

    expect(streamText).toContain('data: {"type":"start"');
    expect(streamText).toContain('data: {"type":"token"');
    expect(streamText).toContain('data: {"type":"done"');
  });

  it('streams response chunks with tool execution when message has tool intent', async () => {
    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        message: 'gastei 45 reais de uber',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const reader = res.body?.getReader();
    expect(reader).toBeDefined();

    const decoder = new TextDecoder();
    let streamText = '';
    while (true) {
      const { done, value } = await reader!.read();
      if (done) break;
      streamText += decoder.decode(value, { stream: true });
    }

    expect(streamText).toContain('createTransaction');
    expect(streamText).toContain('CONFIRMED');
  });
});
