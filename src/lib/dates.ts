import { TZDate } from '@date-fns/tz';
import { format } from 'date-fns';

export const APP_TIMEZONE = 'America/Recife' as const;

const PURE_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const BR_DATE_REGEX = /^(\d{2})\/(\d{2})\/(\d{4})$/;

export function assertPureDate(pureDate: string): [string, string, string] {
  const match = PURE_DATE_REGEX.exec(pureDate.trim());
  if (!match) {
    throw new Error(`DATA PURA INVÁLIDA (ESPERADO YYYY-MM-DD): ${pureDate}`);
  }
  return [match[1], match[2], match[3]];
}

export function formatPureDateBR(pureDate: string): string {
  const [year, month, day] = assertPureDate(pureDate);
  return `${day}/${month}/${year}`;
}

export function formatPureDateShortBR(pureDate: string): string {
  const [, month, day] = assertPureDate(pureDate);
  return `${day}/${month}`;
}

export function parseBRDateToPureDate(brDate: string): string {
  const match = BR_DATE_REGEX.exec(brDate.trim());
  if (!match) {
    throw new Error(`DATA BR INVÁLIDA (ESPERADO DD/MM/AAAA): ${brDate}`);
  }
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

export function toRecifeDateString(isoInput: string | Date = new Date()): string {
  if (typeof isoInput === 'string' && PURE_DATE_REGEX.test(isoInput.trim())) {
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

export function daysBetweenPureDates(fromPureDate: string, toPureDate: string): number {
  const [y1, m1, d1] = assertPureDate(fromPureDate).map(Number);
  const [y2, m2, d2] = assertPureDate(toPureDate).map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  return Math.round((utc2 - utc1) / (1000 * 60 * 60 * 24));
}
