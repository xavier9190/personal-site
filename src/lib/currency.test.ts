import { describe, expect, it } from 'vitest';
import { formatCentsToBRL, maskBRLValue, parseBRLToCents, sumCents } from './currency';

describe('currency seam (centavos <-> R$ pt-BR)', () => {
  it('formats integer cents to BRL and sums fractional values without floating point drift', () => {
    const firstItem = parseBRLToCents('R$ 19,99');
    const secondItem = parseBRLToCents('0,01');

    expect(firstItem).toBe(1999);
    expect(secondItem).toBe(1);

    const total = sumCents([firstItem, secondItem]);
    expect(total).toBe(2000);
    expect(formatCentsToBRL(total)).toBe('R$ 20,00');
  });

  it('formats negative cents and masks hidden balances for privacy', () => {
    expect(formatCentsToBRL(14400)).toBe('R$ 144,00');
    expect(formatCentsToBRL(-5000)).toBe('-R$ 50,00');
    expect(maskBRLValue(10000, true)).toBe('R$ ••••');
    expect(maskBRLValue(10000, false)).toBe('R$ 100,00');
  });

  it('rejects non-integer cents or invalid currency input', () => {
    expect(() => formatCentsToBRL(19.99)).toThrow();
    expect(() => parseBRLToCents('abc')).toThrow();
  });
});
