import { describe, expect, it } from 'vitest';
import {
  APP_TIMEZONE,
  daysBetweenPureDates,
  formatPureDateBR,
  formatPureDateShortBR,
  parseBRDateToPureDate,
  toRecifeDateString,
  toRecifeTimeHHMM,
} from './dates';

describe('dates seam (America/Recife & Pure Dates YYYY-MM-DD)', () => {
  it('preserves pure date YYYY-MM-DD without shifting -1 day in America/Recife', () => {
    expect(APP_TIMEZONE).toBe('America/Recife');
    expect(formatPureDateBR('2026-11-18')).toBe('18/11/2026');
    expect(formatPureDateShortBR('2026-05-12')).toBe('12/05');
    expect(parseBRDateToPureDate('18/11/2026')).toBe('2026-11-18');
  });

  it('rejects impossible calendar dates', () => {
    expect(() => formatPureDateBR('2026-02-31')).toThrow();
    expect(() => parseBRDateToPureDate('31/02/2026')).toThrow();
    expect(() => formatPureDateBR('2026-99-99')).toThrow();
  });

  it('converts UTC ISO timestamps to America/Recife (UTC-3) date and time accurately', () => {
    const utcTimestamp = '2026-11-18T01:30:00.000Z';
    expect(toRecifeDateString(utcTimestamp)).toBe('2026-11-17');
    expect(toRecifeTimeHHMM(utcTimestamp)).toBe('22:30');
  });

  it('calculates exact calendar days between two pure dates', () => {
    expect(daysBetweenPureDates('2026-05-09', '2026-05-12')).toBe(3);
    expect(daysBetweenPureDates('2026-05-12', '2026-05-09')).toBe(-3);
    expect(daysBetweenPureDates('2026-05-12', '2026-05-12')).toBe(0);
  });
});
