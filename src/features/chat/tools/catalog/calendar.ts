import { z } from 'zod';
import {
  EVENT_COLORS,
  RECURRENCES,
  eventInputSchema,
  type EventColor,
} from '@/features/calendar/logic';
import { assertPureDate, toRecifeDateString } from '@/lib/dates';
import { defineAction, type ActionCatalogEntry, type ActionDefaultsContext } from './types';

export const calendarColors = [
  'green',
  'red',
  'blue',
  'yellow',
  '#b2f2bb',
  '#ffc9c9',
  '#a5d8ff',
  '#ffec99',
] as const;

export const HEX_TO_COLOR: Record<string, EventColor> = {
  '#b2f2bb': 'green',
  '#ffc9c9': 'red',
  '#a5d8ff': 'blue',
  '#ffec99': 'yellow',
  green: 'green',
  red: 'red',
  blue: 'blue',
  yellow: 'yellow',
};

const HH_MM_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

export function computeDefaultEndTime(startTime: string, durationMinutes: number = 60): string {
  const [hStr, mStr] = startTime.split(':');
  const startTotal = Number(hStr) * 60 + Number(mStr);
  const endTotal = Math.min(23 * 60 + 59, startTotal + durationMinutes);
  const h = Math.floor(endTotal / 60);
  const m = endTotal % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function normalizeColor(rawColor: unknown): unknown {
  if (typeof rawColor !== 'string') return rawColor;
  const trimmed = rawColor.trim().toLowerCase();
  return HEX_TO_COLOR[trimmed] ?? rawColor;
}

export function applyCreateCalendarEventDefaults(
  rawArgs: Record<string, unknown>,
  ctx?: ActionDefaultsContext,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...rawArgs };

  if (
    out.date === undefined ||
    out.date === null ||
    (typeof out.date === 'string' && !out.date.trim())
  ) {
    out.date = ctx?.currentDateRecife ?? toRecifeDateString();
  }

  if (
    out.color === undefined ||
    out.color === null ||
    (typeof out.color === 'string' && !out.color.trim())
  ) {
    out.color = 'green';
  } else {
    out.color = normalizeColor(out.color);
  }

  const isAllDay = out.allDay === true;
  if (
    !isAllDay &&
    typeof out.startTime === 'string' &&
    HH_MM_REGEX.test(out.startTime.trim()) &&
    (out.endTime === undefined ||
      out.endTime === null ||
      (typeof out.endTime === 'string' && !out.endTime.trim()))
  ) {
    const trimmedStart = out.startTime.trim();
    out.startTime = trimmedStart;
    out.endTime = computeDefaultEndTime(trimmedStart, 60);
  }

  if (out.description === '') out.description = undefined;
  if (out.recurrenceUntil === '') out.recurrenceUntil = undefined;

  return out;
}

/**
 * Canonical create schema bound directly to `eventInputSchema` from `calendar/logic.ts`
 * with inferable defaults (today in Recife, color 'green', +1h endTime).
 */
export const createCalendarEventSchema = z.preprocess(
  (raw) =>
    raw && typeof raw === 'object'
      ? applyCreateCalendarEventDefaults(raw as Record<string, unknown>)
      : raw,
  eventInputSchema,
);

/**
 * Canonical update schema derived from `eventInputSchema.shape` (partial fields + id)
 * so updates never drift from UI validation and preserve existing boolean/enum values.
 */
export const updateCalendarEventSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
  title: eventInputSchema.shape.title.optional(),
  description: eventInputSchema.shape.description,
  date: eventInputSchema.shape.date.optional(),
  startTime: eventInputSchema.shape.startTime,
  endTime: eventInputSchema.shape.endTime,
  allDay: z.boolean().optional(),
  color: z
    .preprocess((val) => normalizeColor(val), z.enum(EVENT_COLORS))
    .optional(),
  recurrence: z.enum(RECURRENCES).optional(),
  recurrenceUntil: eventInputSchema.shape.recurrenceUntil,
});

export const deleteCalendarEventSchema = z.object({
  id: z.string().min(1, 'ID OBRIGATÓRIO'),
});

const pureDateParam = z.string().refine((v) => {
  try {
    assertPureDate(v);
    return true;
  } catch {
    return false;
  }
}, 'DATA INVÁLIDA (USE AAAA-MM-DD)');

export const listCalendarItemsSchema = z.object({
  from: pureDateParam,
  to: pureDateParam,
});

export const CALENDAR_CATALOG: Record<string, ActionCatalogEntry> = {
  createCalendarEvent: defineAction({
    name: 'createCalendarEvent',
    module: 'CALENDAR',
    displayName: 'CRIAR EVENTO DE AGENDA',
    entityLabel: 'Evento de Agenda',
    operation: 'create',
    description:
      'Cria um novo Evento de Agenda no Calendário (compromisso com data, horário ou dia inteiro).',
    isDestructive: false,
    schema: createCalendarEventSchema,
    inferableDefaults: {
      date: (ctx) => ctx?.currentDateRecife ?? toRecifeDateString(),
      color: () => 'green',
      allDay: () => false,
      recurrence: () => 'NONE',
    },
    applyDefaults: applyCreateCalendarEventDefaults,
    fields: {
      title: {
        name: 'title',
        label: 'TÍTULO',
        description: 'Título do Evento de Agenda.',
        required: true,
      },
      date: {
        name: 'date',
        label: 'DATA',
        description: 'Data do evento no formato AAAA-MM-DD (America/Recife).',
        required: false,
        inferableDefault: 'DATA DE HOJE EM RECIFE',
      },
      startTime: {
        name: 'startTime',
        label: 'HORÁRIO DE INÍCIO',
        description: 'Horário de início HH:MM (obrigatório quando allDay for false).',
        required: false,
      },
      endTime: {
        name: 'endTime',
        label: 'HORÁRIO DE TÉRMINO',
        description: 'Horário de término HH:MM (deve ser depois do início).',
        required: false,
        inferableDefault: '1 HORA APÓS O INÍCIO',
      },
      allDay: {
        name: 'allDay',
        label: 'DIA INTEIRO',
        description: 'Define se o evento dura o dia inteiro.',
        required: false,
        inferableDefault: 'false',
      },
      color: {
        name: 'color',
        label: 'COR',
        description: 'Cor da paleta do calendário: green, red, blue ou yellow.',
        required: false,
        inferableDefault: 'green',
      },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Detalhes ou observações do evento.',
        required: false,
      },
      recurrence: {
        name: 'recurrence',
        label: 'RECORRÊNCIA',
        description: 'Regra de repetição: NONE, DAILY, WEEKLY ou MONTHLY.',
        required: false,
        inferableDefault: 'NONE',
      },
      recurrenceUntil: {
        name: 'recurrenceUntil',
        label: 'REPETIR ATÉ',
        description: 'Data limite da recorrência (AAAA-MM-DD).',
        required: false,
      },
    },
  }),

  updateCalendarEvent: defineAction({
    name: 'updateCalendarEvent',
    module: 'CALENDAR',
    displayName: 'ATUALIZAR EVENTO DE AGENDA',
    entityLabel: 'Evento de Agenda',
    operation: 'update',
    description: 'Atualiza ou reagenda um Evento de Agenda existente pelo ID.',
    isDestructive: false,
    schema: updateCalendarEventSchema,
    fields: {
      id: {
        name: 'id',
        label: 'ID DO EVENTO',
        description: 'Identificador único do Evento de Agenda a ser atualizado.',
        required: true,
      },
      title: {
        name: 'title',
        label: 'TÍTULO',
        description: 'Novo título do evento.',
        required: false,
      },
      date: {
        name: 'date',
        label: 'DATA',
        description: 'Nova data do evento (AAAA-MM-DD).',
        required: false,
      },
      startTime: {
        name: 'startTime',
        label: 'HORÁRIO DE INÍCIO',
        description: 'Novo horário de início (HH:MM).',
        required: false,
      },
      endTime: {
        name: 'endTime',
        label: 'HORÁRIO DE TÉRMINO',
        description: 'Novo horário de término (HH:MM).',
        required: false,
      },
      allDay: {
        name: 'allDay',
        label: 'DIA INTEIRO',
        description: 'Altera se o evento é de dia inteiro.',
        required: false,
      },
      color: {
        name: 'color',
        label: 'COR',
        description: 'Nova cor: green, red, blue ou yellow.',
        required: false,
      },
      description: {
        name: 'description',
        label: 'DESCRIÇÃO',
        description: 'Nova descrição opcional.',
        required: false,
      },
      recurrence: {
        name: 'recurrence',
        label: 'RECORRÊNCIA',
        description: 'Nova regra de repetição: NONE, DAILY, WEEKLY ou MONTHLY.',
        required: false,
      },
      recurrenceUntil: {
        name: 'recurrenceUntil',
        label: 'REPETIR ATÉ',
        description: 'Nova data limite de repetição (AAAA-MM-DD).',
        required: false,
      },
    },
  }),

  deleteCalendarEvent: defineAction({
    name: 'deleteCalendarEvent',
    module: 'CALENDAR',
    displayName: 'EXCLUIR EVENTO DE AGENDA',
    entityLabel: 'Evento de Agenda',
    operation: 'delete',
    description:
      'Remove um Evento de Agenda do calendário pelo ID (exige confirmação explícita).',
    isDestructive: true,
    schema: deleteCalendarEventSchema,
    fields: {
      id: {
        name: 'id',
        label: 'ID DO EVENTO',
        description: 'Identificador do Evento de Agenda a ser excluído.',
        required: true,
      },
    },
  }),

  listCalendarItems: defineAction({
    name: 'listCalendarItems',
    module: 'CALENDAR',
    displayName: 'CONSULTAR CALENDÁRIO',
    entityLabel: 'Calendário',
    operation: 'read',
    description:
      'Lista Eventos de Agenda e Itens Projetados na Agenda (marcos acadêmicos, contas e entregas) no intervalo de datas.',
    isDestructive: false,
    schema: listCalendarItemsSchema,
    fields: {
      from: {
        name: 'from',
        label: 'DATA INICIAL',
        description: 'Início do intervalo no formato AAAA-MM-DD.',
        required: true,
      },
      to: {
        name: 'to',
        label: 'DATA FINAL',
        description: 'Fim do intervalo no formato AAAA-MM-DD.',
        required: true,
      },
    },
  }),
};
