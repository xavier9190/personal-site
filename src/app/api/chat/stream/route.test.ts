process.env.DATABASE_PATH = ':memory:';

import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { createPinSessionToken, PIN_COOKIE_NAME } from '@/lib/pin-auth';
import { POST } from './route';

const ORIGINAL_ENV = { ...process.env };
const TEST_PIN = 'chave-mestre-chat-stream-2026';
const TEST_SECRET = 'hmac-secret-chat-stream-2026';

describe('POST /api/chat/stream', () => {
  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it('returns 401 Unauthorized JSON when credential is configured and session cookie is missing or invalid', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      APP_ACCESS_PIN: TEST_PIN,
      AUTH_SECRET: TEST_SECRET,
    };

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Olá assistente' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    const data = await res.json();
    expect(data).toMatchObject({ ok: false });
    expect(typeof data.error).toBe('string');
  });

  it('returns 401 Unauthorized JSON in production Fail-Closed mode when AUTH_SECRET is missing', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      APP_ACCESS_PIN: TEST_PIN,
    };
    delete process.env.AUTH_SECRET;

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({ message: 'Olá assistente' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data).toMatchObject({ ok: false });
  });

  it('returns 200 and streams response when a valid HMAC-SHA256 session cookie is provided', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      APP_ACCESS_PIN: TEST_PIN,
      AUTH_SECRET: TEST_SECRET,
    };

    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 30,
      maxSessionDays: 90,
      nowMs: Date.now(),
    });

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      headers: { cookie: `${PIN_COOKIE_NAME}=${token}` },
      body: JSON.stringify({ message: 'Olá assistente' }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/event-stream');
  });
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
