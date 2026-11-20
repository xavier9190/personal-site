import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTesting, type AppDatabase } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import {
  createCreditCardSchema,
  createInstallmentPlanSchema,
  createPayableBillSchema,
  createTransactionSchema,
  PRESET_TRANSACTION_CATEGORIES,
  updateCreditCardSchema,
  updateInstallmentPlanSchema,
  updatePayableBillSchema,
  updateTransactionSchema,
} from '@/features/finances/types';
import { FinancesService } from '@/features/finances/service';
import { ChatService } from '@/features/chat/service';
import { setAIProviderForTesting } from '@/features/chat/ai/provider';
import type { AIProvider, GenerateTurnInput } from '@/features/chat/ai/types';
import {
  ACTION_CATALOG,
  buildGeminiFunctionDeclaration,
  getActionCatalogEntry,
} from '@/features/chat/tools/catalog';
import {
  cancelPendingAction,
  confirmPendingAction,
  executeChatTool,
  undoChatAction,
} from '@/features/chat/tools/dispatcher';
import { toRecifeDateString } from '@/lib/dates';
import { POST } from '@/app/api/chat/stream/route';

const ORIGINAL_ENV = { ...process.env };

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

function mockStreamAiTurn(toolCalls: Array<{ id: string; name: string; args: Record<string, unknown> }>) {
  const capturedInputs: GenerateTurnInput[] = [];
  const provider: AIProvider = {
    generateTurn: vi.fn(async (input: GenerateTurnInput) => {
      capturedInputs.push(input);
      return {
        text: toolCalls.length > 0 ? 'AÇÃO PROCESSADA.' : '',
        toolCalls: input.toolResults ? [] : toolCalls,
        source: 'mock' as const,
      };
    }),
    async *generateStream() {
      yield 'UNUSED';
    },
  };
  setAIProviderForTesting(provider);
  return { capturedInputs, provider };
}

async function sendChatStreamMessage(threadId: string, message: string) {
  const req = new NextRequest('http://localhost:3000/api/chat/stream', {
    method: 'POST',
    body: JSON.stringify({ threadId, message }),
  });
  const res = await POST(req);
  expect(res.status).toBe(200);
  const events = await readSseEvents(res);
  return events.find((e) => e.type === 'done')!;
}

describe('Ticket #14: Finanças Schema Single Source of Truth & Chat Parity', () => {
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

  it('registers all Finanças CRUD entries bound to canonical Zod schemas and generates valid Gemini declarations', () => {
    const expectedFinancesTools = [
      'createTransaction',
      'updateTransaction',
      'deleteTransaction',
      'createPayableBill',
      'updatePayableBill',
      'togglePayableBillStatus',
      'deletePayableBill',
      'createInstallmentPlan',
      'updateInstallmentPlan',
      'advanceInstallment',
      'deleteInstallmentPlan',
      'createCreditCard',
      'updateCreditCard',
      'deleteCreditCard',
    ] as const;

    for (const name of expectedFinancesTools) {
      const entry = getActionCatalogEntry(name);
      expect(entry, `missing catalog entry: ${name}`).toBeDefined();
      expect(entry!.module).toBe('FINANCES');

      const decl = buildGeminiFunctionDeclaration(entry!);
      expect(decl.name).toBe(name);
      expect(decl.description).toBeTruthy();

      const params = decl.parametersJsonSchema as Record<string, unknown>;
      expect(params.$schema).toBeUndefined();
      expect(params.type).toBe('object');

      const props = params.properties as Record<string, Record<string, unknown>>;
      for (const propName of Object.keys(props)) {
        expect(entry!.fields[propName], `missing field metadata ${name}.${propName}`).toBeDefined();
        expect(props[propName].description).toBeTruthy();
      }

      if (entry!.operation === 'create' || entry!.operation === 'update') {
        expect(params.required).toBeUndefined();
      } else if (entry!.operation === 'delete') {
        expect(params.required).toEqual(['id']);
      }
    }

    // Single source of truth checks: canonical validation rules (e.g., assertPureDate, positive cents, bounds)
    const createTxEntry = ACTION_CATALOG.createTransaction;
    expect(() =>
      createTxEntry.schema.parse({
        type: 'EXPENSE',
        description: 'ALMOÇO',
        category: 'ALIMENTAÇÃO',
        amountCents: 3500,
        occurredAt: '2026-02-30',
      }),
    ).toThrow();
    expect(() =>
      createTransactionSchema.parse({
        type: 'EXPENSE',
        description: 'ALMOÇO',
        category: 'ALIMENTAÇÃO',
        amountCents: 3500,
        occurredAt: '2026-02-30',
      }),
    ).toThrow();

    const createCardEntry = ACTION_CATALOG.createCreditCard;
    expect(() =>
      createCardEntry.schema.parse({
        name: 'NUBANK',
        closingDay: 32,
        dueDay: 15,
      }),
    ).toThrow();
    expect(() =>
      createCreditCardSchema.parse({
        name: 'NUBANK',
        closingDay: 32,
        dueDay: 15,
      }),
    ).toThrow();

    // Ensure canonical schemas remain valid for direct UI usage
    expect(updateTransactionSchema.safeParse({ amountCents: 100 }).success).toBe(true);
    expect(updatePayableBillSchema.safeParse({ title: 'LUZ' }).success).toBe(true);
    expect(updateCreditCardSchema.safeParse({ dueDay: 10 }).success).toBe(true);
    expect(createPayableBillSchema.safeParse({
      title: 'INTERNET',
      billType: 'FIXED_RECURRING',
      amountCents: 10000,
      category: 'MORADIA',
      dueDate: '2026-11-10',
    }).success).toBe(true);
    expect(createInstallmentPlanSchema.safeParse({
      description: 'MONITOR',
      category: 'COMPRAS',
      totalInstallments: 4,
      installmentAmountCents: 15000,
      startMonth: '2026-11',
    }).success).toBe(true);
    expect(updateInstallmentPlanSchema.safeParse({ totalInstallments: 6 }).success).toBe(true);
  });

  it('infers occurredAt (Recife), EXPENSE vs INCOME type, and PRESET_TRANSACTION_CATEGORIES on createTransaction via /api/chat/stream with undo', async () => {
    const chat = new ChatService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('FINANCES TX INFERENCE');

    mockStreamAiTurn([
      {
        id: 'tc-expense-1',
        name: 'createTransaction',
        args: { description: 'Almoço executivo', amountCents: 4200 },
      },
      {
        id: 'tc-income-1',
        name: 'createTransaction',
        args: { description: 'Salário mensal', amountCents: 500000 },
      },
      {
        id: 'tc-transport-1',
        name: 'createTransaction',
        args: { description: 'Uber centro', amountCents: 2500 },
      },
    ]);

    const doneEvent = await sendChatStreamMessage(
      thread.id,
      'gastei 42 reais no almoço, 25 de uber e recebi 5000 de salário',
    );

    expect(doneEvent.toolCalls).toHaveLength(3);
    expect(doneEvent.toolCalls.every((c: any) => c.status === 'CONFIRMED')).toBe(true);

    const today = toRecifeDateString();
    const txs = await finances.listTransactions();
    const lunch = txs.find((t) => t.description === 'ALMOÇO EXECUTIVO');
    const salary = txs.find((t) => t.description === 'SALÁRIO MENSAL');
    const uber = txs.find((t) => t.description === 'UBER CENTRO');

    expect(lunch).toBeDefined();
    expect(lunch!.type).toBe('EXPENSE');
    expect(lunch!.category).toBe('ALIMENTAÇÃO');
    expect(lunch!.occurredAt).toBe(today);
    expect(lunch!.status).toBe('PAID');
    expect(PRESET_TRANSACTION_CATEGORIES).toContain(lunch!.category);

    expect(salary).toBeDefined();
    expect(salary!.type).toBe('INCOME');
    expect(salary!.category).toBe('TRABALHO');
    expect(salary!.occurredAt).toBe(today);

    expect(uber).toBeDefined();
    expect(uber!.type).toBe('EXPENSE');
    expect(uber!.category).toBe('TRANSPORTE');
    expect(uber!.occurredAt).toBe(today);

    // Undo one transaction and verify persistence
    await undoChatAction(doneEvent.toolCalls[0].actionId, testDb);
    const remaining = await finances.listTransactions();
    expect(remaining.some((t) => t.id === lunch!.id)).toBe(false);
    expect(remaining.some((t) => t.id === salary!.id)).toBe(true);

    // Cleanup remaining for test isolation
    await undoChatAction(doneEvent.toolCalls[1].actionId, testDb);
    await undoChatAction(doneEvent.toolCalls[2].actionId, testDb);
  });

  it('recognizes all 4 Conta a Pagar billType flows (canonical + aliases), infers defaults, updates bills with undo, and guards deletion via /api/chat/stream', async () => {
    const chat = new ChatService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('FINANCES BILLS PARITY');

    const card = await finances.createCreditCard({
      name: 'Inter',
      closingDay: 5,
      dueDay: 12,
    });

    const today = toRecifeDateString();
    const expectedMonth = today.slice(0, 7);

    // 1. Create all 4 Conta a Pagar types (canonical + aliases) with omitted dueDate & category
    mockStreamAiTurn([
      {
        id: 'bill-fixed',
        name: 'createPayableBill',
        args: { title: 'Internet Fibra', billType: 'FIXED', amountCents: 12000 },
      },
      {
        id: 'bill-card',
        name: 'createPayableBill',
        args: {
          title: 'Fatura Inter Manual',
          billType: 'CREDIT_CARD',
          amountCents: 45000,
          creditCardId: card.id,
        },
      },
      {
        id: 'bill-debt',
        name: 'createPayableBill',
        args: { title: 'Devo ao Caio', billType: 'DEBT', amountCents: 8000 },
      },
      {
        id: 'bill-single',
        name: 'createPayableBill',
        args: { title: 'IPVA Parcela', billType: 'SINGLE_BILL', amountCents: 30000 },
      },
    ]);

    const createDone = await sendChatStreamMessage(
      thread.id,
      'cadastra internet fixa 120, fatura inter 450, divida com caio 80 e ipva avulso 300',
    );
    expect(createDone.toolCalls).toHaveLength(4);
    expect(createDone.toolCalls.every((c: any) => c.status === 'CONFIRMED')).toBe(true);

    const bills = await finances.listPayableBills();
    const fixedBill = bills.find((b) => b.title === 'INTERNET FIBRA')!;
    const cardBill = bills.find((b) => b.title === 'FATURA INTER MANUAL')!;
    const debtBill = bills.find((b) => b.title === 'DEVO AO CAIO')!;
    const singleBill = bills.find((b) => b.title === 'IPVA PARCELA')!;

    expect(fixedBill.billType).toBe('FIXED_RECURRING');
    expect(fixedBill.category).toBe('MORADIA');
    expect(fixedBill.dueDate).toBe(today);
    expect(fixedBill.competenceMonth).toBe(expectedMonth);

    expect(cardBill.billType).toBe('CREDIT_CARD_BILL');
    expect(cardBill.creditCardId).toBe(card.id);

    expect(debtBill.billType).toBe('DEBT_TO_PERSON');
    expect(debtBill.dueDate).toBe(today);

    expect(singleBill.billType).toBe('SINGLE_BILL');
    expect(singleBill.category).toBe('TRANSPORTE');

    // Mark fixedBill PAID first, then updatePayableBill and verify linked TX sync + undo
    await finances.markBillPaid(fixedBill.id, today);

    mockStreamAiTurn([
      {
        id: 'bill-upd',
        name: 'updatePayableBill',
        args: { id: fixedBill.id, title: 'Internet Vivo Fibra', amountCents: 14500 },
      },
    ]);

    const updDone = await sendChatStreamMessage(
      thread.id,
      'atualiza a conta de internet para Internet Vivo Fibra 145 reais',
    );
    expect(updDone.toolCalls).toHaveLength(1);
    expect(updDone.toolCalls[0].status).toBe('CONFIRMED');

    const reloadedBills = await finances.listPayableBills();
    const updatedFixed = reloadedBills.find((b) => b.id === fixedBill.id)!;
    expect(updatedFixed.title).toBe('INTERNET VIVO FIBRA');
    expect(updatedFixed.amountCents).toBe(14500);

    const linkedTxBeforeUndo = (await finances.listTransactions()).find(
      (t) => t.payableBillId === fixedBill.id,
    )!;
    expect(linkedTxBeforeUndo.description).toBe('INTERNET VIVO FIBRA');
    expect(linkedTxBeforeUndo.amountCents).toBe(14500);

    // Undo updatePayableBill restores bill and linked transaction
    await undoChatAction(updDone.toolCalls[0].actionId, testDb);
    const restoredFixed = (await finances.listPayableBills()).find((b) => b.id === fixedBill.id)!;
    expect(restoredFixed.title).toBe('INTERNET FIBRA');
    expect(restoredFixed.amountCents).toBe(12000);
    const linkedTxAfterUndo = (await finances.listTransactions()).find(
      (t) => t.payableBillId === fixedBill.id,
    )!;
    expect(linkedTxAfterUndo.description).toBe('INTERNET FIBRA');
    expect(linkedTxAfterUndo.amountCents).toBe(12000);

    // Guarded deletePayableBill stops at PENDING_CONFIRMATION
    mockStreamAiTurn([
      {
        id: 'bill-del',
        name: 'deletePayableBill',
        args: { id: debtBill.id },
      },
    ]);
    const delDone = await sendChatStreamMessage(thread.id, 'apaga a divida do caio');
    expect(delDone.toolCalls).toHaveLength(1);
    expect(delDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');
    expect((await finances.listPayableBills()).some((b) => b.id === debtBill.id)).toBe(true);

    await confirmPendingAction(delDone.toolCalls[0].actionId, testDb);
    expect((await finances.listPayableBills()).some((b) => b.id === debtBill.id)).toBe(false);

    // Cleanup remaining records
    for (const tc of createDone.toolCalls) {
      if (tc.data?.id !== debtBill.id) {
        await undoChatAction(tc.actionId, testDb);
      }
    }
    await finances.deleteCreditCard(card.id);
  });

  it('supports Plano de Parcelamento creation with inferable defaults, updateInstallmentPlan, advanceInstallment, undo reversal, and guarded delete via /api/chat/stream', async () => {
    const chat = new ChatService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('FINANCES INSTALLMENTS PARITY');

    const today = toRecifeDateString();
    const expectedStartMonth = today.slice(0, 7);

    // 1. Create installment plan with omitted category, paidInstallments, startMonth
    mockStreamAiTurn([
      {
        id: 'inst-create',
        name: 'createInstallmentPlan',
        args: {
          description: 'Monitor 144Hz',
          totalInstallments: 4,
          installmentAmountCents: 14400,
        },
      },
    ]);

    const createDone = await sendChatStreamMessage(
      thread.id,
      'parcelamento do monitor 144hz em 4x de 144 reais',
    );
    expect(createDone.toolCalls).toHaveLength(1);
    expect(createDone.toolCalls[0].status).toBe('CONFIRMED');

    const plans = await finances.listInstallmentPlans();
    const plan = plans.find((p) => p.description === 'MONITOR 144HZ')!;
    expect(plan).toBeDefined();
    expect(plan.category).toBe('COMPRAS');
    expect(plan.paidInstallments).toBe(0);
    expect(plan.startMonth).toBe(expectedStartMonth);

    // 2. Advance installment (+1 paid) and verify undo reverts paidInstallments
    mockStreamAiTurn([
      {
        id: 'inst-adv',
        name: 'advanceInstallment',
        args: { id: plan.id },
      },
    ]);

    const advDone = await sendChatStreamMessage(thread.id, 'paguei uma parcela do monitor');
    expect(advDone.toolCalls).toHaveLength(1);
    expect(advDone.toolCalls[0].status).toBe('CONFIRMED');
    expect((await finances.getInstallmentPlan(plan.id))?.paidInstallments).toBe(1);

    await undoChatAction(advDone.toolCalls[0].actionId, testDb);
    expect((await finances.getInstallmentPlan(plan.id))?.paidInstallments).toBe(0);

    // 3. Update installment plan and verify undo restores original values
    mockStreamAiTurn([
      {
        id: 'inst-upd',
        name: 'updateInstallmentPlan',
        args: {
          id: plan.id,
          description: 'Monitor OLED 240Hz',
          totalInstallments: 6,
          installmentAmountCents: 20000,
        },
      },
    ]);

    const updDone = await sendChatStreamMessage(
      thread.id,
      'edita o parcelamento do monitor para Monitor OLED 240Hz 6x de 200',
    );
    expect(updDone.toolCalls).toHaveLength(1);
    expect(updDone.toolCalls[0].status).toBe('CONFIRMED');
    const updatedPlan = (await finances.getInstallmentPlan(plan.id))!;
    expect(updatedPlan.description).toBe('MONITOR OLED 240HZ');
    expect(updatedPlan.totalInstallments).toBe(6);
    expect(updatedPlan.installmentAmountCents).toBe(20000);

    await undoChatAction(updDone.toolCalls[0].actionId, testDb);
    const revertedPlan = (await finances.getInstallmentPlan(plan.id))!;
    expect(revertedPlan.description).toBe('MONITOR 144HZ');
    expect(revertedPlan.totalInstallments).toBe(4);
    expect(revertedPlan.installmentAmountCents).toBe(14400);

    // 4. Guarded deleteInstallmentPlan
    mockStreamAiTurn([
      {
        id: 'inst-del',
        name: 'deleteInstallmentPlan',
        args: { id: plan.id },
      },
    ]);
    const delDone = await sendChatStreamMessage(thread.id, 'apaga o parcelamento do monitor');
    expect(delDone.toolCalls).toHaveLength(1);
    expect(delDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');
    expect(await finances.getInstallmentPlan(plan.id)).toBeDefined();

    await confirmPendingAction(delDone.toolCalls[0].actionId, testDb);
    expect(await finances.getInstallmentPlan(plan.id)).toBeUndefined();
  });

  it('supports Cartão de Crédito CRUD (createCreditCard, updateCreditCard, guarded deleteCreditCard) with undo and restore via /api/chat/stream', async () => {
    const chat = new ChatService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('FINANCES CARDS PARITY');

    // 1. Create credit card via chat stream
    mockStreamAiTurn([
      {
        id: 'card-create',
        name: 'createCreditCard',
        args: {
          name: 'Nubank',
          closingDay: 8,
          dueDay: 15,
          limitCents: 500000,
        },
      },
    ]);

    const createDone = await sendChatStreamMessage(
      thread.id,
      'cadastra cartão Nubank fecha dia 8 vence dia 15 limite 5000',
    );
    expect(createDone.toolCalls).toHaveLength(1);
    expect(createDone.toolCalls[0].status).toBe('CONFIRMED');

    const card = (await finances.listCreditCards()).find((c) => c.name === 'NUBANK')!;
    expect(card).toBeDefined();
    expect(card.closingDay).toBe(8);
    expect(card.dueDay).toBe(15);
    expect(card.limitCents).toBe(500000);

    // 2. Update credit card and verify undo restores previous card fields
    mockStreamAiTurn([
      {
        id: 'card-update',
        name: 'updateCreditCard',
        args: {
          id: card.id,
          name: 'Nubank Black',
          closingDay: 10,
          dueDay: 20,
          limitCents: 1000000,
        },
      },
    ]);

    const updDone = await sendChatStreamMessage(
      thread.id,
      'atualiza o cartão Nubank para Nubank Black fecha 10 vence 20 limite 10000',
    );
    expect(updDone.toolCalls).toHaveLength(1);
    expect(updDone.toolCalls[0].status).toBe('CONFIRMED');

    const updatedCard = (await finances.getCreditCard(card.id))!;
    expect(updatedCard.name).toBe('NUBANK BLACK');
    expect(updatedCard.closingDay).toBe(10);
    expect(updatedCard.dueDay).toBe(20);
    expect(updatedCard.limitCents).toBe(1000000);

    await undoChatAction(updDone.toolCalls[0].actionId, testDb);
    const revertedCard = (await finances.getCreditCard(card.id))!;
    expect(revertedCard.name).toBe('NUBANK');
    expect(revertedCard.closingDay).toBe(8);
    expect(revertedCard.dueDay).toBe(15);
    expect(revertedCard.limitCents).toBe(500000);

    // 3. Guarded deleteCreditCard -> PENDING_CONFIRMATION -> cancel keeps card intact
    mockStreamAiTurn([
      {
        id: 'card-del-1',
        name: 'deleteCreditCard',
        args: { id: card.id },
      },
    ]);

    const delCancelDone = await sendChatStreamMessage(thread.id, 'apaga meu cartão nubank');
    expect(delCancelDone.toolCalls).toHaveLength(1);
    expect(delCancelDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');
    expect(delCancelDone.toolCalls[0].isDestructive).toBe(true);
    expect(await finances.getCreditCard(card.id)).toBeDefined();

    await cancelPendingAction(delCancelDone.toolCalls[0].actionId, testDb);
    expect(await finances.getCreditCard(card.id)).toBeDefined();

    // 4. Confirm deleteCreditCard -> deletes card, and undoAction restores deleted card with same ID
    mockStreamAiTurn([
      {
        id: 'card-del-2',
        name: 'deleteCreditCard',
        args: { id: card.id },
      },
    ]);

    const delConfirmDone = await sendChatStreamMessage(thread.id, 'exclui o cartão nubank');
    expect(delConfirmDone.toolCalls).toHaveLength(1);
    expect(delConfirmDone.toolCalls[0].status).toBe('PENDING_CONFIRMATION');

    const confirmRes = await confirmPendingAction(delConfirmDone.toolCalls[0].actionId, testDb);
    expect(confirmRes.ok).toBe(true);
    expect(await finances.getCreditCard(card.id)).toBeUndefined();

    const restoreRes = await undoChatAction(delConfirmDone.toolCalls[0].actionId, testDb);
    expect(restoreRes.ok).toBe(true);
    const restoredCard = (await finances.getCreditCard(card.id))!;
    expect(restoredCard).toBeDefined();
    expect(restoredCard.name).toBe('NUBANK');

    // Undo original createCreditCard deletes it cleanly
    await undoChatAction(createDone.toolCalls[0].actionId, testDb);
    expect(await finances.getCreditCard(card.id)).toBeUndefined();
  });

  it('infers Recife reference dates consistently across executeChatTool and rejects invalid Finanças payloads without leaking partial state', async () => {
    const chat = new ChatService(testDb);
    const finances = new FinancesService(testDb);
    const thread = await chat.createThread('FINANCES RECIFE & VALIDATION');

    const txRes = await executeChatTool(
      'createTransaction',
      { description: 'Freela API', amountCents: 120000 },
      { threadId: thread.id, db: testDb, currentDateRecife: '2026-11-20' },
    );
    expect(txRes.status).toBe('CONFIRMED');
    const tx = await finances.getTransaction((txRes.data as any).id);
    expect(tx?.type).toBe('INCOME');
    expect(tx?.category).toBe('TRABALHO');
    expect(tx?.occurredAt).toBe('2026-11-20');

    const billRes = await executeChatTool(
      'createPayableBill',
      { title: 'Aluguel Apartamento', amountCents: 180000 },
      { threadId: thread.id, db: testDb, currentDateRecife: '2026-11-20' },
    );
    expect(billRes.status).toBe('CONFIRMED');
    const bill = await finances.getPayableBill((billRes.data as any).id);
    expect(bill?.billType).toBe('FIXED_RECURRING');
    expect(bill?.category).toBe('MORADIA');
    expect(bill?.dueDate).toBe('2026-11-20');
    expect(bill?.competenceMonth).toBe('2026-11');

    const planRes = await executeChatTool(
      'createInstallmentPlan',
      { description: 'Curso Inglês', totalInstallments: 6, installmentAmountCents: 20000 },
      { threadId: thread.id, db: testDb, currentDateRecife: '2026-11-20' },
    );
    expect(planRes.status).toBe('CONFIRMED');
    const plan = await finances.getInstallmentPlan((planRes.data as any).id);
    expect(plan?.category).toBe('EDUCAÇÃO');
    expect(plan?.startMonth).toBe('2026-11');
    expect(plan?.paidInstallments).toBe(0);

    // Additional PRESET_TRANSACTION_CATEGORIES inference checks + fallback OUTROS
    const catCases: Array<[string, string, 'INCOME' | 'EXPENSE']> = [
      ['Assinatura Netflix', 'ASSINATURAS', 'EXPENSE'],
      ['Consulta Dentista', 'SAÚDE', 'EXPENSE'],
      ['Ingresso Cinema', 'LAZER', 'EXPENSE'],
      ['Pix recebido reembolso', 'OUTROS', 'INCOME'],
      ['Pagamento aluguel', 'MORADIA', 'EXPENSE'],
    ];
    const extraActionIds: string[] = [];
    for (const [desc, expectedCategory, expectedType] of catCases) {
      const res = await executeChatTool(
        'createTransaction',
        { description: desc, amountCents: 3000 },
        { threadId: thread.id, db: testDb, currentDateRecife: '2026-11-20' },
      );
      const created = (await finances.getTransaction((res.data as any).id))!;
      expect(created.category).toBe(expectedCategory);
      expect(created.type).toBe(expectedType);
      expect(PRESET_TRANSACTION_CATEGORIES).toContain(created.category);
      extraActionIds.push(res.actionId!);
    }

    // Validation failures via canonical schemas
    await expect(
      executeChatTool(
        'createTransaction',
        { description: 'Almoço', amountCents: -100 },
        { threadId: thread.id, db: testDb },
      ),
    ).rejects.toThrow();

    await expect(
      executeChatTool(
        'createPayableBill',
        { title: 'Conta', billType: 'INVALID_BILL_TYPE', amountCents: 1000, dueDate: '2026-11-20' },
        { threadId: thread.id, db: testDb },
      ),
    ).rejects.toThrow();

    await expect(
      executeChatTool(
        'createCreditCard',
        { name: 'C6', closingDay: 8 },
        { threadId: thread.id, db: testDb },
      ),
    ).rejects.toThrow();

    for (const id of extraActionIds) {
      await undoChatAction(id, testDb);
    }
    await undoChatAction(txRes.actionId!, testDb);
    await undoChatAction(billRes.actionId!, testDb);
    await undoChatAction(planRes.actionId!, testDb);
  });
});
