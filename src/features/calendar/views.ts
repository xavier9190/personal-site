import {
  addDays,
  addMonths,
  addYears,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
} from 'date-fns';

export const CALENDAR_VIEWS = ['DAY', 'WEEK', 'MONTH', 'YEAR', 'AGENDA'] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export const VIEW_LABEL: Record<CalendarView, string> = {
  DAY: 'DIA',
  WEEK: 'SEMANA',
  MONTH: 'MÊS',
  YEAR: 'ANO',
  AGENDA: 'PROGRAMAÇÃO',
};

export const AGENDA_DAYS = 60;

export function parsePure(d: string): Date {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(y, m - 1, day);
}

export const fmt = (d: Date) => format(d, 'yyyy-MM-dd');

export interface DateRange {
  from: string;
  to: string;
}

const WEEK = { weekStartsOn: 0 } as const;

/** Semanas completas que cobrem o mês de `date` (grade do mês / mini-calendário). */
export function monthGridRange(date: string): DateRange {
  const d = parsePure(date);
  return { from: fmt(startOfWeek(startOfMonth(d), WEEK)), to: fmt(endOfWeek(endOfMonth(d), WEEK)) };
}

export function viewRange(view: CalendarView, date: string): DateRange {
  const d = parsePure(date);
  switch (view) {
    case 'DAY':
      return { from: date, to: date };
    case 'WEEK':
      return { from: fmt(startOfWeek(d, WEEK)), to: fmt(endOfWeek(d, WEEK)) };
    case 'MONTH':
      return monthGridRange(date);
    case 'YEAR':
      return { from: `${d.getFullYear()}-01-01`, to: `${d.getFullYear()}-12-31` };
    case 'AGENDA':
      return { from: date, to: fmt(addDays(d, AGENDA_DAYS - 1)) };
  }
}

/** Intervalo único buscado do servidor: visão + mini-calendário + hoje. */
export function fetchRange(view: CalendarView, date: string, today: string): DateRange {
  const ranges = [viewRange(view, date), monthGridRange(date), { from: today, to: today }];
  return {
    from: ranges.map((r) => r.from).sort()[0],
    to: ranges.map((r) => r.to).sort().reverse()[0],
  };
}

export function navigate(view: CalendarView, date: string, dir: -1 | 1): string {
  const d = parsePure(date);
  switch (view) {
    case 'DAY':
      return fmt(addDays(d, dir));
    case 'WEEK':
      return fmt(addDays(d, 7 * dir));
    case 'MONTH':
      return fmt(addMonths(d, dir));
    case 'YEAR':
      return fmt(addYears(d, dir));
    case 'AGENDA':
      return fmt(addDays(d, AGENDA_DAYS * dir));
  }
}

export function eachDay(range: DateRange): string[] {
  const out: string[] = [];
  for (let d = parsePure(range.from); fmt(d) <= range.to; d = addDays(d, 1)) out.push(fmt(d));
  return out;
}

const MONTHS = ['JANEIRO', 'FEVEREIRO', 'MARÇO', 'ABRIL', 'MAIO', 'JUNHO', 'JULHO', 'AGOSTO', 'SETEMBRO', 'OUTUBRO', 'NOVEMBRO', 'DEZEMBRO'];
export const WEEKDAYS_SHORT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

export const monthName = (m: number) => MONTHS[m];

export function titleFor(view: CalendarView, date: string): string {
  const d = parsePure(date);
  const month = MONTHS[d.getMonth()];
  switch (view) {
    case 'DAY':
      return `${d.getDate()} DE ${month} DE ${d.getFullYear()}`;
    case 'WEEK': {
      const r = viewRange('WEEK', date);
      const a = parsePure(r.from);
      const b = parsePure(r.to);
      return `${a.getDate()} ${MONTHS[a.getMonth()].slice(0, 3)} – ${b.getDate()} ${MONTHS[b.getMonth()].slice(0, 3)} ${b.getFullYear()}`;
    }
    case 'MONTH':
      return `${month} ${d.getFullYear()}`;
    case 'YEAR':
      return String(d.getFullYear());
    case 'AGENDA':
      return `PROGRAMAÇÃO A PARTIR DE ${format(d, 'dd/MM/yyyy')}`;
  }
}
