import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTesting, type AppDatabase } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import { CalendarService } from '@/features/calendar/service';
import { ShoppingService } from '@/features/shopping/service';
import { ChatService } from '@/features/chat/service';
import { setAIProviderForTesting } from '@/features/chat/ai/provider';
import type { AIProvider, GenerateTurnInput } from '@/features/chat/ai/types';
import { confirmPendingAction, undoChatAction } from '@/features/chat/tools/dispatcher';
import { toRecifeDateString } from '@/lib/dates';
import { createPinSessionToken, PIN_COOKIE_NAME } from '@/lib/pin-auth';
import { POST } from './route';

const ORIGINAL_ENV = { ...process.env };
const TEST_PIN = 'chave-mestre-chat-stream-2026';
const TEST_SECRET = 'hmac-secret-chat-stream-2026';

async function readSseEvents(res: Response): Promise<Array<Record<string, any>>> {
  const reader = res.body?.getReader();
  expect(reader).toBeDefined();

  const decoder = new TextDecoder();
  let streamText = '';
  while (true) {
    const { done, value } = await reader!.read();
    if (done) break;
    streamText += decoder.decode(value, { stream: true });
  }

  return streamText
    .split('\n\n')
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)));
}

describe('POST /api/chat/stream', () => {
  let testDb: AppDatabase;
  let closeTestDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const { db, close } = await createPgliteTestDb();
    testDb = db;
    setDbForTesting(db);
    closeTestDb = close;
  });

  afterAll(async () => {
    setAIProviderForTesting(null);
    setDbForTesting(null);
    if (closeTestDb) {
      await closeTestDb();
      closeTestDb = null;
    }
  });

  afterEach(() => {
    setAIProviderForTesting(null);
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

  it('executes multi-intent turns from AIProvider with inferable Calendar defaults, undo snapshots, and PGlite persistence', async () => {
    const capturedInputs: GenerateTurnInput[] = [];
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        capturedInputs.push(input);
        return {
          text: 'DENTISTA AGENDADO E CAFÉ ADICIONADO À WISHLIST!',
          toolCalls: [
            {
              id: 'tc-cal',
              name: 'createCalendarEvent',
              args: { title: 'DENTISTA', startTime: '15:00' },
            },
            {
              id: 'tc-shop',
              name: 'addWishlistItem',
              args: { name: 'CAFÉ ESPECIAL', priceCents: 3800 },
            },
          ],
          source: 'mock' as const,
        };
      }),
      async *generateStream() {
        yield 'UNUSED';
      },
    };
    setAIProviderForTesting(mockProvider);

    const chat = new ChatService(testDb);
    const thread = await chat.createThread('MULTI-INTENT TEST');

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'marca dentista às 15h e bota café especial de 38 reais na wishlist',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);

    const events = await readSseEvents(res);
    const startEvent = events.find((e) => e.type === 'start');
    const doneEvent = events.find((e) => e.type === 'done');

    expect(capturedInputs[0].tools.some((t) => t.name === 'createCalendarEvent')).toBe(true);
    expect(startEvent?.toolCalls).toHaveLength(2);
    expect(doneEvent?.toolCalls).toHaveLength(2);
    expect(doneEvent?.toolCalls.map((c: any) => c.toolName)).toEqual([
      'createCalendarEvent',
      'addWishlistItem',
    ]);
    expect(doneEvent?.toolCalls.every((c: any) => c.status === 'CONFIRMED')).toBe(true);

    const calendar = new CalendarService(testDb);
    const shopping = new ShoppingService(testDb);
    const calEvents = await calendar.listEvents();
    const dentist = calEvents.find((e) => e.title === 'DENTISTA');
    expect(dentist).toBeDefined();
    expect(dentist?.startAt).toBe(`${toRecifeDateString()}T15:00`);
    expect(dentist?.endAt).toBe(`${toRecifeDateString()}T16:00`);
    expect(dentist?.color).toBe('green');

    const wishlist = (await shopping.listItemsBySection()).wishlist;
    expect(wishlist.some((i) => i.name === 'CAFÉ ESPECIAL' && i.priceCents === 3800)).toBe(true);

    // Persisted assistant message contains both tool calls
    const persistedMsgs = await chat.listMessages(thread.id);
    const lastAssistant = persistedMsgs[persistedMsgs.length - 1];
    expect(lastAssistant.role).toBe('ASSISTANT');
    expect(JSON.parse(lastAssistant.toolCallsJson)).toHaveLength(2);

    // Undo each action independently
    await undoChatAction(doneEvent!.toolCalls[0].actionId, testDb);
    expect((await calendar.listEvents()).some((e) => e.id === dentist!.id)).toBe(false);
    expect((await shopping.listItemsBySection()).wishlist.some((i) => i.name === 'CAFÉ ESPECIAL')).toBe(true);

    await undoChatAction(doneEvent!.toolCalls[1].actionId, testDb);
    expect((await shopping.listItemsBySection()).wishlist.some((i) => i.name === 'CAFÉ ESPECIAL')).toBe(false);
  });

  it('stages destructive deletes in PENDING_CONFIRMATION while executing non-destructive actions in the same turn', async () => {
    const calendar = new CalendarService(testDb);
    const existing = await calendar.createEvent({
      title: 'REUNIÃO ANTIGA',
      date: '2026-11-28',
      startTime: '09:00',
      endTime: '10:00',
      color: 'red',
    });

    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async () => ({
        text: '',
        toolCalls: [
          {
            id: 'tc-new',
            name: 'createCalendarEvent',
            args: { title: 'REUNIÃO NOVA', date: '2026-11-29', startTime: '14:00' },
          },
          {
            id: 'tc-del',
            name: 'deleteCalendarEvent',
            args: { id: existing.id },
          },
        ],
        source: 'mock' as const,
      })),
      async *generateStream() {
        yield 'UNUSED';
      },
    };
    setAIProviderForTesting(mockProvider);

    const chat = new ChatService(testDb);
    const thread = await chat.createThread('MIXED GUARDRAIL TEST');

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'marca reunião nova dia 29 às 14h e apaga a reunião antiga',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const doneEvent = events.find((e) => e.type === 'done');

    expect(doneEvent?.toolCalls).toHaveLength(2);
    expect(doneEvent?.toolCalls[0].status).toBe('CONFIRMED');
    expect(doneEvent?.toolCalls[1].status).toBe('PENDING_CONFIRMATION');
    expect(doneEvent?.toolCalls[1].isDestructive).toBe(true);

    // New event created immediately; old event NOT deleted yet
    const allEvents = await calendar.listEvents();
    expect(allEvents.some((e) => e.title === 'REUNIÃO NOVA')).toBe(true);
    expect(allEvents.some((e) => e.id === existing.id)).toBe(true);

    // Confirming pending deletion deletes only the targeted event
    const confirmRes = await confirmPendingAction(doneEvent!.toolCalls[1].actionId, testDb);
    expect(confirmRes.ok).toBe(true);
    const remaining = await calendar.listEvents();
    expect(remaining.some((e) => e.id === existing.id)).toBe(false);
    expect(remaining.some((e) => e.title === 'REUNIÃO NOVA')).toBe(true);
  });

  it('handles validation errors on one intent without aborting valid intents in the same turn', async () => {
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async () => ({
        text: '',
        toolCalls: [
          {
            id: 'tc-invalid',
            name: 'createCalendarEvent',
            args: { date: '2026-11-29', startTime: '14:00' }, // missing required title
          },
          {
            id: 'tc-valid',
            name: 'addWishlistItem',
            args: { name: 'MOUSE ERGONÔMICO', priceCents: 19900 },
          },
        ],
        source: 'mock' as const,
      })),
      async *generateStream() {
        yield 'UNUSED';
      },
    };
    setAIProviderForTesting(mockProvider);

    const chat = new ChatService(testDb);
    const thread = await chat.createThread('PARTIAL ERROR TEST');

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'marca algo às 14h e bota mouse ergonômico na wishlist',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const doneEvent = events.find((e) => e.type === 'done');

    expect(doneEvent?.toolCalls).toHaveLength(1);
    expect(doneEvent?.toolCalls[0].toolName).toBe('addWishlistItem');
    expect(doneEvent?.toolCalls[0].status).toBe('CONFIRMED');
    expect(doneEvent?.assistantMessage.content).toContain('TÍTULO OBRIGATÓRIO');

    const shopping = new ShoppingService(testDb);
    expect((await shopping.listItemsBySection()).wishlist.some((i) => i.name === 'MOUSE ERGONÔMICO')).toBe(true);
  });

  it('passes READ_SUCCESS tool results back to AIProvider for final response synthesis', async () => {
    const calendar = new CalendarService(testDb);
    await calendar.createEvent({
      title: 'PROVA DE REDES',
      date: '2026-11-25',
      startTime: '08:00',
      endTime: '10:00',
      color: 'blue',
    });

    const generateTurnMock = vi.fn(async (input: GenerateTurnInput) => {
      if (!input.toolResults) {
        return {
          text: '',
          toolCalls: [
            {
              id: 'tc-read',
              name: 'listCalendarItems',
              args: { from: '2026-11-24', to: '2026-11-26' },
            },
          ],
          source: 'mock' as const,
        };
      }
      return {
        text: 'VOCÊ TEM PROVA DE REDES NO DIA 25/11 ÀS 08:00.',
        toolCalls: [],
        source: 'mock' as const,
      };
    });

    setAIProviderForTesting({
      generateTurn: generateTurnMock,
      async *generateStream() {
        yield 'UNUSED';
      },
    });

    const chat = new ChatService(testDb);
    const thread = await chat.createThread('READ FOLLOWUP TEST');

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'o que tenho na agenda dia 25?',
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const doneEvent = events.find((e) => e.type === 'done');

    expect(generateTurnMock).toHaveBeenCalledTimes(2);
    expect(generateTurnMock.mock.calls[1][0].toolResults?.[0].status).toBe('READ_SUCCESS');
    expect(doneEvent?.assistantMessage.content).toBe('VOCÊ TEM PROVA DE REDES NO DIA 25/11 ÀS 08:00.');
    expect(doneEvent?.toolCalls[0].status).toBe('READ_SUCCESS');
  });

  it('preserves offline attachment extraction fallback via /api/chat/stream when GEMINI_API_KEY is absent', async () => {
    delete process.env.GEMINI_API_KEY;
    const chat = new ChatService(testDb);
    const thread = await chat.createThread('OFFLINE CSV TEST');

    const req = new NextRequest('http://localhost:3000/api/chat/stream', {
      method: 'POST',
      body: JSON.stringify({
        threadId: thread.id,
        message: 'lança meu extrato',
        attachments: [
          {
            id: 'att-csv',
            name: 'extrato.csv',
            type: 'text/csv',
            size: 90,
            textContent: 'Data,Descricao,Valor\n2026-11-20,PADARIA RECIFE,32.50',
          },
        ],
      }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const events = await readSseEvents(res);
    const doneEvent = events.find((e) => e.type === 'done');

    expect(doneEvent?.toolCalls).toHaveLength(1);
    expect(doneEvent?.toolCalls[0].toolName).toBe('createTransaction');
    expect(doneEvent?.toolCalls[0].status).toBe('CONFIRMED');
    expect(doneEvent?.toolCalls[0].description).toContain('PADARIA RECIFE');
  });
});
