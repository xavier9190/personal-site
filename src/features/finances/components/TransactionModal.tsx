'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchModal } from '@/components/sketch/SketchModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { formatCentsToBRL } from '@/lib/currency';
import { toRecifeDateString } from '@/lib/dates';
import type { TransactionRecord } from '../service';
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from '../actions';
import { CategorySelector } from './CategorySelector';

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTransaction?: TransactionRecord | null;
  availableCategories?: readonly string[];
}

export function TransactionModal({
  isOpen,
  onClose,
  initialTransaction,
  availableCategories,
}: TransactionModalProps) {
  const isEditing = Boolean(initialTransaction);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('ALIMENTAÇÃO');
  const [amountBRL, setAmountBRL] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (initialTransaction) {
      setType(initialTransaction.type);
      setOccurredAt(initialTransaction.occurredAt);
      setDescription(initialTransaction.description);
      setCategory(initialTransaction.category);
      setAmountBRL(
        formatCentsToBRL(initialTransaction.amountCents).replace(/^R\$\s*/, ''),
      );
    } else {
      setType('EXPENSE');
      setOccurredAt(toRecifeDateString());
      setDescription('');
      setCategory('ALIMENTAÇÃO');
      setAmountBRL('');
    }
    setError(null);
  }, [isOpen, initialTransaction]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!description.trim() || !category.trim() || !amountBRL.trim() || !occurredAt.trim()) {
      setError('PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS.');
      return;
    }

    setSaving(true);
    setError(null);

    const payload = { type, description, category, amountBRL, occurredAt };
    const result = initialTransaction
      ? await updateTransactionAction(initialTransaction.id, payload)
      : await createTransactionAction(payload);

    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'ERRO AO SALVAR TRANSAÇÃO.');
      return;
    }
    onClose();
  }

  async function handleDelete() {
    if (!initialTransaction) return;
    setSaving(true);
    const result = await deleteTransactionAction(initialTransaction.id);
    setSaving(false);
    if (!result.ok) {
      setError(result.error ?? 'ERRO AO EXCLUIR TRANSAÇÃO.');
      return;
    }
    setConfirmDelete(false);
    onClose();
  }

  const inputClass =
    'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

  return (
    <SketchModal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'EDITAR TRANSAÇÃO' : 'NOVA TRANSAÇÃO'}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <SketchButton
            type="button"
            variant={type === 'INCOME' ? 'filled' : 'outline'}
            onClick={() => setType('INCOME')}
          >
            ENTRADA (↑)
          </SketchButton>
          <SketchButton
            type="button"
            variant={type === 'EXPENSE' ? 'filled' : 'outline'}
            onClick={() => setType('EXPENSE')}
          >
            SAÍDA (↓)
          </SketchButton>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="tx-date" className="mb-1 block text-xs">
              DATA (AAAA-MM-DD)
            </label>
            <input
              id="tx-date"
              type="date"
              value={occurredAt}
              onChange={(e) => setOccurredAt(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="tx-amount" className="mb-1 block text-xs">
              VALOR (R$)
            </label>
            <input
              id="tx-amount"
              type="text"
              inputMode="decimal"
              placeholder="EX: 45,90"
              value={amountBRL}
              onChange={(e) => setAmountBRL(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="tx-desc" className="mb-1 block text-xs">
            DESCRIÇÃO
          </label>
          <input
            id="tx-desc"
            type="text"
            placeholder="EX: ALMOÇO, SALÁRIO, UBER..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={inputClass}
          />
        </div>

        <CategorySelector
          value={category}
          onChange={setCategory}
          availableCategories={availableCategories}
        />

        {error && (
          <p className="rounded border-2 border-dashed border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {isEditing ? (
            <SketchButton
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => setConfirmDelete(true)}
              className="text-[#ffc9c9] hover:bg-[#ffc9c9]/10"
            >
              EXCLUIR
            </SketchButton>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <SketchButton type="button" variant="ghost" disabled={saving} onClick={onClose}>
              CANCELAR
            </SketchButton>
            <SketchButton type="submit" variant="filled" disabled={saving}>
              {saving ? 'SALVANDO...' : 'SALVAR'}
            </SketchButton>
          </div>
        </div>
      </form>

      {initialTransaction && (
        <ConfirmDeleteModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={handleDelete}
          itemDescription={`A TRANSAÇÃO "${initialTransaction.description}" (${formatCentsToBRL(initialTransaction.amountCents)})`}
          pending={saving}
        />
      )}
    </SketchModal>
  );
}
