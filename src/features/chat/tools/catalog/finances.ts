import { z } from 'zod';
import { toRecifeDateString } from '@/lib/dates';
import { defineAction, type ActionCatalogEntry } from './types';

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

export const payableBillTypeMap: Record<
  string,
  'FIXED_RECURRING' | 'CREDIT_CARD_BILL' | 'DEBT_TO_PERSON' | 'SINGLE_BILL'
> = {
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
    .enum([
      'FIXED_RECURRING',
      'CREDIT_CARD_BILL',
      'DEBT_TO_PERSON',
      'SINGLE_BILL',
      'FIXED',
      'CREDIT_CARD',
      'DEBT',
    ])
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

export const FINANCES_CATALOG: Record<string, ActionCatalogEntry> = {
  createTransaction: defineAction({
    name: 'createTransaction',
    module: 'FINANCES',
    displayName: 'REGISTRAR TRANSAÇÃO',
    entityLabel: 'Transação',
    operation: 'create',
    description: 'Registra uma nova Transação financeira (receita ou despesa) em centavos.',
    isDestructive: false,
    schema: createTransactionSchema,
    inferableDefaults: {
      occurredAt: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
      status: () => 'PAID',
    },
    fields: {
      type: {
        name: 'type',
        label: 'TIPO',
        description: 'Tipo da transação: INCOME (entrada) ou EXPENSE (saída).',
        required: true,
      },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Descrição da movimentação.',
        required: true,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: 'Categoria financeira (ex.: ALIMENTAÇÃO, TRANSPORTE, OUTROS).',
        required: true,
      },
      amountCents: {
        name: 'amountCents',
        label: 'VALOR (CENTAVOS)',
        description: 'Valor inteiro em centavos (ex.: R$ 45,00 = 4500).',
        required: true,
      },
      occurredAt: {
        name: 'occurredAt',
        label: 'DATA',
        description: 'Data da transação (AAAA-MM-DD).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
      status: {
        name: 'status',
        label: 'STATUS',
        description: 'PAID (Pago) ou PENDING (Falta Pagar).',
        required: false,
        inferableDefault: 'PAID',
      },
    },
  }),

  updateTransaction: defineAction({
    name: 'updateTransaction',
    module: 'FINANCES',
    displayName: 'ATUALIZAR TRANSAÇÃO',
    entityLabel: 'Transação',
    operation: 'update',
    description: 'Atualiza uma Transação financeira existente pelo ID.',
    isDestructive: false,
    schema: updateTransactionSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Transação.', required: true },
      type: { name: 'type', label: 'TIPO', description: 'INCOME ou EXPENSE.', required: false },
      description: { name: 'description', label: 'DESCRIÇÃO', description: 'Nova descrição.', required: false },
      category: { name: 'category', label: 'CATEGORIA', description: 'Nova categoria.', required: false },
      amountCents: { name: 'amountCents', label: 'VALOR (CENTAVOS)', description: 'Novo valor em centavos.', required: false },
      occurredAt: { name: 'occurredAt', label: 'DATA', description: 'Nova data (AAAA-MM-DD).', required: false },
      status: { name: 'status', label: 'STATUS', description: 'PAID ou PENDING.', required: false },
    },
  }),

  deleteTransaction: defineAction({
    name: 'deleteTransaction',
    module: 'FINANCES',
    displayName: 'EXCLUIR TRANSAÇÃO',
    entityLabel: 'Transação',
    operation: 'delete',
    description: 'Remove uma Transação financeira (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteTransactionSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Transação a excluir.', required: true },
    },
  }),

  createPayableBill: defineAction({
    name: 'createPayableBill',
    module: 'FINANCES',
    displayName: 'CADASTRAR CONTA A PAGAR',
    entityLabel: 'Conta a Pagar',
    operation: 'create',
    description: 'Cadastra uma nova Conta a Pagar (fixa, fatura de cartão, dívida ou avulsa).',
    isDestructive: false,
    schema: createPayableBillSchema,
    fields: {
      title: { name: 'title', label: 'TÍTULO', description: 'Nome da conta.', required: true },
      billType: {
        name: 'billType',
        label: 'TIPO DA CONTA',
        description: 'FIXED_RECURRING, CREDIT_CARD_BILL, DEBT_TO_PERSON ou SINGLE_BILL.',
        required: true,
      },
      category: { name: 'category', label: 'CATEGORIA', description: 'Categoria da conta.', required: true },
      amountCents: { name: 'amountCents', label: 'VALOR (CENTAVOS)', description: 'Valor inteiro em centavos.', required: true },
      dueDate: { name: 'dueDate', label: 'VENCIMENTO', description: 'Data de vencimento (AAAA-MM-DD).', required: true },
    },
  }),

  togglePayableBillStatus: defineAction({
    name: 'togglePayableBillStatus',
    module: 'FINANCES',
    displayName: 'MARCAR CONTA PAGA/PENDENTE',
    entityLabel: 'Conta a Pagar',
    operation: 'update',
    description: 'Alterna o status de uma Conta a Pagar entre paga e pendente.',
    isDestructive: false,
    schema: togglePayableBillStatusSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Conta a Pagar.', required: true },
      paid: { name: 'paid', label: 'PAGA', description: 'true para paga, false para pendente.', required: false },
    },
  }),

  deletePayableBill: defineAction({
    name: 'deletePayableBill',
    module: 'FINANCES',
    displayName: 'EXCLUIR CONTA A PAGAR',
    entityLabel: 'Conta a Pagar',
    operation: 'delete',
    description: 'Remove uma Conta a Pagar (exige confirmação explícita).',
    isDestructive: true,
    schema: deletePayableBillSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Conta a Pagar a excluir.', required: true },
    },
  }),

  createInstallmentPlan: defineAction({
    name: 'createInstallmentPlan',
    module: 'FINANCES',
    displayName: 'CRIAR PLANO DE PARCELAMENTO',
    entityLabel: 'Plano de Parcelamento',
    operation: 'create',
    description: 'Cadastra um novo Plano de Parcelamento mensal.',
    isDestructive: false,
    schema: createInstallmentPlanSchema,
    inferableDefaults: {
      paidInstallments: () => 0,
    },
    fields: {
      description: { name: 'description', label: 'DESCRIÇÃO', description: 'Descrição da compra parcelada.', required: true },
      category: { name: 'category', label: 'CATEGORIA', description: 'Categoria financeira.', required: true },
      totalInstallments: { name: 'totalInstallments', label: 'TOTAL DE PARCELAS', description: 'Número total de parcelas.', required: true },
      paidInstallments: { name: 'paidInstallments', label: 'PARCELAS PAGAS', description: 'Quantidade já paga.', required: false, inferableDefault: '0' },
      installmentAmountCents: { name: 'installmentAmountCents', label: 'VALOR DA PARCELA (CENTAVOS)', description: 'Valor de cada parcela em centavos.', required: true },
      startMonth: { name: 'startMonth', label: 'MÊS INICIAL', description: 'Mês da primeira parcela (AAAA-MM).', required: true },
      creditCardId: { name: 'creditCardId', label: 'CARTÃO DE CRÉDITO', description: 'ID opcional do cartão vinculado.', required: false },
    },
  }),

  deleteInstallmentPlan: defineAction({
    name: 'deleteInstallmentPlan',
    module: 'FINANCES',
    displayName: 'EXCLUIR PLANO DE PARCELAMENTO',
    entityLabel: 'Plano de Parcelamento',
    operation: 'delete',
    description: 'Remove um Plano de Parcelamento (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteInstallmentPlanSchema,
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Plano de Parcelamento a excluir.', required: true },
    },
  }),
};
