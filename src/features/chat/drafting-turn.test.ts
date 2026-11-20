import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTesting, type AppDatabase } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { ShoppingService } from '@/features/shopping/service';
import { ChatService } from './service';
import { setAIProviderForTesting } from './ai/provider';
import type { AIProvider, GenerateTurnInput } from './ai/types';
import { undoChatAction, cancelPendingAction } from './tools/dispatcher';
import { POST } from '@/app/api/chat/stream/route';

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

async function postChatTurn(threadId: string, message: string) {
  const req = new NextRequest('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    body: JSON.stringify({ threadId, message }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const events = await readSseEvents(res);
  return {
    events,
    startEvent: events.find((e) => e.type === 'start'),
    doneEvent: events.find((e) => e.type === 'done'),
  };
}

describe('Multi-Turn DRAFTING Slot-Filling, Cancellation & Topic Switching (/api/chat/stream + PGlite)', () => {
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
  });

  it('opens a DRAFTING record for incomplete createCalendarEvent, retains slots across turns, completes on follow-up, and supports undo', async () => {
    const capturedInputs: GenerateTurnInput[] = [];
    let turnCount = 0;

    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        capturedInputs.push(input);
        if (input.toolResults) {
          return { text: '', toolCalls: [], source: 'mock' as const };
        }
        turnCount += 1;
        if (turnCount === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-draft-1',
                name: 'createCalendarEvent',
                args: { date: '2026-11-21', startTime: '15:00' }, // missing required title
              },
            ],
            source: 'mock' as const,
          };
        }
        return {
          text: '',
          toolCalls: [
            {
              id: 'tc-draft-2',
              name: 'createCalendarEvent',
              args: { title: 'ALINHAMENTO DE SPRINT' }, // only new slot provided
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
    const calendar = new CalendarService(testDb);
    const thread = await chat.createThread('DRAFTING FLOW');

    // Turn 1: incomplete request
    const turn1 = await postChatTurn(thread.id, 'marca uma reunião amanhã às 15h');
    expect(turn1.startEvent?.toolCalls).toHaveLength(1);
    expect(turn1.doneEvent?.toolCalls).toHaveLength(1);

    const draftCard = turn1.doneEvent!.toolCalls[0];
    expect(draftCard.status).toBe('DRAFTING');
    expect(draftCard.toolName).toBe('createCalendarEvent');
    expect(draftCard.actionId).toBeDefined();
    expect(draftCard.missingFields).toEqual(['title']);
    expect(draftCard.draftArgs).toMatchObject({
      date: '2026-11-21',
      startTime: '15:00',
    });

    // No event created yet
    expect(await calendar.listEvents()).toHaveLength(0);

    // Persisted active draft in pending_tool_actions
    const persistedDraft = await chat.getActiveDraft(thread.id);
    expect(persistedDraft).not.toBeNull();
    expect(persistedDraft?.id).toBe(draftCard.actionId);
    expect(persistedDraft?.status).toBe('DRAFTING');
    expect(JSON.parse(persistedDraft!.missingFieldsJson!)).toEqual(['title']);

    // Assistant asks only for missing required field (TÍTULO), not inferable fields
    const assistantMsg1 = turn1.doneEvent!.assistantMessage.content as string;
    expect(assistantMsg1).toContain('TÍTULO');
    expect(assistantMsg1).not.toContain('COR');

    // Turn 2: follow-up supplies only title
    const turn2 = await postChatTurn(thread.id, 'Alinhamento de sprint');

    // Active draft was injected into ChatContext for the AIProvider
    const secondTurnCall = capturedInputs.find((c) => !c.toolResults && c.context.activeDraft);
    expect(secondTurnCall).toBeDefined();
    expect(secondTurnCall!.context.activeDraft?.toolName).toBe('createCalendarEvent');
    expect(secondTurnCall!.context.activeDraft?.collectedArgs).toMatchObject({
      date: '2026-11-21',
      startTime: '15:00',
    });
    expect(secondTurnCall!.context.activeDraft?.missingFields.map((f) => f.name)).toEqual([
      'title',
    ]);
    expect(secondTurnCall!.context.systemPrompt).toContain('createCalendarEvent');

    const confirmedCard = turn2.doneEvent!.toolCalls[0];
    expect(confirmedCard.status).toBe('CONFIRMED');
    expect(confirmedCard.actionId).toBe(draftCard.actionId);
    expect(turn2.doneEvent!.resolvedActionStatuses).toMatchObject({
      [draftCard.actionId]: 'CONFIRMED',
    });

    // Event is now persisted with merged slots + inferred defaults
    const events = await calendar.listEvents();
    const created = events.find((e) => e.title === 'ALINHAMENTO DE SPRINT');
    expect(created).toBeDefined();
    expect(created?.startAt).toBe('2026-11-21T15:00');
    expect(created?.endAt).toBe('2026-11-21T16:00');
    expect(created?.color).toBe('green');

    // Draft row transitioned cleanly out of DRAFTING
    expect(await chat.getActiveDraft(thread.id)).toBeNull();
    const completedAction = await chat.getPendingAction(draftCard.actionId);
    expect(completedAction?.status).toBe('CONFIRMED');
    expect(completedAction?.missingFieldsJson).toBeNull();
    expect(completedAction?.undoSnapshotJson).toBeTruthy();

    // Undo still works seamlessly on the completed draft!
    const undoRes = await undoChatAction(draftCard.actionId, testDb);
    expect(undoRes.ok).toBe(true);
    expect((await calendar.listEvents()).some((e) => e.id === created!.id)).toBe(false);
  });

  it('accumulates slots across 3 turns for createPayableBill and handles conditional allDay/startTime slots on createCalendarEvent', async () => {
    let step = 0;
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        if (input.toolResults) {
          return { text: '', toolCalls: [], source: 'mock' as const };
        }
        step += 1;
        // Part A: 3-turn createPayableBill accumulation
        if (step === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'bill-1',
                name: 'createPayableBill',
                args: { title: 'CONTA DE ENERGIA', amountCents: 18500 },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 2) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'bill-2',
                name: 'createPayableBill',
                args: { billType: 'FIXED_RECURRING', category: 'MORADIA' },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 3) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'bill-3',
                name: 'createPayableBill',
                args: { dueDate: '2026-11-28' },
              },
            ],
            source: 'mock' as const,
          };
        }
        // Part B: Calendar allDay=true does NOT ask for startTime; changing startTime mid-draft recomputes endTime
        if (step === 4) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'cal-1',
                name: 'createCalendarEvent',
                args: { date: '2026-11-25', allDay: true },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 5) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'cal-2',
                name: 'createCalendarEvent',
                args: { title: 'FERIADO MUNICIPAL' },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 6) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'cal-3',
                name: 'createCalendarEvent',
                args: { date: '2026-11-26', startTime: '14:00' },
              },
            ],
            source: 'mock' as const,
          };
        }
        return {
          text: '',
          toolCalls: [
            {
              id: 'cal-4',
              name: 'createCalendarEvent',
              args: { title: 'MENTORIA', startTime: '18:00' },
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
    const finances = new FinancesService(testDb);
    const calendar = new CalendarService(testDb);
    const thread = await chat.createThread('MULTI STEP DRAFT');

    // Turn 1: createPayableBill missing billType, category, dueDate
    const t1 = await postChatTurn(thread.id, 'cadastra conta de energia de 185 reais');
    const draftId = t1.doneEvent!.toolCalls[0].actionId;
    expect(t1.doneEvent!.toolCalls[0].status).toBe('DRAFTING');
    expect(t1.doneEvent!.toolCalls[0].missingFields).toEqual(['billType', 'category', 'dueDate']);

    // Turn 2: supply billType & category -> same draft updated, only dueDate remains
    const t2 = await postChatTurn(thread.id, 'fixa de moradia');
    expect(t2.doneEvent!.toolCalls[0].status).toBe('DRAFTING');
    expect(t2.doneEvent!.toolCalls[0].actionId).toBe(draftId);
    expect(t2.doneEvent!.toolCalls[0].missingFields).toEqual(['dueDate']);
    expect(t2.doneEvent!.toolCalls[0].draftArgs).toMatchObject({
      title: 'CONTA DE ENERGIA',
      amountCents: 18500,
      billType: 'FIXED_RECURRING',
      category: 'MORADIA',
    });
    expect(t2.doneEvent!.assistantMessage.content).toContain('VENCIMENTO');
    expect(t2.doneEvent!.assistantMessage.content).not.toContain('CATEGORIA');

    // Turn 3: supply dueDate -> executed!
    const t3 = await postChatTurn(thread.id, 'vence dia 28/11');
    expect(t3.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    expect(t3.doneEvent!.toolCalls[0].actionId).toBe(draftId);
    const bills = await finances.listPayableBills();
    expect(bills.some((b) => b.title === 'CONTA DE ENERGIA' && b.dueDate === '2026-11-28')).toBe(true);

    // Part B1: allDay=true only misses title (not startTime)
    const t4 = await postChatTurn(thread.id, 'marca dia inteiro dia 25');
    expect(t4.doneEvent!.toolCalls[0].missingFields).toEqual(['title']);
    const t5 = await postChatTurn(thread.id, 'Feriado Municipal');
    expect(t5.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    const holiday = (await calendar.listEvents()).find((e) => e.title === 'FERIADO MUNICIPAL');
    expect(holiday?.allDay).toBe(true);

    // Part B2: changing startTime mid-draft recomputes endTime (+1h) instead of failing endTime <= startTime
    const t6 = await postChatTurn(thread.id, 'marca reunião dia 26 às 14h');
    expect(t6.doneEvent!.toolCalls[0].missingFields).toEqual(['title']);
    const t7 = await postChatTurn(thread.id, 'Mentoria às 18h');
    expect(t7.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    const mentoria = (await calendar.listEvents()).find((e) => e.title === 'MENTORIA');
    expect(mentoria?.startAt).toBe('2026-11-26T18:00');
    expect(mentoria?.endAt).toBe('2026-11-26T19:00');
  });

  it('completes a single-missing-slot draft via conversational reply even in offline fallback mode (no GEMINI_API_KEY)', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const chat = new ChatService(testDb);
      const calendar = new CalendarService(testDb);
      const thread = await chat.createThread('OFFLINE FALLBACK DRAFT');

      // Seed an active draft with 1 missing field (title)
      const draft = await chat.upsertActiveDraft({
        threadId: thread.id,
        toolName: 'createCalendarEvent',
        argsJson: JSON.stringify({ date: '2026-11-23', startTime: '10:00' }),
        missingFieldsJson: JSON.stringify(['title']),
      });

      const turn = await postChatTurn(thread.id, 'Consulta médica');
      expect(turn.doneEvent!.toolCalls).toHaveLength(1);
      expect(turn.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
      expect(turn.doneEvent!.toolCalls[0].actionId).toBe(draft.id);

      const events = await calendar.listEvents();
      expect(events.some((e) => e.title === 'CONSULTA MÉDICA' && e.startAt === '2026-11-23T10:00')).toBe(
        true,
      );
    } finally {
      if (prevKey !== undefined) {
        process.env.GEMINI_API_KEY = prevKey;
      }
    }
  });

  it('cancels active DRAFTING via natural language phrases without invoking mutations', async () => {
    const generateTurnSpy = vi.fn(async (input: GenerateTurnInput) => {
      if (input.toolResults) {
        return { text: '', toolCalls: [], source: 'mock' as const };
      }
      return {
        text: '',
        toolCalls: [
          {
            id: 'tc-open',
            name: 'createCalendarEvent',
            args: { date: '2026-11-29', startTime: '11:00' },
          },
        ],
        source: 'mock' as const,
      };
    });
    setAIProviderForTesting({
      generateTurn: generateTurnSpy,
      async *generateStream() {
        yield 'UNUSED';
      },
    });

    const chat = new ChatService(testDb);
    const calendar = new CalendarService(testDb);
    const beforeCount = (await calendar.listEvents()).length;
    const thread = await chat.createThread('CANCEL DRAFT PHRASES');

    for (const phrase of ['esquece isso', 'cancela', 'deixa pra lá']) {
      const openTurn = await postChatTurn(thread.id, 'marca reunião dia 29 às 11h');
      const draftId = openTurn.doneEvent!.toolCalls[0].actionId;
      expect(await chat.getActiveDraft(thread.id)).not.toBeNull();

      const callsBeforeCancel = generateTurnSpy.mock.calls.length;
      const cancelTurn = await postChatTurn(thread.id, phrase);

      expect(generateTurnSpy.mock.calls.length).toBe(callsBeforeCancel);
      expect(cancelTurn.doneEvent!.toolCalls).toEqual([]);
      expect(cancelTurn.doneEvent!.resolvedActionStatuses).toEqual({
        [draftId]: 'CANCELLED',
      });
      expect(cancelTurn.doneEvent!.assistantMessage.content).toContain('CANCELADO');
      expect(await chat.getActiveDraft(thread.id)).toBeNull();
      expect((await chat.getPendingAction(draftId))?.status).toBe('CANCELLED');
    }

    expect(await calendar.listEvents()).toHaveLength(beforeCount);
  });

  it('switches topic mid-draft to a complete or new incomplete intent, cancelling the prior draft cleanly', async () => {
    let step = 0;
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        if (input.toolResults) {
          return { text: '', toolCalls: [], source: 'mock' as const };
        }
        step += 1;
        if (step === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-1',
                name: 'createCalendarEvent',
                args: { date: '2026-11-30', startTime: '15:00' },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 2) {
          // User ignores missing title and logs a R$ 40 expense instead
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-2',
                name: 'createTransaction',
                args: {
                  type: 'EXPENSE',
                  description: 'ALMOÇO EXECUTIVO',
                  category: 'ALIMENTAÇÃO',
                  amountCents: 4000,
                },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 3) {
          // Open another draft (calendar event)
          return {
            text: '',
            toolCalls: [
              {
                id: 'tc-3',
                name: 'createCalendarEvent',
                args: { date: '2026-12-01', startTime: '09:00' },
              },
            ],
            source: 'mock' as const,
          };
        }
        // Switch topic mid-draft to a DIFFERENT incomplete intent (payable bill missing dueDate)
        return {
          text: '',
          toolCalls: [
            {
              id: 'tc-4',
              name: 'createPayableBill',
              args: {
                title: 'INTERNET FIBRA',
                billType: 'FIXED_RECURRING',
                category: 'MORADIA',
                amountCents: 9990,
              },
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
    const calendar = new CalendarService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('TOPIC SWITCH');

    const calCountBefore = (await calendar.listEvents()).length;

    // 1. Open calendar draft
    const t1 = await postChatTurn(thread.id, 'marca reunião dia 30 às 15h');
    const draft1Id = t1.doneEvent!.toolCalls[0].actionId;
    expect(t1.doneEvent!.toolCalls[0].status).toBe('DRAFTING');

    // 2. Topic switch to complete createTransaction
    const t2 = await postChatTurn(thread.id, 'gastei 40 reais no almoço executivo');
    expect(t2.doneEvent!.toolCalls).toHaveLength(1);
    expect(t2.doneEvent!.toolCalls[0].toolName).toBe('createTransaction');
    expect(t2.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    expect(t2.doneEvent!.resolvedActionStatuses[draft1Id]).toBe('CANCELLED');
    expect((await chat.getPendingAction(draft1Id))?.status).toBe('CANCELLED');
    expect(await chat.getActiveDraft(thread.id)).toBeNull();
    expect(await calendar.listEvents()).toHaveLength(calCountBefore);
    expect((await finances.listTransactions()).some((tx) => tx.description === 'ALMOÇO EXECUTIVO' && tx.amountCents === 4000)).toBe(true);

    // 3. Open another draft, then switch topic to a different incomplete draft
    const t3 = await postChatTurn(thread.id, 'marca call dia 1 às 9h');
    const draft2Id = t3.doneEvent!.toolCalls[0].actionId;
    const t4 = await postChatTurn(thread.id, 'na verdade cadastra conta fixa de internet fibra de 99,90');
    const draft3Id = t4.doneEvent!.toolCalls[0].actionId;

    expect(t4.doneEvent!.toolCalls[0].status).toBe('DRAFTING');
    expect(t4.doneEvent!.toolCalls[0].toolName).toBe('createPayableBill');
    expect(t4.doneEvent!.toolCalls[0].missingFields).toEqual(['dueDate']);
    expect(draft3Id).not.toBe(draft2Id);
    expect(t4.doneEvent!.resolvedActionStatuses).toMatchObject({
      [draft2Id]: 'CANCELLED',
      [draft3Id]: 'DRAFTING',
    });
    expect((await chat.getPendingAction(draft2Id))?.status).toBe('CANCELLED');
    expect((await chat.getActiveDraft(thread.id))?.id).toBe(draft3Id);
  });

  it('handles mixed multi-intent turn (executing complete action immediately and opening DRAFTING for incomplete one) and protects 1-draft-per-thread limit', async () => {
    let step = 0;
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        if (input.toolResults) {
          return { text: '', toolCalls: [], source: 'mock' as const };
        }
        step += 1;
        if (step === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'mix-complete',
                name: 'addWishlistItem',
                args: { name: 'CAFÉ GOURMET', priceCents: 3800 },
              },
              {
                id: 'mix-incomplete',
                name: 'createCalendarEvent',
                args: { date: '2026-12-02', startTime: '10:00' },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 2) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'mix-followup',
                name: 'createCalendarEvent',
                args: { title: 'DENTISTA' },
              },
            ],
            source: 'mock' as const,
          };
        }
        // Two incomplete intents in a single message
        return {
          text: '',
          toolCalls: [
            {
              id: 'two-inc-1',
              name: 'createCalendarEvent',
              args: { date: '2026-12-03', startTime: '11:00' },
            },
            {
              id: 'two-inc-2',
              name: 'addWishlistItem',
              args: { name: 'WEBCAM HD' }, // missing priceCents
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
    const shopping = new ShoppingService(testDb);
    const calendar = new CalendarService(testDb);
    const thread = await chat.createThread('MIXED MULTI INTENT');

    const t1 = await postChatTurn(
      thread.id,
      'bota café gourmet de 38 reais na wishlist e marca evento dia 2 às 10h',
    );
    expect(t1.doneEvent!.toolCalls).toHaveLength(2);
    expect(t1.doneEvent!.toolCalls[0].toolName).toBe('addWishlistItem');
    expect(t1.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    expect(t1.doneEvent!.toolCalls[1].toolName).toBe('createCalendarEvent');
    expect(t1.doneEvent!.toolCalls[1].status).toBe('DRAFTING');

    const msg1 = t1.doneEvent!.assistantMessage.content as string;
    expect(msg1).toContain('CAFÉ GOURMET');
    expect(msg1).toContain('TÍTULO');

    const wishlistBefore = (await shopping.listItemsBySection()).wishlist;
    expect(wishlistBefore.filter((i) => i.name === 'CAFÉ GOURMET')).toHaveLength(1);
    expect((await calendar.listEvents()).some((e) => e.startAt === '2026-12-02T10:00')).toBe(false);

    // Follow-up completes only the draft without re-running addWishlistItem
    const t2 = await postChatTurn(thread.id, 'Dentista');
    expect(t2.doneEvent!.toolCalls).toHaveLength(1);
    expect(t2.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    expect((await shopping.listItemsBySection()).wishlist.filter((i) => i.name === 'CAFÉ GOURMET')).toHaveLength(1);
    expect((await calendar.listEvents()).some((e) => e.title === 'DENTISTA' && e.startAt === '2026-12-02T10:00')).toBe(true);

    // Two incomplete intents in one turn: keeps first draft, guards second without throwing DB unique error
    const t3 = await postChatTurn(thread.id, 'marca algo dia 3 às 11h e bota webcam hd na wishlist');
    expect(t3.doneEvent!.toolCalls).toHaveLength(1);
    expect(t3.doneEvent!.toolCalls[0].toolName).toBe('createCalendarEvent');
    expect(t3.doneEvent!.toolCalls[0].status).toBe('DRAFTING');
    expect((await chat.getActiveDraft(thread.id))?.toolName).toBe('createCalendarEvent');
  });

  it('preserves active draft when follow-up provides invalid field value and allows subsequent cancellation via cancelPendingAction', async () => {
    let step = 0;
    const mockProvider: AIProvider = {
      generateTurn: vi.fn(async (input: GenerateTurnInput) => {
        if (input.toolResults) {
          return { text: '', toolCalls: [], source: 'mock' as const };
        }
        step += 1;
        if (step === 1) {
          return {
            text: '',
            toolCalls: [
              {
                id: 'inv-1',
                name: 'createCalendarEvent',
                args: { date: '2026-12-05', startTime: '14:00' },
              },
            ],
            source: 'mock' as const,
          };
        }
        if (step === 2) {
          // Follow-up supplies title alongside invalid date (Feb 30)
          return {
            text: '',
            toolCalls: [
              {
                id: 'inv-2',
                name: 'createCalendarEvent',
                args: { title: 'REUNIÃO', date: '2026-02-30' },
              },
            ],
            source: 'mock' as const,
          };
        }
        return {
          text: '',
          toolCalls: [
            {
              id: 'after-cancel',
              name: 'addWishlistItem',
              args: { name: 'FONE BLUETOOTH', priceCents: 25000 },
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
    const shopping = new ShoppingService(testDb);
    const thread = await chat.createThread('INVALID FOLLOWUP & BUTTON CANCEL');

    // 1. Open draft
    const t1 = await postChatTurn(thread.id, 'marca reunião dia 5 às 14h');
    const draftId = t1.doneEvent!.toolCalls[0].actionId;
    expect(t1.doneEvent!.toolCalls[0].status).toBe('DRAFTING');

    // 2. Invalid follow-up reports error and preserves original draft args intact
    const t2 = await postChatTurn(thread.id, 'reunião dia 30 de fevereiro');
    expect(t2.doneEvent!.assistantMessage.content).toContain('DATA INVÁLIDA');
    const intactDraft = await chat.getActiveDraft(thread.id);
    expect(intactDraft?.id).toBe(draftId);
    expect(JSON.parse(intactDraft!.argsJson).date).toBe('2026-12-05');

    // 3. Cancel via UI button / dispatcher cancelPendingAction
    const cancelRes = await cancelPendingAction(draftId, testDb);
    expect(cancelRes.ok).toBe(true);
    expect(await chat.getActiveDraft(thread.id)).toBeNull();
    expect((await chat.getPendingAction(draftId))?.status).toBe('CANCELLED');

    // 4. Subsequent turn starts cleanly
    const t3 = await postChatTurn(thread.id, 'bota fone bluetooth de 250 reais na wishlist');
    expect(t3.doneEvent!.toolCalls[0].status).toBe('CONFIRMED');
    expect((await shopping.listItemsBySection()).wishlist.some((i) => i.name === 'FONE BLUETOOTH')).toBe(
      true,
    );
  });
});
