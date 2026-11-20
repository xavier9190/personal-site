import { z } from 'zod';
import {
  createCreditCardSchema as canonicalCreateCreditCardSchema,
  createInstallmentPlanSchema as canonicalCreateInstallmentPlanSchema,
  createPayableBillSchema as canonicalCreatePayableBillSchema,
  createTransactionSchema as canonicalCreateTransactionSchema,
  PRESET_TRANSACTION_CATEGORIES,
  updateCreditCardSchema as canonicalUpdateCreditCardSchema,
  updateInstallmentPlanSchema as canonicalUpdateInstallmentPlanSchema,
  updatePayableBillSchema as canonicalUpdatePayableBillSchema,
  updateTransactionSchema as canonicalUpdateTransactionSchema,
} from '@/features/finances/types';
import { toRecifeDateString } from '@/lib/dates';
import { defineAction, type ActionCatalogEntry, type ActionDefaultsContext } from './types';

function normalizeLookupText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function isMissingValue(value: unknown): boolean {
  return (
    value === undefined ||
    value === null ||
    (typeof value === 'string' && value.trim().length === 0)
  );
}

const INCOME_DESCRIPTION_REGEX =
  /\b(salarios?|freelas?|freelances?|recebi|recebimentos?|pix\s+recebido|transferencia\s+recebida|pagamento\s+recebido|receitas?|rendas?|bonus|reembolsos?|rendimentos?|dividendos?|mesadas?|pro-labore|estornos?|lucros?|comissoes|comissao|decimo\s+terceiro|13o|ferias|entradas?)\b/i;

export function inferTransactionType(description: unknown): 'INCOME' | 'EXPENSE' {
  if (typeof description !== 'string' || !description.trim()) {
    return 'EXPENSE';
  }
  const normalized = normalizeLookupText(description);
  return INCOME_DESCRIPTION_REGEX.test(normalized) ? 'INCOME' : 'EXPENSE';
}

function normalizeTransactionType(rawType: unknown): unknown {
  if (typeof rawType !== 'string') return rawType;
  const norm = normalizeLookupText(rawType);
  if (norm === 'income' || norm === 'entrada' || norm === 'receita') return 'INCOME';
  if (norm === 'expense' || norm === 'saida' || norm === 'despesa' || norm === 'gasto') {
    return 'EXPENSE';
  }
  return rawType.trim().toUpperCase();
}

const CATEGORY_KEYWORD_RULES: ReadonlyArray<{ category: string; pattern: RegExp }> = [
  {
    category: 'ALIMENTAÇÃO',
    pattern:
      /\b(almoco|jantar|janta|cafe|lanche|padaria|restaurante|ifood|rappi|mercado|supermercado|feira|acougue|hortifruti|comida|pizza|hamburguer|burger|sushi|sorvete|marmita|refeicao|alimentacao|bebida|refrigerante|pao|acai)\b/,
  },
  {
    category: 'TRANSPORTE',
    pattern:
      /\b(uber|99|99pop|taxi|onibus|metro|passagem|gasolina|combustivel|etanol|estacionamento|pedagio|oficina|mecanico|transporte|corrida|ipva|multa|voo|aerea|carro|moto)\b/,
  },
  {
    category: 'MORADIA',
    pattern:
      /\b(aluguel|condominio|iptu|luz|energia|celpe|neoenergia|conta\s+de\s+agua|compesa|saneamento|gas|internet|wifi|wi-fi|fibra|moradia|casa|apartamento|reparo|eletrodomestico)\b/,
  },
  {
    category: 'ASSINATURAS',
    pattern:
      /\b(netflix|spotify|prime|amazon\s+prime|disney|hbo|max|youtube|icloud|google\s+one|chatgpt|openai|claude|copilot|assinatura|mensalidade|streaming|globoplay|ps\s+plus|xbox|game\s+pass)\b/,
  },
  {
    category: 'SAÚDE',
    pattern:
      /\b(farmacia|remedio|medicamento|medico|dentista|consulta|exame|hospital|clinica|plano\s+de\s+saude|unimed|psicologo|terapia|academia|smartfit|gympass|wellhub|fisioterapia|otica|oculos|saude)\b/,
  },
  {
    category: 'EDUCAÇÃO',
    pattern:
      /\b(curso|faculdade|universidade|escola|livro|apostila|udemy|alura|ingles|idioma|prova|concurso|vestibular|material\s+escolar|caderno|papelaria|educacao|mensalidade\s+escolar)\b/,
  },
  {
    category: 'LAZER',
    pattern:
      /\b(cinema|ingresso|show|teatro|bar|festa|balada|jogo|game|steam|viagem|hotel|passeio|parque|cerveja|chopp|lazer)\b/,
  },
  {
    category: 'COMPRAS',
    pattern:
      /\b(monitor|teclado|mouse|notebook|laptop|celular|iphone|smartphone|roupa|tenis|sapato|camisa|calca|shopee|mercado\s+livre|amazon|aliexpress|shein|eletronico|fone|headset|cadeira|placa\s+de\s+video|gpu|ssd|loja|presente|compras?)\b/,
  },
  {
    category: 'TRABALHO',
    pattern:
      /\b(salario|freela|freelance|trabalho|pro-labore|bonus|cliente|hora\s+extra|dividendo|dividendos|estagio|escritorio|coworking)\b/,
  },
];

const PRESET_NORMALIZED_MAP = new Map(
  PRESET_TRANSACTION_CATEGORIES.map((cat) => [normalizeLookupText(cat), cat]),
);

export function inferFinanceCategory(description: unknown): string {
  if (typeof description !== 'string' || !description.trim()) {
    return 'OUTROS';
  }
  const normalized = normalizeLookupText(description);
  const directPreset = PRESET_NORMALIZED_MAP.get(normalized);
  if (directPreset) return directPreset;

  for (const rule of CATEGORY_KEYWORD_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.category;
    }
  }
  return 'OUTROS';
}

export const payableBillTypeMap: Record<
  string,
  'FIXED_RECURRING' | 'CREDIT_CARD_BILL' | 'DEBT_TO_PERSON' | 'SINGLE_BILL'
> = {
  FIXED: 'FIXED_RECURRING',
  FIXED_RECURRING: 'FIXED_RECURRING',
  CONTA_FIXA: 'FIXED_RECURRING',
  'CONTA FIXA': 'FIXED_RECURRING',
  FIXA: 'FIXED_RECURRING',
  RECORRENTE: 'FIXED_RECURRING',
  CREDIT_CARD: 'CREDIT_CARD_BILL',
  CREDIT_CARD_BILL: 'CREDIT_CARD_BILL',
  FATURA: 'CREDIT_CARD_BILL',
  FATURA_CARTAO: 'CREDIT_CARD_BILL',
  'FATURA CARTAO': 'CREDIT_CARD_BILL',
  CARTAO: 'CREDIT_CARD_BILL',
  DEBT: 'DEBT_TO_PERSON',
  DEBT_TO_PERSON: 'DEBT_TO_PERSON',
  DIVIDA: 'DEBT_TO_PERSON',
  DIVIDA_PESSOA: 'DEBT_TO_PERSON',
  'DIVIDA PESSOA': 'DEBT_TO_PERSON',
  PESSOA: 'DEBT_TO_PERSON',
  SINGLE: 'SINGLE_BILL',
  SINGLE_BILL: 'SINGLE_BILL',
  AVULSA: 'SINGLE_BILL',
  CONTA_AVULSA: 'SINGLE_BILL',
  'CONTA AVULSA': 'SINGLE_BILL',
};

function normalizeBillType(rawBillType: unknown): unknown {
  if (typeof rawBillType !== 'string') return rawBillType;
  const normalizedKey = normalizeLookupText(rawBillType).toUpperCase();
  return payableBillTypeMap[normalizedKey] ?? rawBillType.trim().toUpperCase();
}

function inferBillType(
  rawArgs: Record<string, unknown>,
): 'FIXED_RECURRING' | 'CREDIT_CARD_BILL' | 'DEBT_TO_PERSON' | 'SINGLE_BILL' {
  if (!isMissingValue(rawArgs.creditCardId)) {
    return 'CREDIT_CARD_BILL';
  }
  const title = typeof rawArgs.title === 'string' ? normalizeLookupText(rawArgs.title) : '';
  if (/\b(fatura|cartao)\b/.test(title)) return 'CREDIT_CARD_BILL';
  if (/\b(devo|divida|emprestimo|emprestado)\b/.test(title)) return 'DEBT_TO_PERSON';
  if (
    /\b(aluguel|condominio|internet|wifi|wi-fi|energia|luz|agua|gas|assinatura|mensalidade|plano|telefone|celular|streaming|netflix|spotify|academia)\b/.test(
      title,
    )
  ) {
    return 'FIXED_RECURRING';
  }
  return 'SINGLE_BILL';
}

export function applyCreateTransactionDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };

  if (isMissingValue(out.type)) {
    out.type = inferTransactionType(out.description);
  } else {
    out.type = normalizeTransactionType(out.type);
  }

  if (isMissingValue(out.category)) {
    out.category = inferFinanceCategory(out.description);
  }

  if (isMissingValue(out.occurredAt)) {
    out.occurredAt = ctx?.currentDateRecife ?? toRecifeDateString();
  }

  if (isMissingValue(out.status)) {
    out.status = 'PAID';
  }

  if (out.shoppingItemId === '') {
    out.shoppingItemId = null;
  }

  return out;
}

export function applyUpdateTransactionDefaults(
  rawArgs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };
  if (out.type !== undefined) {
    out.type = normalizeTransactionType(out.type);
  }
  if (out.shoppingItemId === '') {
    out.shoppingItemId = null;
  }
  return out;
}

export function applyCreatePayableBillDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };

  if (isMissingValue(out.billType)) {
    out.billType = inferBillType(out);
  } else {
    out.billType = normalizeBillType(out.billType);
  }

  if (isMissingValue(out.category)) {
    out.category = inferFinanceCategory(out.title);
  }

  if (isMissingValue(out.dueDate)) {
    out.dueDate = ctx?.currentDateRecife ?? toRecifeDateString();
  }

  if (
    isMissingValue(out.competenceMonth) &&
    typeof out.dueDate === 'string' &&
    /^\d{4}-\d{2}/.test(out.dueDate.trim())
  ) {
    out.competenceMonth = out.dueDate.trim().slice(0, 7);
  }

  if (out.creditCardId === '') {
    out.creditCardId = null;
  }

  return out;
}

export function applyUpdatePayableBillDefaults(
  rawArgs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };
  if (out.billType !== undefined) {
    out.billType = normalizeBillType(out.billType);
  }
  if (out.creditCardId === '') {
    out.creditCardId = null;
  }
  return out;
}

export function applyCreateInstallmentPlanDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };

  if (isMissingValue(out.category)) {
    out.category = inferFinanceCategory(out.description);
  }

  if (out.paidInstallments === undefined || out.paidInstallments === null) {
    out.paidInstallments = 0;
  }

  if (isMissingValue(out.startMonth)) {
    out.startMonth = (ctx?.currentDateRecife ?? toRecifeDateString()).slice(0, 7);
  }

  if (out.creditCardId === '') {
    out.creditCardId = null;
  }

  if (out.shoppingItemId === '') {
    out.shoppingItemId = null;
  }

  return out;
}

export function applyUpdateInstallmentPlanDefaults(
  rawArgs: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };
  if (out.creditCardId === '') {
    out.creditCardId = null;
  }
  if (out.shoppingItemId === '') {
    out.shoppingItemId = null;
  }
  return out;
}

const idSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const createTransactionSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyCreateTransactionDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalCreateTransactionSchema,
);

export const updateTransactionSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyUpdateTransactionDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalUpdateTransactionSchema.extend({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  }),
);

export const deleteTransactionSchema = idSchema;

export const createPayableBillSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyCreatePayableBillDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalCreatePayableBillSchema,
);

export const updatePayableBillSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyUpdatePayableBillDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalUpdatePayableBillSchema.extend({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  }),
);

export const togglePayableBillStatusSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  paid: z.boolean().optional(),
});

export const deletePayableBillSchema = idSchema;

export const createInstallmentPlanSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyCreateInstallmentPlanDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalCreateInstallmentPlanSchema,
);

export const updateInstallmentPlanSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyUpdateInstallmentPlanDefaults(raw as Record<string, unknown>)
      : raw,
  canonicalUpdateInstallmentPlanSchema.extend({
    id: z.string().min(1, 'ID OBRIGATÓRIO'),
  }),
);

export const advanceInstallmentSchema = idSchema;

export const deleteInstallmentPlanSchema = idSchema;

export const createCreditCardSchema = canonicalCreateCreditCardSchema;

export const updateCreditCardSchema = canonicalUpdateCreditCardSchema.extend({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

export const deleteCreditCardSchema = idSchema;

export const FINANCES_CATALOG: Record<string, ActionCatalogEntry> = {
  createTransaction: defineAction({
    name: 'createTransaction',
    module: 'FINANCES',
    displayName: 'REGISTRAR TRANSAÇÃO',
    entityLabel: 'Transação',
    operation: 'create',
    description:
      'Registra uma nova Transação financeira (entrada INCOME ou saída EXPENSE) em centavos.',
    isDestructive: false,
    schema: createTransactionSchema,
    inferableDefaults: {
      type: () => 'EXPENSE',
      category: () => 'OUTROS',
      occurredAt: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
      status: () => 'PAID',
    },
    applyDefaults: applyCreateTransactionDefaults,
    fields: {
      type: {
        name: 'type',
        label: 'TIPO',
        description: 'Tipo da transação: INCOME (entrada) ou EXPENSE (saída).',
        required: false,
        inferableDefault: 'EXPENSE (OU INCOME SE RECEITA)',
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
        description: `Categoria financeira (${PRESET_TRANSACTION_CATEGORIES.join(', ')}).`,
        required: false,
        inferableDefault: 'INFERIDA PELA DESCRIÇÃO',
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
      shoppingItemId: {
        name: 'shoppingItemId',
        label: 'ITEM DE COMPRAS',
        description: 'ID opcional do item de compras vinculado.',
        required: false,
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
    applyDefaults: (rawArgs) => applyUpdateTransactionDefaults(rawArgs),
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Transação.', required: true },
      type: { name: 'type', label: 'TIPO', description: 'INCOME ou EXPENSE.', required: false },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Nova descrição.',
        required: false,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: 'Nova categoria.',
        required: false,
      },
      amountCents: {
        name: 'amountCents',
        label: 'VALOR (CENTAVOS)',
        description: 'Novo valor em centavos.',
        required: false,
      },
      occurredAt: {
        name: 'occurredAt',
        label: 'DATA',
        description: 'Nova data (AAAA-MM-DD).',
        required: false,
      },
      status: {
        name: 'status',
        label: 'STATUS',
        description: 'PAID ou PENDING.',
        required: false,
      },
      shoppingItemId: {
        name: 'shoppingItemId',
        label: 'ITEM DE COMPRAS',
        description: 'ID opcional do item de compras vinculado.',
        required: false,
      },
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
    description:
      'Cadastra uma nova Conta a Pagar: FIXED_RECURRING (conta fixa), CREDIT_CARD_BILL (fatura de cartão), DEBT_TO_PERSON (dívida a pessoa) ou SINGLE_BILL (conta avulsa).',
    isDestructive: false,
    schema: createPayableBillSchema,
    inferableDefaults: {
      billType: () => 'SINGLE_BILL',
      category: () => 'OUTROS',
      dueDate: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
      competenceMonth: (ctx) => (ctx?.currentDateRecife ?? toRecifeDateString()).slice(0, 7),
    },
    applyDefaults: applyCreatePayableBillDefaults,
    fields: {
      title: { name: 'title', label: 'TÍTULO', description: 'Nome da conta.', required: true },
      billType: {
        name: 'billType',
        label: 'TIPO DA CONTA',
        description:
          'FIXED_RECURRING, CREDIT_CARD_BILL, DEBT_TO_PERSON ou SINGLE_BILL.',
        required: false,
        inferableDefault: 'INFERIDO PELO TÍTULO OU SINGLE_BILL',
      },
      amountCents: {
        name: 'amountCents',
        label: 'VALOR (CENTAVOS)',
        description: 'Valor inteiro em centavos.',
        required: true,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: `Categoria da conta (${PRESET_TRANSACTION_CATEGORIES.join(', ')}).`,
        required: false,
        inferableDefault: 'INFERIDA PELO TÍTULO',
      },
      dueDate: {
        name: 'dueDate',
        label: 'VENCIMENTO',
        description: 'Data de vencimento (AAAA-MM-DD).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
      competenceMonth: {
        name: 'competenceMonth',
        label: 'MÊS DE COMPETÊNCIA',
        description: 'Mês de competência (AAAA-MM).',
        required: false,
        inferableDefault: 'MÊS DO VENCIMENTO (AAAA-MM)',
      },
      creditCardId: {
        name: 'creditCardId',
        label: 'CARTÃO DE CRÉDITO',
        description: 'ID opcional do cartão de crédito vinculado.',
        required: false,
      },
    },
  }),

  updatePayableBill: defineAction({
    name: 'updatePayableBill',
    module: 'FINANCES',
    displayName: 'ATUALIZAR CONTA A PAGAR',
    entityLabel: 'Conta a Pagar',
    operation: 'update',
    description: 'Atualiza os dados de uma Conta a Pagar existente pelo ID.',
    isDestructive: false,
    schema: updatePayableBillSchema,
    applyDefaults: (rawArgs) => applyUpdatePayableBillDefaults(rawArgs),
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID da Conta a Pagar.', required: true },
      title: { name: 'title', label: 'TÍTULO', description: 'Novo nome da conta.', required: false },
      billType: {
        name: 'billType',
        label: 'TIPO DA CONTA',
        description:
          'FIXED_RECURRING, CREDIT_CARD_BILL, DEBT_TO_PERSON ou SINGLE_BILL.',
        required: false,
      },
      amountCents: {
        name: 'amountCents',
        label: 'VALOR (CENTAVOS)',
        description: 'Novo valor em centavos.',
        required: false,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: 'Nova categoria da conta.',
        required: false,
      },
      dueDate: {
        name: 'dueDate',
        label: 'VENCIMENTO',
        description: 'Nova data de vencimento (AAAA-MM-DD).',
        required: false,
      },
      competenceMonth: {
        name: 'competenceMonth',
        label: 'MÊS DE COMPETÊNCIA',
        description: 'Novo mês de competência (AAAA-MM).',
        required: false,
      },
      creditCardId: {
        name: 'creditCardId',
        label: 'CARTÃO DE CRÉDITO',
        description: 'ID opcional do cartão vinculado (ou null para desvincular).',
        required: false,
      },
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
      paid: {
        name: 'paid',
        label: 'PAGA',
        description: 'true para paga, false para pendente.',
        required: false,
      },
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
      id: {
        name: 'id',
        label: 'ID',
        description: 'ID da Conta a Pagar a excluir.',
        required: true,
      },
    },
  }),

  createInstallmentPlan: defineAction({
    name: 'createInstallmentPlan',
    module: 'FINANCES',
    displayName: 'CRIAR PLANO DE PARCELAMENTO',
    entityLabel: 'Plano de Parcelamento',
    operation: 'create',
    description: 'Cadastra um novo Plano de Parcelamento mensal (no cartão ou avulso).',
    isDestructive: false,
    schema: createInstallmentPlanSchema,
    inferableDefaults: {
      category: () => 'OUTROS',
      paidInstallments: () => 0,
      startMonth: (ctx) => (ctx?.currentDateRecife ?? toRecifeDateString()).slice(0, 7),
    },
    applyDefaults: applyCreateInstallmentPlanDefaults,
    fields: {
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Descrição da compra parcelada.',
        required: true,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: `Categoria financeira (${PRESET_TRANSACTION_CATEGORIES.join(', ')}).`,
        required: false,
        inferableDefault: 'INFERIDA PELA DESCRIÇÃO',
      },
      totalInstallments: {
        name: 'totalInstallments',
        label: 'TOTAL DE PARCELAS',
        description: 'Número total de parcelas.',
        required: true,
      },
      paidInstallments: {
        name: 'paidInstallments',
        label: 'PARCELAS PAGAS',
        description: 'Quantidade já paga.',
        required: false,
        inferableDefault: '0',
      },
      installmentAmountCents: {
        name: 'installmentAmountCents',
        label: 'VALOR DA PARCELA (CENTAVOS)',
        description: 'Valor de cada parcela em centavos.',
        required: true,
      },
      creditCardId: {
        name: 'creditCardId',
        label: 'CARTÃO DE CRÉDITO',
        description: 'ID opcional do cartão vinculado.',
        required: false,
      },
      startMonth: {
        name: 'startMonth',
        label: 'MÊS INICIAL',
        description: 'Mês da primeira parcela (AAAA-MM).',
        required: false,
        inferableDefault: 'MÊS ATUAL EM RECIFE (AAAA-MM)',
      },
      shoppingItemId: {
        name: 'shoppingItemId',
        label: 'ITEM DE COMPRAS',
        description: 'ID opcional do item de compras vinculado.',
        required: false,
      },
    },
  }),

  updateInstallmentPlan: defineAction({
    name: 'updateInstallmentPlan',
    module: 'FINANCES',
    displayName: 'ATUALIZAR PLANO DE PARCELAMENTO',
    entityLabel: 'Plano de Parcelamento',
    operation: 'update',
    description: 'Atualiza um Plano de Parcelamento existente pelo ID.',
    isDestructive: false,
    schema: updateInstallmentPlanSchema,
    applyDefaults: (rawArgs) => applyUpdateInstallmentPlanDefaults(rawArgs),
    fields: {
      id: { name: 'id', label: 'ID', description: 'ID do Plano de Parcelamento.', required: true },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Nova descrição da compra parcelada.',
        required: false,
      },
      category: {
        name: 'category',
        label: 'CATEGORIA',
        description: 'Nova categoria financeira.',
        required: false,
      },
      totalInstallments: {
        name: 'totalInstallments',
        label: 'TOTAL DE PARCELAS',
        description: 'Novo número total de parcelas.',
        required: false,
      },
      paidInstallments: {
        name: 'paidInstallments',
        label: 'PARCELAS PAGAS',
        description: 'Nova quantidade de parcelas pagas.',
        required: false,
      },
      installmentAmountCents: {
        name: 'installmentAmountCents',
        label: 'VALOR DA PARCELA (CENTAVOS)',
        description: 'Novo valor de cada parcela em centavos.',
        required: false,
      },
      creditCardId: {
        name: 'creditCardId',
        label: 'CARTÃO DE CRÉDITO',
        description: 'Novo ID do cartão vinculado (ou null para avulso).',
        required: false,
      },
      startMonth: {
        name: 'startMonth',
        label: 'MÊS INICIAL',
        description: 'Novo mês inicial (AAAA-MM).',
        required: false,
      },
      shoppingItemId: {
        name: 'shoppingItemId',
        label: 'ITEM DE COMPRAS',
        description: 'ID opcional do item de compras vinculado.',
        required: false,
      },
    },
  }),

  advanceInstallment: defineAction({
    name: 'advanceInstallment',
    module: 'FINANCES',
    displayName: 'AVANÇAR PARCELA',
    entityLabel: 'Plano de Parcelamento',
    operation: 'update',
    description: 'Avança em +1 o número de parcelas pagas de um Plano de Parcelamento.',
    isDestructive: false,
    schema: advanceInstallmentSchema,
    fields: {
      id: {
        name: 'id',
        label: 'ID',
        description: 'ID do Plano de Parcelamento a avançar.',
        required: true,
      },
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
      id: {
        name: 'id',
        label: 'ID',
        description: 'ID do Plano de Parcelamento a excluir.',
        required: true,
      },
    },
  }),

  createCreditCard: defineAction({
    name: 'createCreditCard',
    module: 'FINANCES',
    displayName: 'CADASTRAR CARTÃO DE CRÉDITO',
    entityLabel: 'Cartão de Crédito',
    operation: 'create',
    description:
      'Cadastra um novo Cartão de Crédito com nome, dia de fechamento, dia de vencimento e limite opcional.',
    isDestructive: false,
    schema: createCreditCardSchema,
    fields: {
      name: {
        name: 'name',
        label: 'NOME DO CARTÃO',
        description: 'Nome do cartão (ex.: NUBANK, INTER).',
        required: true,
      },
      closingDay: {
        name: 'closingDay',
        label: 'DIA DE FECHAMENTO',
        description: 'Dia de fechamento da fatura (1 a 31).',
        required: true,
      },
      dueDay: {
        name: 'dueDay',
        label: 'DIA DE VENCIMENTO',
        description: 'Dia de vencimento da fatura (1 a 31).',
        required: true,
      },
      limitCents: {
        name: 'limitCents',
        label: 'LIMITE (CENTAVOS)',
        description: 'Limite opcional em centavos.',
        required: false,
      },
    },
  }),

  updateCreditCard: defineAction({
    name: 'updateCreditCard',
    module: 'FINANCES',
    displayName: 'ATUALIZAR CARTÃO DE CRÉDITO',
    entityLabel: 'Cartão de Crédito',
    operation: 'update',
    description: 'Atualiza um Cartão de Crédito existente pelo ID.',
    isDestructive: false,
    schema: updateCreditCardSchema,
    fields: {
      id: {
        name: 'id',
        label: 'ID',
        description: 'ID do Cartão de Crédito.',
        required: true,
      },
      name: {
        name: 'name',
        label: 'NOME DO CARTÃO',
        description: 'Novo nome do cartão.',
        required: false,
      },
      closingDay: {
        name: 'closingDay',
        label: 'DIA DE FECHAMENTO',
        description: 'Novo dia de fechamento (1 a 31).',
        required: false,
      },
      dueDay: {
        name: 'dueDay',
        label: 'DIA DE VENCIMENTO',
        description: 'Novo dia de vencimento (1 a 31).',
        required: false,
      },
      limitCents: {
        name: 'limitCents',
        label: 'LIMITE (CENTAVOS)',
        description: 'Novo limite em centavos (ou null para remover).',
        required: false,
      },
    },
  }),

  deleteCreditCard: defineAction({
    name: 'deleteCreditCard',
    module: 'FINANCES',
    displayName: 'EXCLUIR CARTÃO DE CRÉDITO',
    entityLabel: 'Cartão de Crédito',
    operation: 'delete',
    description: 'Remove um Cartão de Crédito (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteCreditCardSchema,
    fields: {
      id: {
        name: 'id',
        label: 'ID',
        description: 'ID do Cartão de Crédito a excluir.',
        required: true,
      },
    },
  }),
};
