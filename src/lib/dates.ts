import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const APP_TIMEZONE = 'America/Recife' as const;
export type PureDateString = string;

const PURE_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

function isValidCalendarYMD(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const dt = new Date(Date.UTC(year, month - 1, day));
  return (
    dt.getUTCFullYear() === year &&
    dt.getUTCMonth() === month - 1 &&
    dt.getUTCDate() === day
  );
}

export function assertPureDate(pureDate: PureDateString): [string, string, string] {
  const match = PURE_DATE_REGEX.exec(pureDate.trim());
  if (!match) {
    throw new Error(`DATA PURA INVÁLIDA (ESPERADO YYYY-MM-DD): ${pureDate}`);
  }
  const [, yearStr, monthStr, dayStr] = match;
  if (!isValidCalendarYMD(Number(yearStr), Number(monthStr), Number(dayStr))) {
    throw new Error(`DATA DE CALENDÁRIO INEXISTENTE: ${pureDate}`);
  }
  return [yearStr, monthStr, dayStr];
}

export function formatPureDateBR(pureDate: PureDateString): string {
  const [year, month, day] = assertPureDate(pureDate);
  return `${day}/${month}/${year}`;
}

export function formatPureDateShortBR(pureDate: PureDateString): string {
  const [, month, day] = assertPureDate(pureDate);
  return `${day}/${month}`;
}

export function parseBRDateToPureDate(brDate: string): PureDateString {
  const match = BR_DATE_REGEX.exec(brDate.trim());
  if (!match) {
    throw new Error(`DATA BR INVÁLIDA (ESPERADO DD/MM/AAAA): ${brDate}`);
  }
  const [, day, month, year] = match;
  const candidate = `${year}-${month}-${day}`;
  assertPureDate(candidate);
  return candidate;
}

export function toRecifeDateString(isoInput: string | Date = new Date()): PureDateString {
  if (typeof isoInput === 'string' && PURE_DATE_REGEX.test(isoInput.trim())) {
    assertPureDate(isoInput.trim());
    return isoInput.trim();
  }
  const dateObj = typeof isoInput === 'string' ? new Date(isoInput) : isoInput;
  if (Number.isNaN(dateObj.getTime())) {
    throw new Error(`TIMESTAMP INVÁLIDO: ${String(isoInput)}`);
  }
  const tzDate = new TZDate(dateObj.getTime(), APP_TIMEZONE);
  return format(tzDate, 'yyyy-MM-dd');
}

export function toRecifeTimeHHMM(isoInput: string | Date): string {
  const dateObj = typeof isoInput === 'string' ? new Date(isoInput) : isoInput;
  if (Number.isNaN(dateObj.getTime())) {
    throw new Error(`TIMESTAMP INVÁLIDO: ${String(isoInput)}`);
  }
  const tzDate = new TZDate(dateObj.getTime(), APP_TIMEZONE);
  return format(tzDate, 'HH:mm');
}

export function daysBetweenPureDates(
  fromPureDate: PureDateString,
  toPureDate: PureDateString,
): number {
  const [y1, m1, d1] = assertPureDate(fromPureDate).map(Number);
  const [y2, m2, d2] = assertPureDate(toPureDate).map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}
