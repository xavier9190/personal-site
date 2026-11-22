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
        const tx = await this.finances.getTransaction(id);
        if (tx) {
          description = `EXCLUIR TRANSAÇÃO: ${tx.description} (${formatCentsToBRL(tx.amountCents)})`;
          entitySnapshot = tx;
        } else {
          description = `EXCLUIR TRANSAÇÃO: ID ${id}`;
        }
        break;
      }
      case 'deletePayableBill': {
        const bill = await this.finances.getPayableBill(id);
        if (bill) {
          description = `EXCLUIR CONTA A PAGAR: ${bill.title} (${formatCentsToBRL(bill.amountCents)})`;
          entitySnapshot = bill;
        } else {
          description = `EXCLUIR CONTA A PAGAR: ID ${id}`;
        }
        break;
      }
      case 'deleteInstallmentPlan': {
        const plan = await this.finances.getInstallmentPlan(id);
        if (plan) {
          description = `EXCLUIR PARCELAMENTO: ${plan.description}`;
          entitySnapshot = plan;
        } else {
          description = `EXCLUIR PARCELAMENTO: ID ${id}`;
        }
        break;
      }
      case 'deleteCreditCard': {
        const card = await this.finances.getCreditCard(id);
        if (card) {
          description = `EXCLUIR CARTÃO: ${card.name}`;
          entitySnapshot = card;
        } else {
          description = `EXCLUIR CARTÃO: ID ${id}`;
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
        const ms = await this.academic.getMilestoneById(id);
        if (ms) {
          description = `EXCLUIR MARCO ACADÊMICO: ${ms.title} (${ms.dueDate})`;
          entitySnapshot = ms;
        } else {
          description = `EXCLUIR MARCO ACADÊMICO: ID ${id}`;
        }
        break;
      }
      case 'deleteProjectLink': {
        const link = await this.academic.getProjectLinkById(id);
        if (link) {
          description = `EXCLUIR LINK DE PROJETO: ${link.label} (${link.url})`;
          entitySnapshot = link;
        } else {
          description = `EXCLUIR LINK DE PROJETO: ID ${id}`;
        }
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
        const before = await this.finances.getTransaction(args.id);
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
      case 'updatePayableBill': {
        const before = await this.finances.getPayableBill(args.id);
        if (!before) throw new Error(`CONTA NÃO ENCONTRADA: ${args.id}`);
        const updated = await this.finances.updatePayableBill(args.id, args);
        description = `ATUALIZOU CONTA A PAGAR: ${updated.title} (${formatCentsToBRL(updated.amountCents)})`;
        snapshot = { entity: 'PAYABLE_BILL', operation: 'UPDATE', id: args.id, previousData: before };
        data = updated;
        break;
      }
      case 'togglePayableBillStatus': {
        const bill = await this.finances.getPayableBill(args.id);
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
      case 'updateInstallmentPlan': {
        const before = await this.finances.getInstallmentPlan(args.id);
        if (!before) throw new Error(`PARCELAMENTO NÃO ENCONTRADO: ${args.id}`);
        const updated = await this.finances.updateInstallmentPlan(args.id, args);
        description = `ATUALIZOU PARCELAMENTO: ${updated.description} (${updated.totalInstallments}X DE ${formatCentsToBRL(updated.installmentAmountCents)})`;
        snapshot = {
          entity: 'INSTALLMENT_PLAN',
          operation: 'UPDATE',
          id: args.id,
          previousData: before,
        };
        data = updated;
        break;
      }
      case 'advanceInstallment': {
        const before = await this.finances.getInstallmentPlan(args.id);
        if (!before) throw new Error(`PARCELAMENTO NÃO ENCONTRADO: ${args.id}`);
        const updated = await this.finances.advanceInstallment(args.id);
        description = `AVANÇOU PARCELA: ${updated.description} (${updated.paidInstallments}/${updated.totalInstallments})`;
        snapshot = {
          entity: 'INSTALLMENT_PLAN',
          operation: 'UPDATE',
          id: args.id,
          previousData: before,
        };
        data = updated;
        break;
      }
      case 'createCreditCard': {
        const card = await this.finances.createCreditCard(args);
        description = `CRIOU CARTÃO: ${card.name} (FECHA DIA ${card.closingDay}, VENCE DIA ${card.dueDay})`;
        snapshot = { entity: 'CREDIT_CARD', operation: 'CREATE', id: card.id };
        data = card;
        break;
      }
      case 'updateCreditCard': {
        const before = await this.finances.getCreditCard(args.id);
        if (!before) throw new Error(`CARTÃO NÃO ENCONTRADO: ${args.id}`);
        const updated = await this.finances.updateCreditCard(args.id, args);
        description = `ATUALIZOU CARTÃO: ${updated.name} (FECHA DIA ${updated.closingDay}, VENCE DIA ${updated.dueDay})`;
        snapshot = {
          entity: 'CREDIT_CARD',
          operation: 'UPDATE',
          id: args.id,
          previousData: before,
        };
        data = updated;
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
        if (!before) throw new Error(`PROJETO NÃO ENCONTRADO: ${args.id}`);
        const proj = await this.academic.updateProject(args.id, {
          title: args.title,
          description: args.description,
          finalDeliveryDate: args.finalDeliveryDate,
          groupMembers: args.groupMembers,
          links: args.links,
          status: args.status,
        });
        description = `ATUALIZOU PROJETO: ${proj.title}`;
        snapshot = { entity: 'ACADEMIC_PROJECT', operation: 'UPDATE', id: args.id, previousData: before };
        data = proj;
        break;
      }
      case 'startProject': {
        const before = await this.academic.getProjectDetails(args.id);
        if (!before) throw new Error(`PROJETO NÃO ENCONTRADO: ${args.id}`);
        await this.academic.startProject(args.id);
        description = `INICIOU PROJETO: ${before.title}`;
        snapshot = {
          entity: 'ACADEMIC_PROJECT_STATUS',
          operation: 'UPDATE',
          id: args.id,
          previousStatus: before.status,
        };
        data = { id: args.id, status: 'IN_PROGRESS' };
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
          sortOrder: args.sortOrder,
        });
        description = `ADICIONOU MARCO: ${milestone.title} (${milestone.dueDate})`;
        snapshot = { entity: 'PROJECT_MILESTONE', operation: 'CREATE', id: milestone.id };
        data = milestone;
        break;
      }
      case 'updateMilestone': {
        const before = await this.academic.getMilestoneById(args.id);
        if (!before) throw new Error(`MARCO NÃO ENCONTRADO: ${args.id}`);
        const milestone = await this.academic.updateMilestone(args.id, {
          title: args.title,
          dueDate: args.dueDate,
          isCompleted: args.isCompleted,
          sortOrder: args.sortOrder,
        });
        description = `ATUALIZOU MARCO: ${milestone.title}`;
        snapshot = { entity: 'PROJECT_MILESTONE', operation: 'UPDATE', id: args.id, previousData: before };
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
      case 'addProjectLink': {
        const link = await this.academic.addProjectLink(args.projectId, {
          label: args.label,
          url: args.url,
        });
        description = `ADICIONOU LINK AO PROJETO: ${link.label} (${link.url})`;
        snapshot = { entity: 'PROJECT_LINK', operation: 'CREATE', id: link.id };
        data = link;
        break;
      }
      case 'updateProjectLink': {
        const before = await this.academic.getProjectLinkById(args.id);
        if (!before) throw new Error(`LINK NÃO ENCONTRADO: ${args.id}`);
        const link = await this.academic.updateProjectLink(args.id, {
          label: args.label,
          url: args.url,
        });
        description = `ATUALIZOU LINK DE PROJETO: ${link.label}`;
        snapshot = { entity: 'PROJECT_LINK', operation: 'UPDATE', id: args.id, previousData: before };
        data = link;
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
        const item = await this.shopping.updateWishlistItem(args.id, {
          name: args.name,
          priceCents: args.priceCents,
          productUrl: args.productUrl,
        });
        description = `ATUALIZOU ITEM WISHLIST: ${item.name}`;
        snapshot = { entity: 'SHOPPING_ITEM', operation: 'UPDATE', id: args.id, previousData: before };
        data = item;
        break;
      }
      case 'addPurchasedItem': {
        const item = await this.shopping.addPurchasedItem({
          name: args.name,
          priceCents: args.priceCents,
          productUrl: args.productUrl,
          storeApp: args.storeApp,
          estimatedDeliveryDate: args.estimatedDeliveryDate,
          purchasedAt: args.purchasedAt,
          alreadyLoggedInFinances: args.alreadyLoggedInFinances,
          payment: args.payment,
        });
        description = `REGISTROU COMPRA EM TRÂNSITO: ${item.name} (${item.storeApp})`;
        snapshot = {
          entity: 'SHOPPING_PURCHASED_CREATE',
          operation: 'CREATE',
          id: item.id,
          alreadyLoggedInFinances: args.alreadyLoggedInFinances,
        };
        data = item;
        break;
      }
      case 'updateInTransitItem': {
        const sections = await this.shopping.listItemsBySection();
        const before = sections.inTransit.find((i) => i.id === args.id);
        const item = await this.shopping.updateInTransitItem(args.id, {
          name: args.name,
          priceCents: args.priceCents,
          productUrl: args.productUrl,
          storeApp: args.storeApp,
          estimatedDeliveryDate: args.estimatedDeliveryDate,
        });
        description = `ATUALIZOU ENTREGA EM TRÂNSITO: ${item.name} (${item.storeApp})`;
        snapshot = {
          entity: 'SHOPPING_IN_TRANSIT_ITEM',
          operation: 'UPDATE',
          id: args.id,
          previousData: before,
        };
        data = item;
        break;
      }
      case 'markPurchased': {
        const sections = await this.shopping.listItemsBySection();
        const before = sections.wishlist.find((i) => i.id === args.id);
        const item = await this.shopping.markPurchased(args.id, {
          storeApp: args.storeApp,
          estimatedDeliveryDate: args.estimatedDeliveryDate,
          purchasedAt: args.purchasedAt,
          alreadyLoggedInFinances: args.alreadyLoggedInFinances,
          payment: args.payment,
        });
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
        const sections = await this.shopping.listItemsBySection();
        const before = sections.delivered.find((i) => i.id === args.id);
        const item = await this.shopping.revertDelivered(args.id);
        description = `REVERTEU PARA A CAMINHO: ${item.name}`;
        snapshot = {
          entity: 'SHOPPING_REVERT_DELIVERED',
          operation: 'UPDATE',
          id: args.id,
          previousDeliveredAt: before?.deliveredAt ?? null,
        };
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
    let nextUndoSnapshotJson: string | undefined;

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
      case 'deleteCreditCard':
        await this.finances.deleteCreditCard(args.id);
        if (action.undoSnapshotJson) {
          nextUndoSnapshotJson = JSON.stringify({
            entity: 'CREDIT_CARD',
            operation: 'DELETE',
            id: args.id,
            previousData: JSON.parse(action.undoSnapshotJson),
          });
        }
        break;
      case 'deleteProject':
        await this.academic.deleteProject(args.id);
        break;
      case 'deleteMilestone':
        await this.academic.deleteMilestone(args.id);
        break;
      case 'deleteProjectLink':
        await this.academic.deleteProjectLink(args.id);
        break;
      case 'deleteWishlistItem':
        await this.shopping.deleteItem(args.id);
        break;
      default:
        throw new Error(`EXCLUSÃO NÃO RECONHECIDA: ${action.toolName}`);
    }

    await this.chat.updatePendingActionStatus(actionId, 'CONFIRMED', nextUndoSnapshotJson);
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
  private async deleteFinancesByShoppingItemId(shoppingItemId: string): Promise<void> {
    const txs = (await this.finances.listTransactions()).filter(
      (t) => t.shoppingItemId === shoppingItemId,
    );
    for (const tx of txs) {
      await this.finances.deleteTransaction(tx.id);
    }

    const plans = (await this.finances.listInstallmentPlans()).filter(
      (p) => p.shoppingItemId === shoppingItemId,
    );
    for (const plan of plans) {
      await this.finances.deleteInstallmentPlan(plan.id);
    }
  }

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
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.finances.updateInstallmentPlan(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'CREDIT_CARD': {
        if (snapshot.operation === 'CREATE') {
          await this.finances.deleteCreditCard(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.finances.updateCreditCard(snapshot.id, snapshot.previousData);
        } else if (snapshot.operation === 'DELETE' && snapshot.previousData) {
          await this.finances.restoreCreditCard(snapshot.previousData);
        }
        break;
      }
      case 'ACADEMIC_PROJECT': {
        if (snapshot.operation === 'CREATE') {
          await this.academic.deleteProject(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          const p = snapshot.previousData;
          await this.academic.updateProject(snapshot.id, {
            title: p.title,
            description: p.description,
            finalDeliveryDate: p.finalDeliveryDate ?? null,
            groupMembers: Array.isArray(p.groupMembersList)
              ? p.groupMembersList
              : typeof p.groupMembers === 'string'
                ? JSON.parse(p.groupMembers)
                : p.groupMembers,
            links: Array.isArray(p.links)
              ? p.links.map((l: { label: string; url: string }) => ({ label: l.label, url: l.url }))
              : undefined,
            status: p.status,
          });
        }
        break;
      }
      case 'ACADEMIC_PROJECT_STATUS': {
        if (snapshot.previousStatus === 'COMPLETED') {
          await this.academic.completeProject(snapshot.id);
        } else if (snapshot.previousStatus === 'PLANNED') {
          await this.academic.updateProject(snapshot.id, { status: 'PLANNED' });
        } else {
          await this.academic.reopenProject(snapshot.id);
        }
        break;
      }
      case 'PROJECT_MILESTONE': {
        if (snapshot.operation === 'CREATE') {
          await this.academic.deleteMilestone(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          const m = snapshot.previousData;
          await this.academic.updateMilestone(snapshot.id, {
            title: m.title,
            dueDate: m.dueDate,
            isCompleted: m.isCompleted,
            sortOrder: m.sortOrder,
          });
        }
        break;
      }
      case 'PROJECT_MILESTONE_STATUS': {
        await this.academic.toggleMilestone(snapshot.id);
        break;
      }
      case 'PROJECT_LINK': {
        if (snapshot.operation === 'CREATE') {
          await this.academic.deleteProjectLink(snapshot.id);
        } else if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          const l = snapshot.previousData;
          await this.academic.updateProjectLink(snapshot.id, {
            label: l.label,
            url: l.url,
          });
        }
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
      case 'SHOPPING_IN_TRANSIT_ITEM': {
        if (snapshot.operation === 'UPDATE' && snapshot.previousData) {
          await this.shopping.updateInTransitItem(snapshot.id, snapshot.previousData);
        }
        break;
      }
      case 'SHOPPING_PURCHASED_CREATE': {
        // Delete synced Finanças records BEFORE deleting the shopping item,
        // because ON DELETE SET NULL clears `shopping_item_id` when the item is removed.
        if (!snapshot.alreadyLoggedInFinances) {
          await this.deleteFinancesByShoppingItemId(snapshot.id);
        }
        await this.shopping.deleteItem(snapshot.id);
        break;
      }
      case 'SHOPPING_PURCHASED': {
        await this.shopping.revertToWishlist(snapshot.id);
        if (!snapshot.alreadyLoggedInFinances) {
          await this.deleteFinancesByShoppingItemId(snapshot.id);
        }
        break;
      }
      case 'SHOPPING_DELIVERED': {
        await this.shopping.revertDelivered(snapshot.id);
        break;
      }
      case 'SHOPPING_REVERT_DELIVERED': {
        await this.shopping.markDelivered(snapshot.id, snapshot.previousDeliveredAt ?? undefined);
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
