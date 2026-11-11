import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { ChatService } from './service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { AcademicService } from '@/features/academic/service';
import { ShoppingService } from '@/features/shopping/service';
import {
  cancelPendingAction,
  ChatToolDispatcher,
  confirmPendingAction,
  executeChatTool,
  undoChatAction,
} from './tools/dispatcher';
import { detectToolIntent, type ChatAttachment } from './ai/intent';

function setup() {
  const { db, close } = createDbClient(':memory:');
  const chat = new ChatService(db);
  const calendar = new CalendarService(db);
  const finances = new FinancesService(db);
  const academic = new AcademicService(db);
  const shopping = new ShoppingService(db);
  const dispatcher = new ChatToolDispatcher(db);
  const thread = chat.createThread('TEST THREAD');

  return {
    db,
    close,
    chat,
    calendar,
    finances,
    academic,
    shopping,
    dispatcher,
    threadId: thread.id,
  };
}

describe('Chat AI Tool Calling, Guardrails & Undo Engine', () => {
  // ============================================================
  // 1. CALENDAR TOOLS INTEGRATION
  // ============================================================
  describe('Calendar Tools', () => {
    it('creates calendar event immediately and reverts upon undo', async () => {
      const { db, close, calendar, threadId } = setup();
      try {
        const result = await executeChatTool(
          'createCalendarEvent',
          {
            title: 'REUNIÃO DE PROJETO',
            date: '2026-11-20',
            startTime: '10:00',
            endTime: '11:00',
            color: '#b2f2bb',
          },
          { threadId, db },
        );

        expect(result.status).toBe('CONFIRMED');
        expect(result.actionId).toBeDefined();

        const events = calendar.listEvents();
        expect(events).toHaveLength(1);
        expect(events[0].title).toBe('REUNIÃO DE PROJETO');

        // Test UNDO
        const undoRes = undoChatAction(result.actionId!, db);
        expect(undoRes.ok).toBe(true);

        const eventsAfterUndo = calendar.listEvents();
        expect(eventsAfterUndo).toHaveLength(0);
      } finally {
        close();
      }
    });

    it('updates calendar event and restores original state upon undo', async () => {
      const { db, close, calendar, threadId } = setup();
      try {
        const ev = calendar.createEvent({
          title: 'AULA INICIAL',
          date: '2026-11-21',
          startTime: '08:00',
          endTime: '10:00',
          color: 'blue',
        });

        const updateResult = await executeChatTool(
          'updateCalendarEvent',
          {
            id: ev.id,
            title: 'AULA ALTERADA',
            date: '2026-11-21',
            startTime: '09:00',
            endTime: '11:00',
          },
          { threadId, db },
        );

        expect(updateResult.status).toBe('CONFIRMED');
        expect(calendar.getEvent(ev.id).title).toBe('AULA ALTERADA');

        // Test UNDO
        const undoRes = undoChatAction(updateResult.actionId!, db);
        expect(undoRes.ok).toBe(true);
        expect(calendar.getEvent(ev.id).title).toBe('AULA INICIAL');
      } finally {
        close();
      }
    });

    it('requires explicit confirmation before deleting calendar event (guardrail)', async () => {
      const { db, close, calendar, threadId } = setup();
      try {
        const ev = calendar.createEvent({
          title: 'COMPROMISSO CRÍTICO',
          date: '2026-11-22',
          startTime: '14:00',
          endTime: '15:00',
          color: 'red',
        });

        // Trigger delete tool
        const deleteResult = await executeChatTool(
          'deleteCalendarEvent',
          { id: ev.id },
          { threadId, db },
        );

        // MUST be staged, NOT deleted yet!
        expect(deleteResult.status).toBe('PENDING_CONFIRMATION');
        expect(deleteResult.isDestructive).toBe(true);
        expect(calendar.listEvents()).toHaveLength(1);

        // Cancel test: cancel should not delete
        const cancelRes = cancelPendingAction(deleteResult.actionId!, db);
        expect(cancelRes.ok).toBe(true);
        expect(calendar.listEvents()).toHaveLength(1);

        // Stage another deletion to test CONFIRM
        const deleteResult2 = await executeChatTool(
          'deleteCalendarEvent',
          { id: ev.id },
          { threadId, db },
        );

        const confirmRes = confirmPendingAction(deleteResult2.actionId!, db);
        expect(confirmRes.ok).toBe(true);
        expect(calendar.listEvents()).toHaveLength(0);
      } finally {
        close();
      }
    });

    it('lists calendar items via listCalendarItems tool', async () => {
      const { db, close, calendar, threadId } = setup();
      try {
        calendar.createEvent({
          title: 'EVENTO PROJETADO',
          date: '2026-11-15',
          allDay: true,
          color: 'green',
        });

        const listResult = await executeChatTool(
          'listCalendarItems',
          { from: '2026-11-01', to: '2026-11-30' },
          { threadId, db },
        );

        expect(listResult.status).toBe('READ_SUCCESS');
        expect(listResult.data).toHaveLength(1);
      } finally {
        close();
      }
    });
  });

  // ============================================================
  // 2. FINANCES TOOLS INTEGRATION
  // ============================================================
  describe('Finances Tools', () => {
    it('creates and updates transactions with undo support', async () => {
      const { db, close, finances, threadId } = setup();
      try {
        const createResult = await executeChatTool(
          'createTransaction',
          {
            type: 'EXPENSE',
            description: 'UBER CENTRO',
            category: 'TRANSPORTE',
            amountCents: 4500,
            occurredAt: '2026-11-12',
          },
          { threadId, db },
        );

        expect(createResult.status).toBe('CONFIRMED');
        const txs = finances.listTransactions();
        expect(txs).toHaveLength(1);
        expect(txs[0].description).toBe('UBER CENTRO');

        // Update transaction
        const updateResult = await executeChatTool(
          'updateTransaction',
          {
            id: txs[0].id,
            description: 'UBER AEROPORTO',
            amountCents: 6000,
          },
          { threadId, db },
        );

        expect(updateResult.status).toBe('CONFIRMED');
        expect(finances.listTransactions()[0].description).toBe('UBER AEROPORTO');

        // Undo update
        undoChatAction(updateResult.actionId!, db);
        expect(finances.listTransactions()[0].description).toBe('UBER CENTRO');

        // Undo creation
        undoChatAction(createResult.actionId!, db);
        expect(finances.listTransactions()).toHaveLength(0);
      } finally {
        close();
      }
    });

    it('protects transaction deletion with confirmation guardrail', async () => {
      const { db, close, finances, threadId } = setup();
      try {
        const tx = finances.createTransaction({
          type: 'INCOME',
          description: 'SALÁRIO',
          category: 'SALÁRIO',
          amountCents: 500000,
          occurredAt: '2026-11-05',
        });

        const delResult = await executeChatTool('deleteTransaction', { id: tx.id }, { threadId, db });
        expect(delResult.status).toBe('PENDING_CONFIRMATION');
        expect(finances.listTransactions()).toHaveLength(1);

        confirmPendingAction(delResult.actionId!, db);
        expect(finances.listTransactions()).toHaveLength(0);
      } finally {
        close();
      }
    });

    it('creates payable bill and toggles status with undo support', async () => {
      const { db, close, finances, threadId } = setup();
      try {
        const billRes = await executeChatTool(
          'createPayableBill',
          {
            title: 'CONTA DE LUZ',
            billType: 'FIXED_RECURRING',
            category: 'MORADIA',
            amountCents: 15000,
            dueDate: '2026-11-25',
          },
          { threadId, db },
        );

        const bills = finances.listPayableBills();
        expect(bills).toHaveLength(1);
        expect(bills[0].status).toBe('PENDING');

        // Toggle status to paid
        const toggleRes = await executeChatTool(
          'togglePayableBillStatus',
          { id: bills[0].id, paid: true },
          { threadId, db },
        );

        expect(finances.listPayableBills()[0].status).toBe('PAID');

        // Undo toggle
        undoChatAction(toggleRes.actionId!, db);
        expect(finances.listPayableBills()[0].status).toBe('PENDING');

        // Delete bill with confirmation guardrail
        const delBillRes = await executeChatTool('deletePayableBill', { id: bills[0].id }, { threadId, db });
        expect(delBillRes.status).toBe('PENDING_CONFIRMATION');
        confirmPendingAction(delBillRes.actionId!, db);
        expect(finances.listPayableBills()).toHaveLength(0);
      } finally {
        close();
      }
    });

    it('creates and deletes installment plans with guardrails and undo', async () => {
      const { db, close, finances, threadId } = setup();
      try {
        const planRes = await executeChatTool(
          'createInstallmentPlan',
          {
            description: 'NOTEBOOK DELL',
            category: 'TECNOLOGIA',
            totalInstallments: 10,
            installmentAmountCents: 35000,
            startMonth: '2026-11',
          },
          { threadId, db },
        );

        expect(finances.listInstallmentPlans()).toHaveLength(1);

        // Delete guardrail
        const planId = finances.listInstallmentPlans()[0].id;
        const delPlanRes = await executeChatTool('deleteInstallmentPlan', { id: planId }, { threadId, db });
        expect(delPlanRes.status).toBe('PENDING_CONFIRMATION');

        confirmPendingAction(delPlanRes.actionId!, db);
        expect(finances.listInstallmentPlans()).toHaveLength(0);
      } finally {
        close();
      }
    });
  });

  // ============================================================
  // 3. ACADEMIC TOOLS INTEGRATION
  // ============================================================
  describe('Academic Tools', () => {
    it('manages projects, completion, and milestones with undo', async () => {
      const { db, close, academic, threadId } = setup();
      try {
        // Create project
        const projRes = await executeChatTool(
          'createProject',
          {
            title: 'SISTEMAS DISTRIBUÍDOS',
            description: 'PROJETO FINAL',
            finalDeliveryDate: '2026-12-10',
          },
          { threadId, db },
        );

        const project = academic.listProjectsByStatus().inProgress[0];
        expect(project.title).toBe('SISTEMAS DISTRIBUÍDOS');

        // Complete project
        const compRes = await executeChatTool('completeProject', { id: project.id }, { threadId, db });
        expect(academic.listProjectsByStatus().completed).toHaveLength(1);

        // Undo completion
        undoChatAction(compRes.actionId!, db);
        expect(academic.listProjectsByStatus().inProgress).toHaveLength(1);

        // Reopen project
        await executeChatTool('completeProject', { id: project.id }, { threadId, db });
        const reopenRes = await executeChatTool('reopenProject', { id: project.id }, { threadId, db });
        expect(academic.listProjectsByStatus().inProgress).toHaveLength(1);

        // Add milestone
        const msRes = await executeChatTool(
          'addMilestone',
          {
            projectId: project.id,
            title: 'ENTREGA PARCIAL 1',
            dueDate: '2026-11-28',
          },
          { threadId, db },
        );

        const msId = (msRes.data as any).id;
        expect(academic.getProjectDetails(project.id)?.milestones).toHaveLength(1);

        // Toggle milestone [OK]
        const toggleMsRes = await executeChatTool('toggleMilestone', { id: msId }, { threadId, db });
        expect(academic.getProjectDetails(project.id)?.milestones[0].isCompleted).toBe(true);

        // Undo milestone toggle
        undoChatAction(toggleMsRes.actionId!, db);
        expect(academic.getProjectDetails(project.id)?.milestones[0].isCompleted).toBe(false);

        // Delete milestone guardrail
        const delMs = await executeChatTool('deleteMilestone', { id: msId }, { threadId, db });
        expect(delMs.status).toBe('PENDING_CONFIRMATION');
        confirmPendingAction(delMs.actionId!, db);
        expect(academic.getProjectDetails(project.id)?.milestones).toHaveLength(0);

        // Delete project guardrail
        const delProj = await executeChatTool('deleteProject', { id: project.id }, { threadId, db });
        expect(delProj.status).toBe('PENDING_CONFIRMATION');
        confirmPendingAction(delProj.actionId!, db);
        expect(academic.listProjectsByStatus().inProgress).toHaveLength(0);
      } finally {
        close();
      }
    });
  });

  // ============================================================
  // 4. SHOPPING TOOLS INTEGRATION
  // ============================================================
  describe('Shopping Tools', () => {
    it('manages wishlist items and purchase flow with financial sync rollback', async () => {
      const { db, close, shopping, finances, threadId } = setup();
      try {
        // Add wishlist item
        const addRes = await executeChatTool(
          'addWishlistItem',
          {
            name: 'TECLADO KEYCHRON K2',
            priceCents: 45000,
            productUrl: 'https://exemplo.com/teclado',
          },
          { threadId, db },
        );

        expect(shopping.listItemsBySection().wishlist).toHaveLength(1);

        // Update wishlist item
        const itemId = (addRes.data as any).id;
        const updateRes = await executeChatTool(
          'updateWishlistItem',
          {
            id: itemId,
            name: 'TECLADO KEYCHRON K2 PRO',
            priceCents: 50000,
          },
          { threadId, db },
        );

        expect(shopping.listItemsBySection().wishlist[0].name).toBe('TECLADO KEYCHRON K2 PRO');
        undoChatAction(updateRes.actionId!, db);
        expect(shopping.listItemsBySection().wishlist[0].name).toBe('TECLADO KEYCHRON K2');

        // Mark purchased (with auto-finance sync)
        const buyRes = await executeChatTool(
          'markPurchased',
          {
            id: itemId,
            storeApp: 'ALIEXPRESS',
            estimatedDeliveryDate: '2026-12-05',
            alreadyLoggedInFinances: false,
            payment: { mode: 'CASH' },
          },
          { threadId, db },
        );

        expect(shopping.listItemsBySection().inTransit).toHaveLength(1);
        expect(finances.listTransactions()).toHaveLength(1);

        // Undo purchase -> should revert item to wishlist AND remove the finances transaction!
        const undoBuyRes = undoChatAction(buyRes.actionId!, db);
        expect(undoBuyRes.ok).toBe(true);
        expect(shopping.listItemsBySection().wishlist).toHaveLength(1);
        expect(finances.listTransactions()).toHaveLength(0);

        // Mark delivered and revert
        await executeChatTool(
          'markPurchased',
          {
            id: itemId,
            storeApp: 'ALIEXPRESS',
            estimatedDeliveryDate: '2026-12-05',
            alreadyLoggedInFinances: true,
          },
          { threadId, db },
        );

        const delivRes = await executeChatTool('markDelivered', { id: itemId }, { threadId, db });
        expect(shopping.listItemsBySection().delivered).toHaveLength(1);

        undoChatAction(delivRes.actionId!, db);
        expect(shopping.listItemsBySection().inTransit).toHaveLength(1);

        // Delete item guardrail
        const delRes = await executeChatTool('deleteWishlistItem', { id: itemId }, { threadId, db });
        expect(delRes.status).toBe('PENDING_CONFIRMATION');
        confirmPendingAction(delRes.actionId!, db);
        expect(shopping.listItemsBySection().inTransit).toHaveLength(0);
      } finally {
        close();
      }
    });
  });

  // ============================================================
  // 5. INTENT DETECTION & ATTACHMENT PROCESSING
  // ============================================================
  describe('Intent Detection & Attachments', () => {
    it('detects transaction intent from CSV attachment', () => {
      const { db, close } = setup();
      try {
        const attachment: ChatAttachment = {
          id: '1',
          name: 'extrato.csv',
          type: 'text/csv',
          size: 120,
          textContent: 'Data,Descricao,Valor\n2026-11-12,MERCADO EXTRA,125.50',
        };

        const intent = detectToolIntent('lança meu extrato', [attachment], db);
        expect(intent).not.toBeNull();
        expect(intent?.toolName).toBe('createTransaction');
        expect(intent?.args.amountCents).toBe(12550);
        expect(intent?.args.description).toBe('MERCADO EXTRA');
      } finally {
        close();
      }
    });

    it('detects receipt extraction intent from image attachment', () => {
      const { db, close } = setup();
      try {
        const attachment: ChatAttachment = {
          id: '2',
          name: 'comprovante_pix.png',
          type: 'image/png',
          size: 2048,
        };

        const intent = detectToolIntent('lança esse comprovante de 85 reais em finanças', [attachment], db);
        expect(intent).not.toBeNull();
        expect(intent?.toolName).toBe('createTransaction');
        expect(intent?.args.amountCents).toBe(8500);
      } finally {
        close();
      }
    });

    it('detects destructive deletion commands and maps to pending actions', () => {
      const { db, close, academic } = setup();
      try {
        academic.createProject({ title: 'COMPILADORES', description: 'PROJETO FINAL' });
        const intent = detectToolIntent('apaga o projeto compiladores', [], db);
        expect(intent).not.toBeNull();
        expect(intent?.toolName).toBe('deleteProject');
      } finally {
        close();
      }
    });
  });
});
