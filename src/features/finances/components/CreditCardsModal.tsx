'use client';

import { useState } from 'react';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { EmptyState } from '@/components/sketch/EmptyState';
import type { CreditCardRecord } from '../service';
import { createCreditCardAction, deleteCreditCardAction } from '../bill-actions';

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] focus:outline-none';

export interface CreditCardsModalProps {
  isOpen: boolean;
  onClose: () => void;
  cards: CreditCardRecord[];
}

export function CreditCardsModal({ isOpen, onClose, cards }: CreditCardsModalProps) {
  const [name, setName] = useState('');
  const [closingDay, setClosingDay] = useState('8');
  const [dueDay, setDueDay] = useState('15');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [deletingCard, setDeletingCard] = useState<CreditCardRecord | null>(null);

  async function exec(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setError(res.ok ? null : (res.error ?? 'ERRO'));
    return res.ok;
  }

  async function handleCreate() {
    const ok = await exec(() =>
      createCreditCardAction({ name, closingDay: Number(closingDay), dueDay: Number(dueDay) }),
    );
    if (ok) setName('');
  }

  return (
    <SketchModal isOpen={isOpen} onClose={onClose} title="CARTÕES DE CRÉDITO">
      <div className="space-y-4">
        {cards.length === 0 ? (
          <EmptyState title="SEM CARTÕES" description="CADASTRE UM CARTÃO ABAIXO." />
        ) : (
          <ul className="space-y-2">
            {cards.map((card) => (
              <li
                key={card.id}
                className="flex items-center justify-between border-2 border-[#f1f3f5] px-3 py-2 text-xs"
              >
                <div>
                  <p>{card.name}</p>
                  <p className="text-[10px] text-[#868e96]">
                    FECHA DIA {card.closingDay} — VENCE DIA {card.dueDay}
                  </p>
                </div>
                <SketchButton
                  variant="ghost"
                  className="min-h-[36px] px-2 text-[10px] text-[#868e96] hover:text-[#ffc9c9]"
                  disabled={busy}
                  onClick={() => setDeletingCard(card)}
                >
                  X
                </SketchButton>
              </li>
            ))}
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
            aria-label="NOME DO CARTÃO"
            placeholder="NOME (EX: NUBANK)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-3">
            <input
              aria-label="DIA DE FECHAMENTO"
              placeholder="FECHAMENTO"
              type="number"
              min={1}
              max={31}
              value={closingDay}
              onChange={(e) => setClosingDay(e.target.value)}
              className={inputClass}
            />
            <input
              aria-label="DIA DE VENCIMENTO"
              placeholder="VENCIMENTO"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              className={inputClass}
            />
          </div>
          {error && (
            <p className="border-2 border-dashed border-[#f1f3f5] px-3 py-2 text-xs">{error}</p>
          )}
          <SketchButton type="submit" variant="filled" disabled={busy}>
            + ADICIONAR CARTÃO
          </SketchButton>
        </form>
      </div>

      {deletingCard && (
        <ConfirmDeleteModal
          isOpen={Boolean(deletingCard)}
          onClose={() => setDeletingCard(null)}
          onConfirm={async () => {
            const id = deletingCard.id;
            setDeletingCard(null);
            await exec(() => deleteCreditCardAction(id));
          }}
          itemDescription={`O CARTÃO "${deletingCard.name}"`}
          pending={busy}
        />
      )}
    </SketchModal>
  );
}
