'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { formatCentsToBRL } from '@/lib/currency';
import { toRecifeDateString } from '@/lib/dates';
import type { CreditCardRecord, InstallmentPlanRecord, InstallmentPlanView } from '../service';
import {
  createInstallmentPlanAction,
  deleteInstallmentPlanAction,
  updateInstallmentPlanAction,
} from '../bill-actions';
import { CategorySelector } from './CategorySelector';

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

export interface InstallmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCardRecord[];
  availableCategories: readonly string[];
  initialPlan?: InstallmentPlanRecord | InstallmentPlanView | null;
}

export function InstallmentModal({
  isOpen,
  onClose,
  cards,
  availableCategories,
  initialPlan,
}: InstallmentModalProps) {
  const router = useRouter();
  const isEditing = Boolean(initialPlan);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('COMPRAS');
  const [total, setTotal] = useState('');
  const [paid, setPaid] = useState('0');
  const [amountBRL, setAmountBRL] = useState('');
  const [cardId, setCardId] = useState('');
  const [startMonth, setStartMonth] = useState(toRecifeDateString().slice(0, 7));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialPlan) {
      setDescription(initialPlan.description);
      setCategory(initialPlan.category);
      setTotal(String(initialPlan.totalInstallments));
      setPaid(String(initialPlan.paidInstallments));
      setAmountBRL(formatCentsToBRL(initialPlan.installmentAmountCents).replace(/^R\$\s*/, ''));
      setCardId(initialPlan.creditCardId ?? '');
      setStartMonth(initialPlan.startMonth);
    } else {
      setDescription('');
      setCategory('COMPRAS');
      setTotal('');
      setPaid('0');
      setAmountBRL('');
      setCardId('');
      setStartMonth(toRecifeDateString().slice(0, 7));
    }
    setError(null);
  }, [isOpen, initialPlan]);

  async function handleSave() {
    setBusy(true);
    const payload = {
      description,
      category,
      totalInstallments: Number(total),
      paidInstallments: Number(paid),
      installmentAmountBRL: amountBRL,
      creditCardId: cardId || null,
      startMonth,
    };
    const res = initialPlan
      ? await updateInstallmentPlanAction(initialPlan.id, payload)
      : await createInstallmentPlanAction(payload);
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
    router.refresh();
    onClose();
  }

  async function handleDelete() {
    if (!initialPlan) return;
    setBusy(true);
    const res = await deleteInstallmentPlanAction(initialPlan.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'ERRO AO EXCLUIR PARCELAMENTO');
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
      title={isEditing ? 'EDITAR PARCELAMENTO' : 'NOVO PARCELAMENTO'}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="space-y-3"
      >
        <div>
          <label htmlFor="installment-description" className="mb-1 block text-xs">
            DESCRIÇÃO
          </label>
          <input
            id="installment-description"
            placeholder="EX: MONITOR 144HZ"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
          <div>
            <label htmlFor="installment-total" className="mb-1 block text-xs">
              Nº DE PARCELAS
            </label>
            <input
              id="installment-total"
              placeholder="EX: 12"
              type="number"
              min={1}
              value={total}
              onChange={(e) => setTotal(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="installment-paid" className="mb-1 block text-xs">
              PARCELAS PAGAS
            </label>
            <input
              id="installment-paid"
              placeholder="0"
              type="number"
              min={0}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="installment-amount" className="mb-1 block text-xs">
              PARCELA (R$)
            </label>
            <input
              id="installment-amount"
              placeholder="EX: 89,90"
              inputMode="decimal"
              value={amountBRL}
              onChange={(e) => setAmountBRL(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:items-end">
          <div>
            <label htmlFor="installment-card" className="mb-1 block text-xs">
              CARTÃO
            </label>
            <select
              id="installment-card"
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
          </div>
          <div>
            <label htmlFor="installment-start-month" className="mb-1 block text-xs">
              MÊS DE INÍCIO
            </label>
            <input
              id="installment-start-month"
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>
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

      {initialPlan && (
        <ConfirmDeleteModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          itemDescription={`O PARCELAMENTO "${initialPlan.description}"`}
          pending={busy}
        />
      )}
    </SketchModal>
  );
}
