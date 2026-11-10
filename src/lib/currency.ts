export type Cents = number;

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function assertIntegerCents(cents: Cents): void {
  if (!Number.isInteger(cents)) {
    throw new Error(`VALOR MONETÁRIO DEVE SER INTEIRO EM CENTAVOS: ${cents}`);
  }
}

export function formatCentsToBRL(cents: Cents): string {
  assertIntegerCents(cents);
  // Normalize non-breaking spaces produced by Intl to regular spaces for deterministic rendering/assertions
  return brlFormatter.format(cents / 100).replace(/\u00a0/g, ' ');
}

export function maskBRLValue(cents: Cents, hideBalance: boolean): string {
  assertIntegerCents(cents);
  return hideBalance ? 'R$ ••••' : formatCentsToBRL(cents);
}

export function parseBRLToCents(raw: string | number): Cents {
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw)) {
      throw new Error('VALOR MONETÁRIO INVÁLIDO');
    }
    return Math.round(raw * 100);
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error('VALOR MONETÁRIO VAZIO');
  }

  const isNegative = trimmed.includes('-');
  const cleaned = trimmed.replace(/[R$\s-]/gi, '');
  if (!cleaned || !/^[0-9.,]+$/.test(cleaned)) {
    throw new Error(`FORMATO MONETÁRIO INVÁLIDO: ${raw}`);
  }

  // Handle Brazilian format (e.g. "1.234,56") vs dot decimal ("1234.56")
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;

  const numeric = Number(normalized);
  if (Number.isNaN(numeric)) {
    throw new Error(`FORMATO MONETÁRIO INVÁLIDO: ${raw}`);
  }

  const cents = Math.round(numeric * 100);
  return isNegative ? -cents : cents;
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (const val of values) {
    assertIntegerCents(val);
    total += val;
  }
  return total;
}
