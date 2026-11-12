'use client';

import { useEffect, useState } from 'react';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { EmptyState } from '@/components/sketch/EmptyState';
import { formatCentsToBRL } from '@/lib/currency';
import { toRecifeDateString } from '@/lib/dates';
import type { PayableBillRecord } from '../service';
import {
  createPayableBillAction,
  deletePayableBillAction,
  togglePayableBillStatusAction,
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

export interface BillsModalProps {
  isOpen: boolean;
  onClose: () => void;
  bills: PayableBillRecord[];
  availableCategories: readonly string[];
  initialEditingBill?: PayableBillRecord | null;
}

export function BillsModal({
  isOpen,
  onClose,
  bills,
  availableCategories,
  initialEditingBill,
}: BillsModalProps) {
  const [title, setTitle] = useState('');
  const [billType, setBillType] = useState<BillType>('FIXED_RECURRING');
  const [category, setCategory] = useState('MORADIA');
  const [amountBRL, setAmountBRL] = useState('');
  const [dueDate, setDueDate] = useState(toRecifeDateString());
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingBill, setDeletingBill] = useState<PayableBillRecord | null>(null);

  useEffect(() => {
    if (initialEditingBill) {
      startEdit(initialEditingBill);
    } else {
      setEditingId(null);
      setTitle('');
      setAmountBRL('');
    }
  }, [initialEditingBill, isOpen]);

  async function exec(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setError(res.ok ? null : (res.error ?? 'ERRO'));
    return res.ok;
  }

  async function handleCreate() {
    const payload = { title, billType, category, amountBRL, dueDate };
    const ok = await exec(() =>
      editingId ? updatePayableBillAction(editingId, payload) : createPayableBillAction(payload),
    );
    if (ok) {
      setTitle('');
      setAmountBRL('');
      setEditingId(null);
    }
  }

  function startEdit(bill: PayableBillRecord) {
    if (bill.billType === 'CREDIT_CARD_BILL') return;
    setEditingId(bill.id);
    setTitle(bill.title);
    setBillType(bill.billType as BillType);
    setCategory(bill.category);
    setAmountBRL(formatCentsToBRL(bill.amountCents).replace(/^R\$\s*/, ''));
    setDueDate(bill.dueDate);
  }

  return (
    <SketchModal isOpen={isOpen} onClose={onClose} title="CONTAS A PAGAR">
      <div className="space-y-4">
        {bills.length === 0 ? (
          <EmptyState title="SEM CONTAS NO PERÍODO" description="CADASTRE UMA CONTA ABAIXO." />
        ) : (
          <ul className="space-y-2">
            {bills.map((bill) => {
              const paid = bill.status === 'PAID';
              return (
                <li
                  key={bill.id}
                  onClick={() => startEdit(bill)}
                  className="flex items-center justify-between gap-2 border-2 border-[#f1f3f5] px-3 py-2 text-xs cursor-pointer hover:border-[#868e96] transition-colors"
                >
                  <div className={paid ? 'text-[#868e96]' : ''}>
                    <p className="font-medium">{bill.title}</p>
                    <p className="text-[10px] text-[#868e96]">
                      {bill.dueDate} — {formatCentsToBRL(bill.amountCents)}
                    </p>
                  </div>
                  <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                    <SketchButton
                      variant={paid ? 'filled' : 'outline'}
                      className="min-h-[36px] px-2 text-[10px]"
                      disabled={busy}
                      onClick={() => exec(() => togglePayableBillStatusAction(bill.id, !paid))}
                    >
                      {paid ? 'PAGO' : 'FALTA PAGAR'}
                    </SketchButton>
                    {bill.billType !== 'CREDIT_CARD_BILL' && (
                      <SketchButton
                        variant="ghost"
                        className="min-h-[36px] px-2 text-[10px]"
                        disabled={busy}
                        onClick={() => startEdit(bill)}
                      >
                        EDITAR
                      </SketchButton>
                    )}
                    <SketchButton
                      variant="ghost"
                      className="min-h-[36px] px-2 text-[10px] text-[#868e96] hover:text-[#ffc9c9]"
                      disabled={busy}
                      onClick={() => setDeletingBill(bill)}
                    >
                      X
                    </SketchButton>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleCreate();
          }}
          className="space-y-3 border-t-2 border-[#f1f3f5] pt-3"
        >
          <input
            aria-label="TÍTULO DA CONTA"
            placeholder="TÍTULO (EX: INTERNET)"
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
              placeholder="VALOR (R$)"
              inputMode="decimal"
              value={amountBRL}
              onChange={(e) => setAmountBRL(e.target.value)}
              className={inputClass}
            />
          </div>
          <input
            aria-label="VENCIMENTO"
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
          <SketchButton type="submit" variant="filled" disabled={busy}>
            {editingId ? 'SALVAR EDIÇÃO' : '+ ADICIONAR CONTA'}
          </SketchButton>
        </form>
      </div>

      {deletingBill && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingBill)}
          onClose={() => setDeletingBill(null)}
          onConfirm={async () => {
            const id = deletingBill.id;
            setDeletingBill(null);
            await exec(() => deletePayableBillAction(id));
          }}
          itemDescription={`A CONTA "${deletingBill.title}" (${formatCentsToBRL(deletingBill.amountCents)})`}
          pending={busy}
        />
      )}
    </SketchModal>
  );
}
