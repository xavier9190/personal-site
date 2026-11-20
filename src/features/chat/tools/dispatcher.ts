import crypto from 'node:crypto';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { CalendarService, type EventColor } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { AcademicService } from '@/features/academic/service';
import { ShoppingService } from '@/features/shopping/service';
import { ChatService } from '@/features/chat/service';
import { formatCentsToBRL } from '@/lib/currency';
import { ACTION_CATALOG, computeDefaultEndTime, HEX_TO_COLOR } from './catalog';
import type { DraftSummary } from './slots';

export interface ToolExecutionContext {
  threadId: string;
  db?: AppDatabase;
  currentDateRecife?: string;
  draftActionId?: string;
}

export interface ToolExecutionResult {
  toolName: string;
  status: 'DRAFTING' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'READ_SUCCESS';
  actionId?: string;
  description: string;
  isDestructive: boolean;
  data?: unknown;
  error?: string;
  draftArgs?: Record<string, unknown>;
  missingFields?: string[];
  missingFieldLabels?: string[];
  draftSummary?: DraftSummary;
}

export class ChatToolDispatcher {
  private readonly calendar: CalendarService;
  private readonly finances: FinancesService;
  private readonly academic: AcademicService;
  private readonly shopping: ShoppingService;
  private readonly chat: ChatService;

  constructor(private readonly db: AppDatabase = getDb()) {
    this.calendar = new CalendarService(db);
    this.finances = new FinancesService(db);
    this.academic = new AcademicService(db);
    this.shopping = new ShoppingService(db);
    this.chat = new ChatService(db);
  }

  async execute(
    toolName: string,
    rawArgs: unknown,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const definition = ACTION_CATALOG[toolName];
    if (!definition) {
      throw new Error(`TOOL DESCONHECIDA: ${toolName}`);
    }

    const preparedArgs =
      definition.applyDefaults && rawArgs && typeof rawArgs === 'object'
        ? definition.applyDefaults(rawArgs as Record<string, unknown>, {
            currentDateRecife: context.currentDateRecife,
          })
        : rawArgs;

    const validatedArgs = definition.schema.parse(preparedArgs);

    // ============================================================
    // DESTRUCTIVE ACTIONS: GUARDRAIL OBRIGATÓRIO (NÃO EXECUTA DIRETO)
    // ============================================================
    if (definition.isDestructive) {
      return this.stagePendingDeletion(toolName, validatedArgs, context);
    }

    // ============================================================
    // READ / QUERY ACTIONS (SEM MUTACAO / SEM UNDO)
    // ============================================================
    if (toolName === 'listCalendarItems') {
      const args = validatedArgs as { from: string; to: string };
      const items = await this.calendar.listItems(args.from, args.to);
      return {
        toolName,
        status: 'READ_SUCCESS',
        description: `CONSULTA CALENDÁRIO: ${items.length} ITENS ENCONTRADOS`,
        isDestructive: false,
        data: items,
      };
    }

    // ============================================================
    // MUTATIONS (EXECUÇÃO IMEDIATA + GRAVAÇÃO DE SNAPSHOT PARA DESFAZER)
    // ============================================================
    return this.executeMutationWithUndo(toolName, validatedArgs, context);
  }

  // ------------------------------------------------------------
  // Staging destructive actions for confirmation
  // ------------------------------------------------------------
  private async stagePendingDeletion(
    toolName: string,
    args: any,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    const id = args.id;
    let description = `CONFIRMAR EXCLUSÃO: ${id}`;
    let entitySnapshot: any = null;

    switch (toolName) {
      case 'deleteCalendarEvent': {
        try {
          const ev = await this.calendar.getEvent(id);
          description = `EXCLUIR EVENTO: ${ev.title} (${ev.startAt.slice(0, 10)})`;
          entitySnapshot = ev;
        } catch {
          description = `EXCLUIR EVENTO: ID ${id}`;
        }
        break;
      }
      case 'deleteTransaction': {
        const tx = (await this.finances.listTransactions()).find((t) => t.id === id);
        if (tx) {
          description = `EXCLUIR TRANSAÇÃO: ${tx.description} (${formatCentsToBRL(tx.amountCents)})`;
          entitySnapshot = tx;
        } else {
          description = `EXCLUIR TRANSAÇÃO: ID ${id}`;
        }
        break;
      }
      case 'deletePayableBill': {
        const bill = (await this.finances.listPayableBills()).find((b) => b.id === id);
        if (bill) {
          description = `EXCLUIR CONTA A PAGAR: ${bill.title} (${formatCentsToBRL(bill.amountCents)})`;
          entitySnapshot = bill;
        } else {
          description = `EXCLUIR CONTA A PAGAR: ID ${id}`;
        }
        break;
      }
      case 'deleteInstallmentPlan': {
        const plan = (await this.finances.listInstallmentPlans()).find((p) => p.id === id);
        if (plan) {
          description = `EXCLUIR PARCELAMENTO: ${plan.description}`;
          entitySnapshot = plan;
        } else {
          description = `EXCLUIR PARCELAMENTO: ID ${id}`;
        }
        break;
      }
      case 'deleteProject': {
        const project = await this.academic.getProjectDetails(id);
        if (project) {
          description = `EXCLUIR PROJETO: ${project.title}`;
          entitySnapshot = project;
        } else {
          description = `EXCLUIR PROJETO: ID ${id}`;
        }
        break;
      }
      case 'deleteMilestone': {
        description = `EXCLUIR MARCO ACADÊMICO: ID ${id}`;
        break;
      }
      case 'deleteWishlistItem': {
        const sections = await this.shopping.listItemsBySection();
        const item =
          sections.wishlist.find((i) => i.id === id) ||
          sections.inTransit.find((i) => i.id === id) ||
          sections.delivered.find((i) => i.id === id);
        if (item) {
          description = `EXCLUIR ITEM: ${item.name}`;
          entitySnapshot = item;
        } else {
          description = `EXCLUIR ITEM DE COMPRAS: ID ${id}`;
        }
        break;
      }
    }

    const snapshotJson = entitySnapshot ? JSON.stringify(entitySnapshot) : null;
    const actionRecord = context.draftActionId
      ? await this.chat.completeDraft(context.draftActionId, {
          argsJson: JSON.stringify(args),
          status: 'PENDING_CONFIRMATION',
          undoSnapshotJson: snapshotJson,
        })
      : await this.chat.createPendingAction({
          id: crypto.randomUUID(),
          threadId: context.threadId,
          toolName,
          argsJson: JSON.stringify(args),
          status: 'PENDING_CONFIRMATION',
          undoSnapshotJson: snapshotJson,
        });

    return {
      toolName,
      status: 'PENDING_CONFIRMATION',
      actionId: actionRecord.id,
      description,
      isDestructive: true,
      data: { args, entitySnapshot },
    };
  }

  // ------------------------------------------------------------
  // Mutation execution with undo recording
  // ------------------------------------------------------------
  private async executeMutationWithUndo(
    toolName: string,
    args: any,
    context: ToolExecutionContext,
  ): Promise<ToolExecutionResult> {
    let description = '';
    let snapshot: any = null;
    let data: any = null;

    switch (toolName) {
      // CALENDAR
      case 'createCalendarEvent': {
        const ev = await this.calendar.createEvent(args);
        description = `CRIOU EVENTO: ${ev.title} (${ev.startAt.slice(0, 10)})`;
        snapshot = { entity: 'CALENDAR_EVENT', operation: 'CREATE', id: ev.id };
        data = ev;
        break;
      }
      case 'updateCalendarEvent': {
        const before = await this.calendar.getEvent(args.id);
        const colorKey = args.color ?? (before.color in HEX_TO_COLOR ? HEX_TO_COLOR[before.color] : before.color);
        const allDay = args.allDay !== undefined ? args.allDay : Boolean(before.allDay);
        const nextStartTime = args.startTime ?? (before.allDay ? undefined : before.startAt.slice(11, 16));
        let nextEndTime = args.endTime ?? (before.allDay ? undefined : before.endAt.slice(11, 16));

        if (!allDay && nextStartTime && args.endTime === undefined && (!nextEndTime || nextEndTime <= nextStartTime)) {
          let durationMinutes = 60;
          if (!before.allDay) {
            const [sh, sm] = before.startAt.slice(11, 16).split(':').map(Number);
            const [eh, em] = before.endAt.slice(11, 16).split(':').map(Number);
            const diff = eh * 60 + em - (sh * 60 + sm);
            if (diff > 0) durationMinutes = diff;
          }
          nextEndTime = computeDefaultEndTime(nextStartTime, durationMinutes);
        }

        const merged = {
          title: args.title ?? before.title,
          date: args.date ?? before.startAt.slice(0, 10),
          startTime: allDay ? undefined : nextStartTime,
          endTime: allDay ? undefined : nextEndTime,
          allDay,
          color: colorKey,
          description: args.description !== undefined ? args.description : (before.description ?? undefined),
          recurrence: args.recurrence ?? (before.recurrenceRule as any),
          recurrenceUntil: args.recurrenceUntil !== undefined ? args.recurrenceUntil : (before.recurrenceUntil ?? undefined),
        };
        const updated = await this.calendar.updateEvent(args.id, merged);
        description = `ATUALIZOU EVENTO: ${updated.title}`;
        snapshot = { entity: 'CALENDAR_EVENT', operation: 'UPDATE', id: args.id, previousData: before };
        data = updated;
        break;
      }

      // FINANCES
      case 'createTransaction': {
        const tx = await this.finances.createTransaction(args);
        description = `CRIOU TRANSAÇÃO: ${tx.description} (${formatCentsToBRL(tx.amountCents)})`;
        snapshot = { entity: 'TRANSACTION', operation: 'CREATE', id: tx.id };
        data = tx;
        break;
      }
      case 'updateTransaction': {
        const before = (await this.finances.listTransactions()).find((t) => t.id === args.id);
        const updated = await this.finances.updateTransaction(args.id, args);
        description = `ATUALIZOU TRANSAÇÃO: ${updated.description}`;
        snapshot = { entity: 'TRANSACTION', operation: 'UPDATE', id: args.id, previousData: before };
        data = updated;
        break;
      }
      case 'createPayableBill': {
        const bill = await this.finances.createPayableBill(args);
        description = `CRIOU CONTA A PAGAR: ${bill.title} (${formatCentsToBRL(bill.amountCents)})`;
        snapshot = { entity: 'PAYABLE_BILL', operation: 'CREATE', id: bill.id };
        data = bill;
        break;
      }
      case 'togglePayableBillStatus': {
        const bill = (await this.finances.listPayableBills()).find((b) => b.id === args.id);
        if (!bill) throw new Error(`CONTA NÃO ENCONTRADA: ${args.id}`);
        const willBePaid = args.paid !== undefined ? args.paid : bill.status !== 'PAID';
        const updated = willBePaid
          ? await this.finances.markBillPaid(args.id)
          : await this.finances.markBillPending(args.id);
        description = `CONTA ${updated.title}: ${updated.status === 'PAID' ? 'PAGA' : 'FALTA PAGAR'}`;
        snapshot = {
          entity: 'PAYABLE_BILL_STATUS',
          operation: 'UPDATE',
          id: args.id,
          previousStatus: bill.status,
          previousPaidAt: bill.paidAt,
        };
        data = updated;
        break;
      }
      case 'createInstallmentPlan': {
        const plan = await this.finances.createInstallmentPlan(args);
        description = `CRIOU PARCELAMENTO: ${plan.description} (${plan.totalInstallments}X DE ${formatCentsToBRL(plan.installmentAmountCents)})`;
        snapshot = { entity: 'INSTALLMENT_PLAN', operation: 'CREATE', id: plan.id };
        data = plan;
        break;
      }

      // ACADEMIC
      case 'createProject': {
        const proj = await this.academic.createProject(args);
        description = `CRIOU PROJETO: ${proj.title}`;
        snapshot = { entity: 'ACADEMIC_PROJECT', operation: 'CREATE', id: proj.id };
        data = proj;
        break;
      }
      case 'updateProject': {
        const before = await this.academic.getProjectDetails(args.id);
        const proj = await this.academic.updateProject(args.id, args);
        description = `ATUALIZOU PROJETO: ${proj.title}`;
        snapshot = { entity: 'ACADEMIC_PROJECT', operation: 'UPDATE', id: args.id, previousData: before };
        data = proj;
        break;
      }
      case 'completeProject': {
        const before = await this.academic.getProjectDetails(args.id);
        if (!before) throw new Error(`PROJETO NÃO ENCONTRADO: ${args.id}`);
        await this.academic.completeProject(args.id);
        description = `CONCLUIU PROJETO: ${before.title}`;
        snapshot = {
          entity: 'ACADEMIC_PROJECT_STATUS',
          operation: 'UPDATE',
          id: args.id,
          previousStatus: before.status,
        };
        data = { id: args.id, status: 'COMPLETED' };
        break;
      }
      case 'reopenProject': {
        const before = await this.academic.getProjectDetails(args.id);
        if (!before) throw new Error(`PROJETO NÃO ENCONTRADO: ${args.id}`);
        await this.academic.reopenProject(args.id);
        description = `REABRIU PROJETO: ${before.title}`;
        snapshot = {
          entity: 'ACADEMIC_PROJECT_STATUS',
          operation: 'UPDATE',
          id: args.id,
          previousStatus: before.status,
        };
        data = { id: args.id, status: 'IN_PROGRESS' };
        break;
      }
      case 'addMilestone': {
        const milestone = await this.academic.addMilestone(args.projectId, {
          title: args.title,
          dueDate: args.dueDate,
        });
        description = `ADICIONOU MARCO: ${milestone.title} (${milestone.dueDate})`;
        snapshot = { entity: 'PROJECT_MILESTONE', operation: 'CREATE', id: milestone.id };
        data = milestone;
        break;
      }
      case 'toggleMilestone': {
        const milestone = await this.academic.toggleMilestone(args.id);
        description = `MARCO ${milestone.title}: ${milestone.isCompleted ? '[OK]' : 'PENDENTE'}`;
        snapshot = {
          entity: 'PROJECT_MILESTONE_STATUS',
          operation: 'UPDATE',
          id: args.id,
          previousIsCompleted: !milestone.isCompleted,
        };
        data = milestone;
        break;
      }

      // SHOPPING
      case 'addWishlistItem': {
        const item = await this.shopping.addWishlistItem(args);
        description = `ADICIONOU À WISHLIST: ${item.name} (${formatCentsToBRL(item.priceCents)})`;
        snapshot = { entity: 'SHOPPING_ITEM', operation: 'CREATE', id: item.id };
        data = item;
        break;
      }
      case 'updateWishlistItem': {
        const sections = await this.shopping.listItemsBySection();
        const before = sections.wishlist.find((i) => i.id === args.id);
        const item = await this.shopping.updateWishlistItem(args.id, args);
        description = `ATUALIZOU ITEM WISHLIST: ${item.name}`;
        snapshot = { entity: 'SHOPPING_ITEM', operation: 'UPDATE', id: args.id, previousData: before };
        data = item;
        break;
      }
      case 'markPurchased': {
        const sections = await this.shopping.listItemsBySection();
        const before = sections.wishlist.find((i) => i.id === args.id);
        const item = await this.shopping.markPurchased(args.id, args);
        description = `COMPRA REALIZADA: ${item.name} (${item.storeApp})`;
        snapshot = {
          entity: 'SHOPPING_PURCHASED',
          operation: 'UPDATE',
          id: args.id,
          previousData: before,
          alreadyLoggedInFinances: args.alreadyLoggedInFinances,
        };
        data = item;
        break;
      }
      case 'markDelivered': {
        const item = await this.shopping.markDelivered(args.id, args.deliveredAt);
        description = `ENTREGA CONFIRMADA: ${item.name}`;
        snapshot = { entity: 'SHOPPING_DELIVERED', operation: 'UPDATE', id: args.id };
        data = item;
        break;
      }
      case 'revertDelivered': {
        const item = await this.shopping.revertDelivered(args.id);
        description = `REVERTEU PARA A CAMINHO: ${item.name}`;
        snapshot = { entity: 'SHOPPING_REVERT_DELIVERED', operation: 'UPDATE', id: args.id };
        data = item;
        break;
      }
      case 'revertToWishlist': {
        const sections = await this.shopping.listItemsBySection();
        const before =
          sections.inTransit.find((i) => i.id === args.id) ||
          sections.delivered.find((i) => i.id === args.id);
        const item = await this.shopping.revertToWishlist(args.id);
        description = `REVERTEU PARA WISHLIST: ${item.name}`;
        snapshot = { entity: 'SHOPPING_REVERT_WISHLIST', operation: 'UPDATE', id: args.id, previousData: before };
        data = item;
        break;
      }
      default:
        throw new Error(`MUTATION NÃO IMPLEMENTADA: ${toolName}`);
    }

    const snapshotJson = snapshot ? JSON.stringify(snapshot) : null;
    const actionRecord = context.draftActionId
      ? await this.chat.completeDraft(context.draftActionId, {
          argsJson: JSON.stringify(args),
          status: 'CONFIRMED',
          undoSnapshotJson: snapshotJson,
        })
      : await this.chat.createPendingAction({
          id: crypto.randomUUID(),
          threadId: context.threadId,
          toolName,
          argsJson: JSON.stringify(args),
          status: 'CONFIRMED',
          undoSnapshotJson: snapshotJson,
        });

    return {
      toolName,
      status: 'CONFIRMED',
      actionId: actionRecord.id,
      description,
      isDestructive: false,
      data,
    };
  }

  // ------------------------------------------------------------
  // Confirm pending destructive action
  // ------------------------------------------------------------
  async confirmPendingAction(actionId: string): Promise<{ ok: boolean; message: string }> {
    const action = await this.chat.getPendingAction(actionId);
    if (!action) {
      throw new Error(`AÇÃO NÃO ENCONTRADA: ${actionId}`);
    }
    if (action.status !== 'PENDING_CONFIRMATION') {
      return { ok: false, message: `AÇÃO JÁ PROCESSADA COM STATUS: ${action.status}` };
    }

    const args = JSON.parse(action.argsJson);

    switch (action.toolName) {
      case 'deleteCalendarEvent':
        await this.calendar.deleteEvent(args.id);
        break;
      case 'deleteTransaction':
        await this.finances.deleteTransaction(args.id);
        break;
      case 'deletePayableBill':
        await this.finances.deletePayableBill(args.id);
        break;
      case 'deleteInstallmentPlan':
        await this.finances.deleteInstallmentPlan(args.id);
        break;
      case 'deleteProject':
        await this.academic.deleteProject(args.id);
        break;
      case 'deleteMilestone':
        await this.academic.deleteMilestone(args.id);
        break;
      case 'deleteWishlistItem':
        await this.shopping.deleteItem(args.id);
        break;
      default:
        throw new Error(`EXCLUSÃO NÃO RECONHECIDA: ${action.toolName}`);
    }

    await this.chat.updatePendingActionStatus(actionId, 'CONFIRMED');
    return { ok: true, message: 'ITEM EXCLUÍDO COM SUCESSO' };
  }

  // ------------------------------------------------------------
  // Cancel pending action (including active DRAFTING actions)
  // ------------------------------------------------------------
  async cancelPendingAction(actionId: string): Promise<{ ok: boolean; message: string }> {
    const action = await this.chat.getPendingAction(actionId);
    if (!action) {
      throw new Error(`AÇÃO NÃO ENCONTRADA: ${actionId}`);
    }
    if (action.status !== 'PENDING_CONFIRMATION' && action.status !== 'DRAFTING') {
      return { ok: false, message: `AÇÃO NÃO ESTÁ PENDENTE: ${action.status}` };
    }

    await this.chat.updatePendingActionStatus(actionId, 'CANCELLED');
    return {
      ok: true,
      message: action.status === 'DRAFTING' ? 'RASCUNHO CANCELADO' : 'AÇÃO CANCELADA',
    };
  }

  // ------------------------------------------------------------
  // Revert snapshot (UNDO ENGINE)
  // ------------------------------------------------------------
  async undoAction(actionId: string): Promise<{ ok: boolean; message: string }> {
    const action = await this.chat.getPendingAction(actionId);
    if (!action) {
      throw new Error(`AÇÃO NÃO ENCONTRADA: ${actionId}`);
    }
    if (action.status !== 'CONFIRMED') {
      return { ok: false, message: `AÇÃO NÃO PODE SER DESFEITA NO STATUS: ${action.status}` };
    }
    if (!action.undoSnapshotJson) {
      throw new Error('NENHUM SNAPSHOT DE DESFAZER ENCONTRADO PARA ESTA AÇÃO');
    }

    const snapshot = JSON.parse(action.undoSnapshotJson);

    switch (snapshot.entity) {
      case 'CALENDAR_EVENT': {
        if (snapshot.operation === 'CREATE') {
          await this.calendar.deleteEvent(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          const p = snapshot.previousData;
          const colorKey: EventColor = (p.color in HEX_TO_COLOR ? HEX_TO_COLOR[p.color] : p.color) as EventColor;
          await this.calendar.updateEvent(snapshot.id, {
            title: p.title,
            date: p.startAt.slice(0, 10),
            startTime: p.allDay ? undefined : p.startAt.slice(11, 16),
            endTime: p.allDay ? undefined : p.endAt.slice(11, 16),
            allDay: Boolean(p.allDay),
            color: colorKey,
            description: p.description ?? undefined,
            recurrence: p.recurrenceRule as any,
            recurrenceUntil: p.recurrenceUntil ?? undefined,
          });
        }
        break;
      }
      case 'TRANSACTION': {
        if (snapshot.operation === 'CREATE') {
          await this.finances.deleteTransaction(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.finances.updateTransaction(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'PAYABLE_BILL': {
        if (snapshot.operation === 'CREATE') {
          await this.finances.deletePayableBill(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.finances.updatePayableBill(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'PAYABLE_BILL_STATUS': {
        if (snapshot.previousStatus === 'PAID') {
          await this.finances.markBillPaid(snapshot.id, snapshot.previousPaidAt);
        } else {
          await this.finances.markBillPending(snapshot.id);
        }
        break;
      }
      case 'INSTALLMENT_PLAN': {
        if (snapshot.operation === 'CREATE') {
          await this.finances.deleteInstallmentPlan(snapshot.id);
        }
        break;
      }
      case 'ACADEMIC_PROJECT': {
        if (snapshot.operation === 'CREATE') {
          await this.academic.deleteProject(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.academic.updateProject(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'ACADEMIC_PROJECT_STATUS': {
        if (snapshot.previousStatus === 'COMPLETED') {
          await this.academic.completeProject(snapshot.id);
        } else {
          await this.academic.reopenProject(snapshot.id);
        }
        break;
      }
      case 'PROJECT_MILESTONE': {
        if (snapshot.operation === 'CREATE') {
          await this.academic.deleteMilestone(snapshot.id);
        }
        break;
      }
      case 'PROJECT_MILESTONE_STATUS': {
        await this.academic.toggleMilestone(snapshot.id);
        break;
      }
      case 'SHOPPING_ITEM': {
        if (snapshot.operation === 'CREATE') {
          await this.shopping.deleteItem(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.shopping.updateWishlistItem(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'SHOPPING_PURCHASED': {
        await this.shopping.revertToWishlist(snapshot.id);
        if (!snapshot.alreadyLoggedInFinances) {
          // Remove auto-generated finance transactions or installment plans
          const tx = (await this.finances.listTransactions()).find(
            (t) => t.shoppingItemId === snapshot.id,
          );
          if (tx) await this.finances.deleteTransaction(tx.id);

          const plan = (await this.finances.listInstallmentPlans()).find(
            (p) => p.shoppingItemId === snapshot.id,
          );
          if (plan) await this.finances.deleteInstallmentPlan(plan.id);
        }
        break;
      }
      case 'SHOPPING_DELIVERED': {
        await this.shopping.revertDelivered(snapshot.id);
        break;
      }
      case 'SHOPPING_REVERT_DELIVERED': {
        await this.shopping.markDelivered(snapshot.id);
        break;
      }
      case 'SHOPPING_REVERT_WISHLIST': {
        // Revert wishlist item back to in-transit if previousData was in-transit
        if (snapshot.previousData?.status === 'IN_TRANSIT') {
          await this.shopping.markPurchased(snapshot.id, {
            storeApp: snapshot.previousData.storeApp,
            estimatedDeliveryDate: snapshot.previousData.estimatedDeliveryDate,
            purchasedAt: snapshot.previousData.purchasedAt,
            alreadyLoggedInFinances: true,
          });
        }
        break;
      }
      default:
        throw new Error(`REVERSÃO NÃO RECONHECIDA: ${snapshot.entity}`);
    }

    await this.chat.updatePendingActionStatus(actionId, 'UNDONE');
    return { ok: true, message: 'ALTERAÇÃO DESFEITA COM SUCESSO' };
  }
}

export async function executeChatTool(
  toolName: string,
  rawArgs: unknown,
  context: ToolExecutionContext,
): Promise<ToolExecutionResult> {
  const dispatcher = new ChatToolDispatcher(context.db);
  return dispatcher.execute(toolName, rawArgs, context);
}

export async function confirmPendingAction(
  actionId: string,
  db?: AppDatabase,
): Promise<{ ok: boolean; message: string }> {
  const dispatcher = new ChatToolDispatcher(db);
  return dispatcher.confirmPendingAction(actionId);
}

export async function cancelPendingAction(
  actionId: string,
  db?: AppDatabase,
): Promise<{ ok: boolean; message: string }> {
  const dispatcher = new ChatToolDispatcher(db);
  return dispatcher.cancelPendingAction(actionId);
}

export async function undoChatAction(
  actionId: string,
  db?: AppDatabase,
): Promise<{ ok: boolean; message: string }> {
  const dispatcher = new ChatToolDispatcher(db);
  return dispatcher.undoAction(actionId);
}
