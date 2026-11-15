'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { formatCentsToBRL } from '@/lib/currency';
import { toRecifeDateString } from '@/lib/dates';
import type { PayableBillRecord } from '../service';
import {
  createPayableBillAction,
  deletePayableBillAction,
  updatePayableBillAction,
} from '../bill-actions';
import { CategorySelector } from './CategorySelector';

const BILL_TYPES = [
  ['FIXED_RECURRING', 'CONTA FIXA'],
  ['DEBT_TO_PERSON', 'DÍVIDA A TERCEIROS'],
  ['SINGLE_BILL', 'CONTA AVULSA'],
] as const;

type BillType = (typeof BILL_TYPES)[number][0];

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

export interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBill?: PayableBillRecord | null;
  availableCategories?: readonly string[];
  defaultBillType?: BillType;
}

export function BillModal({
  isOpen,
  onClose,
  initialBill,
  availableCategories,
  defaultBillType = 'FIXED_RECURRING',
}: BillModalProps) {
  const router = useRouter();
  const isEditing = Boolean(initialBill);
  const [title, setTitle] = useState('');
  const [billType, setBillType] = useState<BillType>(defaultBillType);
  const [category, setCategory] = useState('MORADIA');
  const [amountBRL, setAmountBRL] = useState('');
  const [dueDate, setDueDate] = useState(toRecifeDateString());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialBill) {
      setTitle(initialBill.title);
      setBillType(
        initialBill.billType === 'CREDIT_CARD_BILL'
          ? 'SINGLE_BILL'
          : (initialBill.billType as BillType),
      );
      setCategory(initialBill.category);
      setAmountBRL(formatCentsToBRL(initialBill.amountCents).replace(/^R\$\s*/, ''));
      setDueDate(initialBill.dueDate);
    } else {
      setTitle('');
      setBillType(defaultBillType);
      setCategory('MORADIA');
      setAmountBRL('');
      setDueDate(toRecifeDateString());
    }
    setError(null);
  }, [isOpen, initialBill, defaultBillType]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!title.trim() || !amountBRL.trim() || !dueDate.trim()) {
      setError('PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS.');
      return;
    }

    setBusy(true);
    setError(null);

    const payload = { title, billType, category, amountBRL, dueDate };
    const res = initialBill
      ? await updatePayableBillAction(initialBill.id, payload)
      : await createPayableBillAction(payload);

    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'ERRO AO SALVAR CONTA.');
      return;
    }
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!initialBill) return;
    setBusy(true);
    const res = await deletePayableBillAction(initialBill.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'ERRO AO EXCLUIR CONTA.');
      return;
    }
    setConfirmDelete(false);
    router.refresh();
    onClose();
  }

  return (
    <SketchModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'EDITAR CONTA' : 'NOVA CONTA'}
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          aria-label="TÍTULO DA CONTA"
          placeholder="TÍTULO (EX: INTERNET, ALUGUEL)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className={inputClass}
        />

        <div className="grid grid-cols-2 gap-3">
          <select
            aria-label="TIPO"
            value={billType}
            onChange={(e) => setBillType(e.target.value as BillType)}
            className={inputClass}
          >
            {BILL_TYPES.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <input
            aria-label="VALOR"
            placeholder="VALOR R$ (EX: 120,00)"
            inputMode="decimal"
            value={amountBRL}
            onChange={(e) => setAmountBRL(e.target.value)}
            className={inputClass}
          />
        </div>

        <input
          aria-label="DATA DE VENCIMENTO"
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className={inputClass}
        />

        <CategorySelector
          value={category}
          onChange={setCategory}
          availableCategories={availableCategories}
        />

        {error && (
          <p className="border-2 border-dashed border-[#f1f3f5] px-3 py-2 text-xs">{error}</p>
        )}

        <div className="flex items-center justify-between gap-2 pt-2">
          {isEditing ? (
            <SketchButton
              type="button"
              variant="outline"
              disabled={busy}
              onClick={() => setConfirmDelete(true)}
              className="text-[#ffc9c9] hover:bg-[#ffc9c9]/10"
            >
              EXCLUIR
            </SketchButton>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <SketchButton type="button" variant="ghost" disabled={busy} onClick={onClose}>
              CANCELAR
            </SketchButton>
            <SketchButton type="submit" variant="filled" disabled={busy}>
              {busy ? 'SALVANDO...' : 'SALVAR'}
            </SketchButton>
          </div>
        </div>
      </form>

      {initialBill && (
        <ConfirmDeleteModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          itemDescription={`A CONTA "${initialBill.title}" (${formatCentsToBRL(initialBill.amountCents)})`}
          pending={busy}
        />
      )}
    </SketchModal>
  );
}
