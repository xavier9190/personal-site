'use client';

import { useState } from 'react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { toRecifeDateString } from '@/lib/dates';
import type { CreditCardRecord } from '../service';
import { createInstallmentPlanAction } from '../bill-actions';
import { CategorySelector } from './CategorySelector';

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

export interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCardRecord[];
  availableCategories: readonly string[];
}

export function InstallmentModal({
  isOpen,
  onClose,
  cards,
  availableCategories,
}: InstallmentModalProps) {
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('COMPRAS');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [amountBRL, setAmountBRL] = useState('');
  const [cardId, setCardId] = useState('');
  const [startMonth, setStartMonth] = useState(toRecifeDateString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    const res = await createInstallmentPlanAction({
      description,
      category,
      totalInstallments: Number(total),
      paidInstallments: Number(paid),
      installmentAmountBRL: amountBRL,
      creditCardId: cardId || null,
      startMonth,
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'ERRO AO SALVAR PARCELAMENTO');
      return;
    }
    setDescription('');
    setTotal('');
    setPaid('0');
    setAmountBRL('');
    setError(null);
    onClose();
  }

  return (
    <SketchModal isOpen={isOpen} onClose={onClose} title="NOVO PARCELAMENTO">
      <div className="space-y-3">
        <input
          aria-label="DESCRIÇÃO"
          placeholder="DESCRIÇÃO (EX: MONITOR 144HZ)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className={inputClass}
        />
        <div className="grid grid-cols-3 gap-3">
          <input
            aria-label="TOTAL DE PARCELAS"
            placeholder="TOTAL"
            type="number"
            min={1}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className={inputClass}
          />
          <input
            aria-label="PARCELAS PAGAS"
            placeholder="PAGAS"
            type="number"
            min={0}
            value={paid}
            onChange={(e) => setPaid(e.target.value)}
            className={inputClass}
          />
          <input
            aria-label="VALOR DA PARCELA"
            placeholder="R$ PARCELA"
            inputMode="decimal"
            value={amountBRL}
            onChange={(e) => setAmountBRL(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <select
            aria-label="CARTÃO"
            value={cardId}
            onChange={(e) => setCardId(e.target.value)}
            className={inputClass}
          >
            <option value="">AVULSO (SEM CARTÃO)</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.name}
              </option>
            ))}
          </select>
          <input
            aria-label="MÊS DE INÍCIO"
            type="month"
            value={startMonth}
            onChange={(e) => setStartMonth(e.target.value)}
            className={inputClass}
          />
        </div>
        <CategorySelector
          value={category}
          onChange={setCategory}
          availableCategories={availableCategories}
        />
        {error && (
          <p className="border-2 border-dashed border-[#f1f3f5] px-3 py-2 text-xs">{error}</p>
        )}
        <div className="flex justify-end gap-2">
          <SketchButton variant="ghost" onClick={onClose}>
            CANCELAR
          </SketchButton>
          <SketchButton variant="filled" disabled={busy} onClick={handleSave}>
            {busy ? 'SALVANDO...' : 'SALVAR'}
          </SketchButton>
        </div>
      </div>
    </SketchModal>
  );
}
