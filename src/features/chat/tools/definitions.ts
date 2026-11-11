import { z } from 'zod';
import { toRecifeDateString } from '@/lib/dates';

export const calendarColors = ['green', 'red', 'blue', 'yellow', '#b2f2bb', '#ffc9c9', '#a5d8ff', '#ffec99'] as const;

export const HEX_TO_COLOR: Record<string, 'green' | 'red' | 'blue' | 'yellow'> = {
  '#b2f2bb': 'green',
  '#ffc9c9': 'red',
  '#a5d8ff': 'blue',
  '#ffec99': 'yellow',
  green: 'green',
  red: 'red',
  blue: 'blue',
  yellow: 'yellow',
};

// ==========================================
// 1. CALENDAR TOOLS SCHEMAS
// ==========================================

export const createCalendarEventSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO OBRIGATÓRIO'),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA INVÁLIDA (YYYY-MM-DD)'),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HORA INVÁLIDA (HH:MM)').optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HORA INVÁLIDA (HH:MM)').optional(),
  allDay: z.boolean().optional().default(false),
  color: z
    .enum(calendarColors)
    .optional()
    .default('green')
    .transform((val) => HEX_TO_COLOR[val] ?? 'green'),
  description: z.string().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional().default('NONE'),
  recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA FINAL INVÁLIDA').optional(),
});

export const updateCalendarEventSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  title: z.string().trim().min(1).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  endTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  allDay: z.boolean().optional(),
  color: z
    .enum(calendarColors)
    .optional()
    .transform((val) => (val ? HEX_TO_COLOR[val] : undefined)),
  description: z.string().optional(),
  recurrence: z.enum(['NONE', 'DAILY', 'WEEKLY', 'MONTHLY']).optional(),
  recurrenceUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const deleteCalendarEventSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const listCalendarItemsSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA DE INÍCIO INVÁLIDA'),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA DE FIM INVÁLIDA'),
});

// ==========================================
// 2. FINANCES TOOLS SCHEMAS
// ==========================================

export const createTransactionSchema = z.object({
  type: z.enum(['INCOME', 'EXPENSE']),
  description: z.string().trim().min(1, 'DESCRIÇÃO OBRIGATÓRIA'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  amountCents: z.number().int().positive('VALOR DEVE SER POSITIVO'),
  occurredAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .default(() => toRecifeDateString()),
  status: z.enum(['PAID', 'PENDING']).optional().default('PAID'),
});

export const updateTransactionSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  type: z.enum(['INCOME', 'EXPENSE']).optional(),
  description: z.string().trim().min(1).optional(),
  category: z.string().trim().min(1).optional(),
  amountCents: z.number().int().positive().optional(),
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['PAID', 'PENDING']).optional(),
});

export const deleteTransactionSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const payableBillTypeMap: Record<string, 'FIXED_RECURRING' | 'CREDIT_CARD_BILL' | 'DEBT_TO_PERSON' | 'SINGLE_BILL'> = {
  FIXED: 'FIXED_RECURRING',
  FIXED_RECURRING: 'FIXED_RECURRING',
  CREDIT_CARD: 'CREDIT_CARD_BILL',
  CREDIT_CARD_BILL: 'CREDIT_CARD_BILL',
  DEBT: 'DEBT_TO_PERSON',
  DEBT_TO_PERSON: 'DEBT_TO_PERSON',
  SINGLE_BILL: 'SINGLE_BILL',
};

export const createPayableBillSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO OBRIGATÓRIO'),
  billType: z
    .enum(['FIXED_RECURRING', 'CREDIT_CARD_BILL', 'DEBT_TO_PERSON', 'SINGLE_BILL', 'FIXED', 'CREDIT_CARD', 'DEBT'])
    .transform((val) => payableBillTypeMap[val] ?? 'SINGLE_BILL'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  amountCents: z.number().int().positive('VALOR DEVE SER POSITIVO'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA DE VENCIMENTO INVÁLIDA'),
});

export const togglePayableBillStatusSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  paid: z.boolean().optional(),
});

export const deletePayableBillSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const createInstallmentPlanSchema = z.object({
  description: z.string().trim().min(1, 'DESCRIÇÃO OBRIGATÓRIA'),
  category: z.string().trim().min(1, 'CATEGORIA OBRIGATÓRIA'),
  totalInstallments: z.number().int().min(1, 'PARCELAS DEVEM SER NO MÍNIMO 1'),
  paidInstallments: z.number().int().min(0).optional().default(0),
  installmentAmountCents: z.number().int().positive('VALOR DA PARCELA DEVE SER POSITIVO'),
  startMonth: z.string().regex(/^\d{4}-\d{2}$/, 'MÊS INICIAL INVÁLIDO (YYYY-MM)'),
  creditCardId: z.string().nullable().optional(),
});

export const deleteInstallmentPlanSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

// ==========================================
// 3. ACADEMIC TOOLS SCHEMAS
// ==========================================

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, 'TÍTULO DO PROJETO OBRIGATÓRIO'),
  description: z.string().trim().min(1).optional().default('PROJETO ACADÊMICO'),
  finalDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupMembers: z.array(z.string()).optional().default([]),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional().default([]),
});

export const updateProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  title: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1).optional(),
  finalDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  groupMembers: z.array(z.string()).optional(),
  links: z.array(z.object({ label: z.string(), url: z.string() })).optional(),
});

export const deleteProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const completeProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const reopenProjectSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const addMilestoneSchema = z.object({
  projectId: z.string().min(1, 'ID DO PROJETO OBRIGATÓRIO'),
  title: z.string().trim().min(1, 'TÍTULO DO MARCO OBRIGATÓRIO'),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA DO MARCO INVÁLIDA'),
});

export const toggleMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

export const deleteMilestoneSchema = z.object({
  id: z.string().min(1, 'ID DO MARCO OBRIGATÓRIO'),
});

// ==========================================
// 4. SHOPPING TOOLS SCHEMAS
// ==========================================

export const addWishlistItemSchema = z.object({
  name: z.string().trim().min(1, 'NOME DO PRODUTO OBRIGATÓRIO'),
  priceCents: z.number().int().positive('PREÇO DEVE SER POSITIVO'),
  productUrl: z.string().url().nullable().optional(),
});

export const updateWishlistItemSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  name: z.string().trim().min(1, 'NOME DO PRODUTO OBRIGATÓRIO'),
  priceCents: z.number().int().positive('PREÇO DEVE SER POSITIVO'),
  productUrl: z.string().url().nullable().optional(),
});

export const deleteWishlistItemSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const markPurchasedSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  storeApp: z.string().trim().min(1, 'LOJA/APP OBRIGATÓRIO'),
  estimatedDeliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'DATA ESTIMADA INVÁLIDA'),
  purchasedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  alreadyLoggedInFinances: z.boolean(),
  payment: z
    .discriminatedUnion('mode', [
      z.object({ mode: z.literal('CASH') }),
      z.object({
        mode: z.literal('INSTALLMENTS'),
        totalInstallments: z.number().int().min(2),
        startMonth: z.string().regex(/^\d{4}-\d{2}$/),
        creditCardId: z.string().nullable().optional(),
      }),
    ])
    .optional(),
});

export const markDeliveredSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  deliveredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const revertDeliveredSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const revertToWishlistSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export type ToolModule = 'CALENDAR' | 'FINANCES' | 'ACADEMIC' | 'SHOPPING';

export interface ToolDefinition {
  name: string;
  module: ToolModule;
  description: string;
  isDestructive: boolean;
  schema: z.ZodTypeAny;
}

export const TOOL_DEFINITIONS: Record<string, ToolDefinition> = {
  // Calendar
  createCalendarEvent: {
    name: 'createCalendarEvent',
    module: 'CALENDAR',
    description: 'Cria um novo evento no calendário pessoal.',
    isDestructive: false,
    schema: createCalendarEventSchema,
  },
  updateCalendarEvent: {
    name: 'updateCalendarEvent',
    module: 'CALENDAR',
    description: 'Atualiza um evento existente no calendário.',
    isDestructive: false,
    schema: updateCalendarEventSchema,
  },
  deleteCalendarEvent: {
    name: 'deleteCalendarEvent',
    module: 'CALENDAR',
    description: 'Remove um evento do calendário (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteCalendarEventSchema,
  },
  listCalendarItems: {
    name: 'listCalendarItems',
    module: 'CALENDAR',
    description: 'Lista eventos e projeções unificadas no intervalo de datas.',
    isDestructive: false,
    schema: listCalendarItemsSchema,
  },

  // Finances
  createTransaction: {
    name: 'createTransaction',
    module: 'FINANCES',
    description: 'Registra uma nova movimentação financeira (receita ou despesa).',
    isDestructive: false,
    schema: createTransactionSchema,
  },
  updateTransaction: {
    name: 'updateTransaction',
    module: 'FINANCES',
    description: 'Atualiza uma movimentação financeira existente.',
    isDestructive: false,
    schema: updateTransactionSchema,
  },
  deleteTransaction: {
    name: 'deleteTransaction',
    module: 'FINANCES',
    description: 'Remove uma transação financeira (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteTransactionSchema,
  },
  createPayableBill: {
    name: 'createPayableBill',
    module: 'FINANCES',
    description: 'Cadastra uma nova conta a pagar (fixa, cartão ou dívida).',
    isDestructive: false,
    schema: createPayableBillSchema,
  },
  togglePayableBillStatus: {
    name: 'togglePayableBillStatus',
    module: 'FINANCES',
    description: 'Alterna o status de uma conta entre paga e pendente.',
    isDestructive: false,
    schema: togglePayableBillStatusSchema,
  },
  deletePayableBill: {
    name: 'deletePayableBill',
    module: 'FINANCES',
    description: 'Remove uma conta a pagar (exige confirmação explícita).',
    isDestructive: true,
    schema: deletePayableBillSchema,
  },
  createInstallmentPlan: {
    name: 'createInstallmentPlan',
    module: 'FINANCES',
    description: 'Cadastra uma compra parcelada.',
    isDestructive: false,
    schema: createInstallmentPlanSchema,
  },
  deleteInstallmentPlan: {
    name: 'deleteInstallmentPlan',
    module: 'FINANCES',
    description: 'Remove um plano de parcelamento (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteInstallmentPlanSchema,
  },

  // Academic
  createProject: {
    name: 'createProject',
    module: 'ACADEMIC',
    description: 'Cria um novo projeto acadêmico da faculdade.',
    isDestructive: false,
    schema: createProjectSchema,
  },
  updateProject: {
    name: 'updateProject',
    module: 'ACADEMIC',
    description: 'Atualiza dados de um projeto acadêmico existente.',
    isDestructive: false,
    schema: updateProjectSchema,
  },
  deleteProject: {
    name: 'deleteProject',
    module: 'ACADEMIC',
    description: 'Exclui um projeto acadêmico e seus marcos (exige confirmação).',
    isDestructive: true,
    schema: deleteProjectSchema,
  },
  completeProject: {
    name: 'completeProject',
    module: 'ACADEMIC',
    description: 'Marca um projeto acadêmico como concluído.',
    isDestructive: false,
    schema: completeProjectSchema,
  },
  reopenProject: {
    name: 'reopenProject',
    module: 'ACADEMIC',
    description: 'Reabre um projeto acadêmico concluído para em andamento.',
    isDestructive: false,
    schema: reopenProjectSchema,
  },
  addMilestone: {
    name: 'addMilestone',
    module: 'ACADEMIC',
    description: 'Adiciona um marco datado na timeline de um projeto acadêmico.',
    isDestructive: false,
    schema: addMilestoneSchema,
  },
  toggleMilestone: {
    name: 'toggleMilestone',
    module: 'ACADEMIC',
    description: 'Alterna a conclusão de um marco acadêmico com selo [OK].',
    isDestructive: false,
    schema: toggleMilestoneSchema,
  },
  deleteMilestone: {
    name: 'deleteMilestone',
    module: 'ACADEMIC',
    description: 'Remove um marco de um projeto (exige confirmação).',
    isDestructive: true,
    schema: deleteMilestoneSchema,
  },

  // Shopping
  addWishlistItem: {
    name: 'addWishlistItem',
    module: 'SHOPPING',
    description: 'Adiciona um produto à lista de desejos (Quero Comprar).',
    isDestructive: false,
    schema: addWishlistItemSchema,
  },
  updateWishlistItem: {
    name: 'updateWishlistItem',
    module: 'SHOPPING',
    description: 'Atualiza um produto na lista de desejos.',
    isDestructive: false,
    schema: updateWishlistItemSchema,
  },
  deleteWishlistItem: {
    name: 'deleteWishlistItem',
    module: 'SHOPPING',
    description: 'Exclui um item da lista de compras (exige confirmação).',
    isDestructive: true,
    schema: deleteWishlistItemSchema,
  },
  markPurchased: {
    name: 'markPurchased',
    module: 'SHOPPING',
    description: 'Move item da wishlist para compras em trânsito com previsão de chegada.',
    isDestructive: false,
    schema: markPurchasedSchema,
  },
  markDelivered: {
    name: 'markDelivered',
    module: 'SHOPPING',
    description: 'Registra a entrega de uma encomenda (Chegou!).',
    isDestructive: false,
    schema: markDeliveredSchema,
  },
  revertDelivered: {
    name: 'revertDelivered',
    module: 'SHOPPING',
    description: 'Reverte uma compra entregue de volta para em trânsito.',
    isDestructive: false,
    schema: revertDeliveredSchema,
  },
  revertToWishlist: {
    name: 'revertToWishlist',
    module: 'SHOPPING',
    description: 'Reverte uma compra para a lista de desejos.',
    isDestructive: false,
    schema: revertToWishlistSchema,
  },
};
