import { z } from 'zod';
import { assertPureDate } from '@/lib/dates';

export const EVENT_COLORS = ['green', 'red', 'blue', 'yellow'] as const;
export type EventColor = (typeof EVENT_COLORS)[number];

export const COLOR_HEX: Record<EventColor, string> = {
  green: '#b2f2bb',
  red: '#ffc9c9',
  blue: '#a5d8ff',
  yellow: '#ffec99',
};

export const RECURRENCES = ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'] as const;
export type Recurrence = (typeof RECURRENCES)[number];

export const RECURRENCE_LABEL: Record<Recurrence, string> = {
  NONE: 'NÃO SE REPETE',
  DAILY: 'DIARIAMENTE',
  WEEKLY: 'SEMANALMENTE',
  MONTHLY: 'MENSALMENTE',
};

export type CalendarItemSource =
  | 'EVENT'
  | 'ACADEMIC_MILESTONE'
  | 'ACADEMIC_DELIVERY'
  | 'FINANCE_BILL'
  | 'SHOPPING_DELIVERY';

export interface CalendarItem {
  key: string;
  source: CalendarItemSource;
  title: string;
  /** YYYY-MM-DD (America/Recife). */
  date: string;
  /** HH:mm ou null para dia inteiro. */
  startTime: string | null;
  endTime: string | null;
  allDay: boolean;
  /** Cor hex da paleta. */
  color: string;
  eventId: string | null;
  sourceId: string | null;
  readOnly: boolean;
  done: boolean;
  href: string | null;
}

const pureDate = z.string().refine((v) => {
  try {
    assertPureDate(v);
    return true;
  } catch {
    return false;
  }
}, 'DATA INVÁLIDA (USE AAAA-MM-DD)');

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HORA INVÁLIDA (USE HH:MM)');

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, 'TÍTULO OBRIGATÓRIO'),
    description: z.string().trim().nullable().optional(),
    date: pureDate,
    startTime: timeSchema.optional(),
    endTime: timeSchema.optional(),
    allDay: z.boolean().default(false),
    color: z.enum(EVENT_COLORS),
    recurrence: z.enum(RECURRENCES).default('NONE'),
    recurrenceUntil: pureDate.nullable().optional(),
  })
  .superRefine((v, ctx) => {
    if (!v.allDay) {
      if (!v.startTime || !v.endTime) {
        ctx.addIssue({ code: 'custom', message: 'HORÁRIO DE INÍCIO E FIM OBRIGATÓRIOS' });
      } else if (v.endTime <= v.startTime) {
        ctx.addIssue({ code: 'custom', message: 'FIM DEVE SER DEPOIS DO INÍCIO', path: ['endTime'] });
      }
    }
    if (v.recurrenceUntil && v.recurrenceUntil < v.date) {
      ctx.addIssue({ code: 'custom', message: 'REPETIR ATÉ DEVE SER DEPOIS DO INÍCIO', path: ['recurrenceUntil'] });
    }
  });

export type EventInput = z.input<typeof eventInputSchema>;

// ---------- pure date helpers (UTC arithmetic over YYYY-MM-DD) ----------

function parts(d: string): [number, number, number] {
  const [y, m, day] = assertPureDate(d).map(Number);
  return [y, m, day];
}

export function addDaysPure(d: string, n: number): string {
  const [y, m, day] = parts(d);
  return new Date(Date.UTC(y, m - 1, day + n)).toISOString().slice(0, 10);
}

function diffDays(a: string, b: string): number {
  const [y1, m1, d1] = parts(a);
  const [y2, m2, d2] = parts(b);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

function monthOccurrence(start: string, k: number): string {
  const [y, m, day] = parts(start);
  const total = y * 12 + (m - 1) + k;
  const ny = Math.floor(total / 12);
  const nm = total % 12;
  const last = new Date(Date.UTC(ny, nm + 1, 0)).getUTCDate();
  return `${ny}-${String(nm + 1).padStart(2, '0')}-${String(Math.min(day, last)).padStart(2, '0')}`;
}

/** Datas de ocorrência de um evento dentro de [from, to] (inclusive). */
export function expandOccurrenceDates(
  start: string,
  rule: Recurrence,
  until: string | null,
  from: string,
  to: string,
): string[] {
  const last = until && until < to ? until : to;
  if (last < from) return [];
  if (rule === 'NONE') return start >= from && start <= to ? [start] : [];
  const out: string[] = [];
  if (rule === 'DAILY' || rule === 'WEEKLY') {
    const step = rule === 'DAILY' ? 1 : 7;
    let cur = start;
    if (from > start) {
      const skip = Math.floor(diffDays(start, from) / step) * step;
      cur = addDaysPure(start, skip);
      if (cur < from) cur = addDaysPure(cur, step);
    }
    for (; cur <= last; cur = addDaysPure(cur, step)) out.push(cur);
    return out;
  }
  // MONTHLY
  for (let k = 0; ; k++) {
    const occ = monthOccurrence(start, k);
    if (occ > last) break;
    if (occ >= from) out.push(occ);
    if (k > 12000) break;
  }
  return out;
}

// ---------- conflicts & layout ----------

function minutes(t: string): number {
  return Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
}

export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return minutes(aStart) < minutes(bEnd) && minutes(bStart) < minutes(aEnd);
}

function isTimed(i: CalendarItem): i is CalendarItem & { startTime: string; endTime: string } {
  return !i.allDay && i.startTime !== null && i.endTime !== null;
}

/** Pares de itens com horário que se sobrepõem no mesmo dia. */
export function detectConflicts(items: CalendarItem[]): Array<[CalendarItem, CalendarItem]> {
  const timed = items.filter(isTimed);
  const out: Array<[CalendarItem, CalendarItem]> = [];
  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i];
      const b = timed[j];
      if (a.date === b.date && timesOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
        out.push([a, b]);
      }
    }
  }
  return out;
}

export interface LayoutItem {
  item: CalendarItem;
  /** Coluna (0-based) dentro do grupo de sobreposição. */
  column: number;
  /** Total de colunas do grupo de sobreposição. */
  columns: number;
  startMinute: number;
  endMinute: number;
}

/** Posiciona itens com horário de um único dia lado a lado quando se sobrepõem. */
export function layoutDay(items: CalendarItem[]): LayoutItem[] {
  const timed = items
    .filter(isTimed)
    .sort((a, b) => minutes(a.startTime) - minutes(b.startTime) || minutes(b.endTime) - minutes(a.endTime));
  const result: LayoutItem[] = [];
  let group: LayoutItem[] = [];
  let groupEnd = -1;
  const flush = () => {
    const columns = group.reduce((m, l) => Math.max(m, l.column + 1), 0);
    for (const l of group) l.columns = columns;
    result.push(...group);
    group = [];
  };
  for (const item of timed) {
    const s = minutes(item.startTime);
    const e = minutes(item.endTime);
    if (group.length && s >= groupEnd) flush();
    if (!group.length) groupEnd = -1;
    const used = new Set(group.filter((l) => l.endMinute > s).map((l) => l.column));
    let column = 0;
    while (used.has(column)) column++;
    group.push({ item, column, columns: 1, startMinute: s, endMinute: e });
    groupEnd = Math.max(groupEnd, e);
  }
  if (group.length) flush();
  return result;
}
