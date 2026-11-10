'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { SketchModal } from '@/components/sketch/SketchModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { formatCentsToBRL } from '@/lib/currency';
import { toRecifeDateString } from '@/lib/dates';
import {
  createTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
} from '../actions';

export interface EditableTransaction {
  id: string;
  type: 'INCOME' | 'EXPENSE';
  description: string;
  category: string;
  amountCents: number;
  occurredAt: string;
}

export interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTransaction?: EditableTransaction | null;
}

export function TransactionModal({
  isOpen,
  onClose,
  initialTransaction,
}: TransactionModalProps) {
  const isEditing = Boolean(initialTransaction);
  const [type, setType] = useState<'INCOME' | 'EXPENSE'>('EXPENSE');
  const [occurredAt, setOccurredAt] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [amountBRL, setAmountBRL] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

    const payload = {
      type,
      description,
      category,
      amountBRL,
      occurredAt,
    };

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
    onClose();
  }

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
              className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none"
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
              className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none"
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
            className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none"
          />
        </div>

        <div>
          <label htmlFor="tx-category" className="mb-1 block text-xs">
            CATEGORIA
          </label>
          <input
            id="tx-category"
            type="text"
            placeholder="EX: ALIMENTAÇÃO, TRANSPORTE, TRABALHO..."
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none"
          />
        </div>

        {error && (
          <p className="rounded border-2 border-[#ffc9c9] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5]">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-3 pt-2">
          {isEditing ? (
            <SketchButton
              type="button"
              variant="outline"
              disabled={saving}
              onClick={handleDelete}
            >
              EXCLUIR
            </SketchButton>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <SketchButton
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={onClose}
            >
              CANCELAR
            </SketchButton>
            <SketchButton type="submit" variant="filled" disabled={saving}>
              {saving ? 'SALVANDO...' : 'SALVAR'}
            </SketchButton>
          </div>
        </div>
      </form>
    </SketchModal>
  );
}
