'use client';

import { useMemo, useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { formatCentsToBRL, parseBRLToCents } from '@/lib/currency';
import { formatPureDateShortBR } from '@/lib/dates';
import {
  addPurchasedItemAction,
  addWishlistItemAction,
  deleteItemAction,
  markDeliveredAction,
  markPurchasedAction,
  revertDeliveredAction,
  revertToWishlistAction,
  updateInTransitItemAction,
  updateWishlistItemAction,
} from '../actions';
import type { InTransitView, ShoppingItemRecord } from '../service';

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-sm uppercase text-[#f1f3f5]';

function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-xs">
        {label}
      </label>
      {children}
    </div>
  );
}

function SortIcon({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 5h11" />
      <path d="M3 10h9" />
      <path d="M3 15h7" />
      <path d="M3 20h5" />
      <path d="M19 4v16" />
      <path d="m15 16 4 4 4-4" />
    </svg>
  );
}

export interface ShoppingDashboardClientProps {
  wishlist: ShoppingItemRecord[];
  inTransit: InTransitView[];
  delivered: ShoppingItemRecord[];
  today: string;
}

export function ShoppingDashboardClient({
  wishlist,
  inTransit,
  delivered,
  today,
}: ShoppingDashboardClientProps) {
  const [addOpen, setAddOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [editing, setEditing] = useState<ShoppingItemRecord | null>(null);
  const [buying, setBuying] = useState<ShoppingItemRecord | null>(null);
  const [editingTransit, setEditingTransit] = useState<InTransitView | null>(null);
  const [transitSortField, setTransitSortField] = useState<'date' | 'price'>('date');
  const [transitSortDirection, setTransitSortDirection] = useState<'asc' | 'desc'>('asc');
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [, startTransition] = useTransition();

  const sortedInTransit = useMemo(() => {
    return [...inTransit].sort((a, b) => {
      if (transitSortField === 'date') {
        const dateA = a.estimatedDeliveryDate ?? a.purchasedAt ?? '';
        const dateB = b.estimatedDeliveryDate ?? b.purchasedAt ?? '';
        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;
        return transitSortDirection === 'asc'
          ? dateA.localeCompare(dateB)
          : dateB.localeCompare(dateA);
      }
      const diff = a.priceCents - b.priceCents;
      return transitSortDirection === 'asc' ? diff : -diff;
    });
  }, [inTransit, transitSortField, transitSortDirection]);

  const act = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn()));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:h-full md:min-h-0 md:overflow-y-auto md:p-6">
      <PageHeader
        moduleId="shopping"
        subtitle="JÁ COMPREI (A CAMINHO) E QUERO COMPRAR (WISHLIST)"
        onAddClick={() => setAddOpen(true)}
      />

      <section className="shrink-0 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <h2 className="text-base tracking-wider">JÁ COMPREI (A CAMINHO) ({inTransit.length})</h2>
            <button
              type="button"
              onClick={() => setSortModalOpen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-md border-2 border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] hover:bg-[#f1f3f5] hover:text-[#121212] transition-colors"
              title="Organizar por preço ou por data"
              aria-label="Organizar por preço ou por data"
            >
              <SortIcon className="h-3.5 w-3.5" />
            </button>
          </div>
          <SketchButton variant="outline" className="min-h-[32px] px-3 text-xs" onClick={() => setHistoryOpen(true)}>
            HISTÓRICO ({delivered.length})
          </SketchButton>
        </div>
        {inTransit.length === 0 ? (
          <EmptyState
            title="NENHUMA ENCOMENDA EM TRÂNSITO"
            description="QUANDO MARCAR UM ITEM COMO COMPREI ✓, ACOMPANHE O PRAZO E PROGRESSO DE ENTREGA AQUI."
          />
        ) : (
          <Carousel rows={sortedInTransit.length > 1 ? 2 : 1}>
            {sortedInTransit.map((item) => (
              <Card key={item.id} onClick={() => setEditingTransit(item)}>
                <p className="flex items-center gap-2 text-sm">
                  {item.name}
                  {item.isOverdue && (
                    <span title="ENTREGA ATRASADA" className="rounded border-2 border-[#ffc9c9] px-1 text-xs text-[#ffc9c9]">
                      (!)
                    </span>
                  )}
                </p>
                <p className="text-xs text-[#868e96]">{item.storeApp}</p>
                <p className={`mt-2 text-xs ${item.isOverdue ? 'text-[#ffc9c9]' : ''}`}>
                  {item.isOverdue
                    ? `ATRASADO ${Math.abs(item.daysLeftToWindowEnd)} DIAS (${formatPureDateShortBR(item.estimatedDeliveryDate!)} - ${formatPureDateShortBR(item.estimatedDeliveryWindowEnd)})`
                    : item.isInDeliveryWindow
                      ? `CHEGA ENTRE ${formatPureDateShortBR(item.estimatedDeliveryDate!)} - ${formatPureDateShortBR(item.estimatedDeliveryWindowEnd)}`
                      : `FALTA ${item.daysLeft} DIAS (${formatPureDateShortBR(item.estimatedDeliveryDate!)} - ${formatPureDateShortBR(item.estimatedDeliveryWindowEnd)})`}
                </p>
                <div
                  className="mt-2 h-3 w-full rounded border-2 border-[#f1f3f5]"
                  role="progressbar"
                  aria-valuenow={Math.round(item.progress * 100)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full"
                    style={{
                      width: `${item.progress * 100}%`,
                      backgroundImage:
                        'repeating-linear-gradient(45deg,#f1f3f5 0 3px,transparent 3px 6px)',
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between gap-2" onClick={(e) => e.stopPropagation()}>
                  <SketchButton
                    variant="outline"
                    className="min-h-[32px] flex-1 px-2 py-1 text-xs whitespace-nowrap"
                    onClick={() => act(() => revertToWishlistAction(item.id))}
                    title="Voltar para a aba Quero Comprar"
                  >
                    <span>←</span>
                    <span>WISHLIST</span>
                  </SketchButton>
                  <SketchButton
                    variant="filled"
                    className="min-h-[32px] shrink-0 px-3 py-1 text-xs whitespace-nowrap"
                    onClick={() => act(() => markDeliveredAction(item.id))}
                  >
                    CHEGOU!
                  </SketchButton>
                </div>
              </Card>
            ))}
          </Carousel>
        )}
      </section>

      <section className="shrink-0 space-y-3 border-t-2 border-[#f1f3f5] pt-4">
        <h2 className="text-base tracking-wider">QUERO COMPRAR (WISHLIST) ({wishlist.length})</h2>
        {wishlist.length === 0 ? (
          <EmptyState
            title="SUA WISHLIST ESTÁ VAZIA"
            description="ADICIONE PRODUTOS QUE DESEJA COMPRAR COM PREÇO ESTIMADO E LINK DIRETO."
            actionLabel="+ ADICIONAR"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <Carousel>
            {wishlist.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => setEditing(item)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setEditing(item);
                }}
                className="flex w-fit min-w-[280px] shrink-0 cursor-pointer flex-col justify-between gap-4 rounded-xl border-2 border-[#f1f3f5] bg-[#121212] p-4"
              >
                <p className="whitespace-nowrap text-lg tracking-wider">{item.name}</p>
                <p className="whitespace-nowrap text-center text-2xl tracking-wider">
                  {formatCentsToBRL(item.priceCents)}
                </p>
                <div className="flex items-center justify-between gap-4">
                  {item.productUrl ? (
                    <a
                      href={item.productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border-2 border-[#f1f3f5] px-3 py-1 text-sm hover:bg-[#f1f3f5] hover:text-[#121212]"
                    >
                      LINK ↗
                    </a>
                  ) : (
                    <span />
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBuying(item);
                    }}
                    className="inline-flex items-center gap-1 whitespace-nowrap rounded-lg border-2 border-[#f1f3f5] px-3 py-1 text-sm hover:bg-[#f1f3f5] hover:text-[#121212]"
                  >
                    COMPREI ✓
                  </button>
                </div>
              </div>
            ))}
          </Carousel>
        )}
      </section>

      <ItemModal isOpen={addOpen} item={null} today={today} onClose={() => setAddOpen(false)} />
      <ItemModal
        key={editing?.id ?? 'none'}
        isOpen={Boolean(editing)}
        item={editing}
        today={today}
        onClose={() => setEditing(null)}
      />
      <PurchaseModal item={buying} today={today} onClose={() => setBuying(null)} />
      <TransitEditModal item={editingTransit} onClose={() => setEditingTransit(null)} />

      <SketchModal isOpen={historyOpen} onClose={() => setHistoryOpen(false)} title="HISTÓRICO DE ENTREGUES">
        {delivered.length === 0 ? (
          <p className="text-xs text-[#868e96]">NENHUMA ENTREGA CONFIRMADA AINDA.</p>
        ) : (
          <ul className="space-y-2">
            {delivered.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-2 border-b border-[#f1f3f5]/20 pb-2 text-xs">
                <span>
                  {item.name} · {item.deliveredAt && formatPureDateShortBR(item.deliveredAt)}
                </span>
                <div className="flex items-center gap-2">
                  <SketchButton
                    variant="outline"
                    className="min-h-[28px] px-2 text-xs"
                    onClick={() => act(() => revertToWishlistAction(item.id))}
                    title="Voltar para a aba Quero Comprar"
                  >
                    ← WISHLIST
                  </SketchButton>
                  <SketchButton variant="outline" className="min-h-[28px] px-2 text-xs" onClick={() => act(() => revertDeliveredAction(item.id))}>
                    REVERTER
                  </SketchButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SketchModal>

      <SketchModal
        isOpen={sortModalOpen}
        onClose={() => setSortModalOpen(false)}
        title="ORGANIZAR POR PREÇO OU DATA"
        className="md:max-w-md"
      >
        <div className="space-y-4">
          <div>
            <span className="mb-2 block text-xs tracking-wider text-[#868e96] uppercase">
              ORGANIZAR POR
            </span>
            <div className="grid grid-cols-2 gap-2">
              <SketchButton
                type="button"
                variant={transitSortField === 'date' ? 'filled' : 'outline'}
                className="min-h-[38px] text-xs font-semibold"
                onClick={() => setTransitSortField('date')}
              >
                DATA DE ENTREGA
              </SketchButton>
              <SketchButton
                type="button"
                variant={transitSortField === 'price' ? 'filled' : 'outline'}
                className="min-h-[38px] text-xs font-semibold"
                onClick={() => setTransitSortField('price')}
              >
                PREÇO
              </SketchButton>
            </div>
          </div>

          <div>
            <span className="mb-2 block text-xs tracking-wider text-[#868e96] uppercase">
              ORDEM
            </span>
            <div className="grid grid-cols-2 gap-2">
              <SketchButton
                type="button"
                variant={transitSortDirection === 'asc' ? 'filled' : 'outline'}
                className="min-h-[38px] text-xs font-semibold"
                onClick={() => setTransitSortDirection('asc')}
              >
                {transitSortField === 'date' ? 'CRESCENTE ↑ (MAIS PRÓXIMA)' : 'CRESCENTE ↑ (MENOR VALOR)'}
              </SketchButton>
              <SketchButton
                type="button"
                variant={transitSortDirection === 'desc' ? 'filled' : 'outline'}
                className="min-h-[38px] text-xs font-semibold"
                onClick={() => setTransitSortDirection('desc')}
              >
                {transitSortField === 'date' ? 'DECRESCENTE ↓ (MAIS DISTANTE)' : 'DECRESCENTE ↓ (MAIOR VALOR)'}
              </SketchButton>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <SketchButton
              type="button"
              variant="filled"
              className="min-h-[36px] px-5 text-xs font-semibold"
              onClick={() => setSortModalOpen(false)}
            >
              CONCLUIR
            </SketchButton>
          </div>
        </div>
      </SketchModal>
    </div>
  );
}

function Carousel({ children, rows = 1 }: { children: React.ReactNode; rows?: 1 | 2 }) {
  return (
    <div
      className={
        rows === 2
          ? 'grid grid-flow-col grid-rows-2 auto-cols-[minmax(280px,max-content)] gap-4 overflow-x-auto pb-2'
          : 'flex gap-4 overflow-x-auto pb-2'
      }
    >
      {children}
    </div>
  );
}

function Card({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && e.key === 'Enter' && e.target === e.currentTarget) onClick();
      }}
      className={`flex min-w-[280px] shrink-0 flex-col justify-between rounded-xl border-2 border-[#f1f3f5] bg-[#1e1e1e] p-4 ${onClick ? 'cursor-pointer' : ''}`}
    >
      {children}
    </div>
  );
}

function TransitEditModal({
  item,
  onClose,
}: {
  item: InTransitView | null;
  onClose: () => void;
}) {
  if (!item) return null;
  return <TransitEditForm key={item.id} item={item} onClose={onClose} />;
}

function TransitEditForm({ item, onClose }: { item: InTransitView; onClose: () => void }) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState((item.priceCents / 100).toFixed(2).replace('.', ','));
  const [url, setUrl] = useState(item.productUrl ?? '');
  const [storeApp, setStoreApp] = useState(item.storeApp ?? '');
  const [eta, setEta] = useState(item.estimatedDeliveryDate ?? '');
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const res = await updateInTransitItemAction(item.id, {
        name,
        priceCents: parseBRLToCents(price || '0'),
        productUrl: url,
        storeApp,
        estimatedDeliveryDate: eta,
      });
      if (!res.ok) return setError(res.error ?? 'ERRO');
      onClose();
    });
  }

  return (
    <SketchModal isOpen onClose={onClose} title="EDITAR COMPRA">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="space-y-3"
      >
        <Field id="transit-name" label="NOME DO PRODUTO">
          <input id="transit-name" className={inputClass} placeholder="EX: MONITOR 144HZ" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="transit-price" label="PREÇO (R$)">
          <input id="transit-price" className={inputClass} placeholder="EX: 199,90" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </Field>
        <Field id="transit-url" label="LINK DO PRODUTO (OPCIONAL)">
          <input id="transit-url" className={inputClass} placeholder="HTTPS://..." value={url} onChange={(e) => setUrl(e.target.value)} />
        </Field>
        <Field id="transit-store" label="APP QUE COMPREI">
          <input id="transit-store" className={inputClass} placeholder="MERCADO LIVRE, ALIEXPRESS, SHOPEE..." value={storeApp} onChange={(e) => setStoreApp(e.target.value)} />
        </Field>
        <Field id="transit-eta" label="DATA ESTIMADA DE CHEGADA">
          <input id="transit-eta" type="date" className={inputClass} value={eta} onChange={(e) => setEta(e.target.value)} />
        </Field>
        {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}
        <div className="flex justify-end gap-2">
          <SketchButton type="button" variant="ghost" onClick={onClose}>
            CANCELAR
          </SketchButton>
          <SketchButton type="submit" variant="filled" disabled={pending}>
            SALVAR
          </SketchButton>
        </div>
      </form>
    </SketchModal>
  );
}

type AddTarget = 'WISHLIST' | 'PURCHASED';

function ItemModal({
  isOpen,
  item,
  today,
  onClose,
}: {
  isOpen: boolean;
  item: ShoppingItemRecord | null;
  today: string;
  onClose: () => void;
}) {
  const [target, setTarget] = useState<AddTarget>('WISHLIST');
  const [step, setStep] = useState<Step>('DETAILS');
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(
    item ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const [url, setUrl] = useState(item?.productUrl ?? '');
  const [storeApp, setStoreApp] = useState('');
  const [eta, setEta] = useState('');
  const [mode, setMode] = useState<'CASH' | 'INSTALLMENTS'>('CASH');
  const [installments, setInstallments] = useState('2');
  const [startMonth, setStartMonth] = useState(today.slice(0, 7));
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const isPurchasedMode = !item && target === 'PURCHASED';

  let parsedPriceCents = 0;
  try {
    parsedPriceCents = price.trim() ? parseBRLToCents(price) : 0;
  } catch {
    parsedPriceCents = 0;
  }

  function resetAndClose() {
    if (!item) {
      setTarget('WISHLIST');
      setStep('DETAILS');
      setName('');
      setPrice('');
      setUrl('');
      setStoreApp('');
      setEta('');
      setMode('CASH');
      setInstallments('2');
      setStartMonth(today.slice(0, 7));
    }
    setError('');
    onClose();
  }

  function submitWishlist() {
    startTransition(async () => {
      let priceCents: number;
      try {
        priceCents = parseBRLToCents(price || '0');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'PREÇO INVÁLIDO');
        return;
      }
      const input = { name, priceCents, productUrl: url };
      const res = item
        ? await updateWishlistItemAction(item.id, input)
        : await addWishlistItemAction(input);
      if (!res.ok) return setError(res.error ?? 'ERRO');
      resetAndClose();
    });
  }

  function submitPurchased(alreadyLoggedInFinances: boolean) {
    startTransition(async () => {
      const res = await addPurchasedItemAction({
        name,
        priceCents: parsedPriceCents,
        productUrl: url,
        storeApp,
        estimatedDeliveryDate: eta,
        purchasedAt: today,
        alreadyLoggedInFinances,
        payment: alreadyLoggedInFinances
          ? undefined
          : mode === 'CASH'
            ? { mode: 'CASH' }
            : { mode: 'INSTALLMENTS', totalInstallments: Number(installments), startMonth },
      });
      if (!res.ok) return setError(res.error ?? 'ERRO');
      resetAndClose();
    });
  }

  function remove() {
    if (!item) return;
    startTransition(async () => {
      await deleteItemAction(item.id);
      setConfirmDelete(false);
      onClose();
    });
  }

  const modalTitle = item
    ? 'EDITAR ITEM'
    : isPurchasedMode
      ? 'ADICIONAR COMPRA (A CAMINHO)'
      : 'ADICIONAR À WISHLIST';

  return (
    <>
      <SketchModal isOpen={isOpen} onClose={resetAndClose} title={modalTitle}>
        <div className="space-y-3">
          {!item && step === 'DETAILS' && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTarget('WISHLIST');
                  setError('');
                }}
                className={`min-h-[34px] flex-1 rounded-md border-2 px-3 py-1 text-xs tracking-wider transition-colors ${
                  target === 'WISHLIST'
                    ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212] font-bold'
                    : 'border-[#f1f3f5]/50 bg-[#121212] text-[#f1f3f5] hover:border-[#f1f3f5]'
                }`}
              >
                WISHLIST
              </button>
              <button
                type="button"
                onClick={() => {
                  setTarget('PURCHASED');
                  setError('');
                }}
                className={`min-h-[34px] flex-1 rounded-md border-2 px-3 py-1 text-xs tracking-wider transition-colors ${
                  target === 'PURCHASED'
                    ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212] font-bold'
                    : 'border-[#f1f3f5]/50 bg-[#121212] text-[#f1f3f5] hover:border-[#f1f3f5]'
                }`}
              >
                JÁ COMPREI
              </button>
            </div>
          )}

          {step === 'DETAILS' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (isPurchasedMode) {
                  if (!name.trim() || parsedPriceCents <= 0 || !eta || !storeApp.trim()) {
                    setError('PREENCHA NOME, PREÇO, DATA DE CHEGADA E APP DA COMPRA.');
                    return;
                  }
                  setError('');
                  setStep('FINANCE_QUESTION');
                } else {
                  submitWishlist();
                }
              }}
              className="space-y-3"
            >
              <Field id="item-name" label="NOME DO PRODUTO">
                <input
                  id="item-name"
                  className={inputClass}
                  placeholder="EX: MONITOR 144HZ"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <Field id="item-price" label="PREÇO (R$)">
                <input
                  id="item-price"
                  className={inputClass}
                  placeholder="EX: 199,90"
                  inputMode="decimal"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </Field>
              <Field id="item-url" label="LINK DO PRODUTO (OPCIONAL)">
                <input
                  id="item-url"
                  className={inputClass}
                  placeholder="HTTPS://..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                />
              </Field>

              {isPurchasedMode && (
                <>
                  <Field id="item-eta" label="DATA ESTIMADA DE CHEGADA">
                    <input
                      id="item-eta"
                      type="date"
                      className={inputClass}
                      value={eta}
                      onChange={(e) => setEta(e.target.value)}
                    />
                  </Field>
                  <Field id="item-store" label="APP QUE COMPREI">
                    <input
                      id="item-store"
                      className={inputClass}
                      placeholder="MERCADO LIVRE, ALIEXPRESS, SHOPEE..."
                      value={storeApp}
                      onChange={(e) => setStoreApp(e.target.value)}
                    />
                  </Field>
                </>
              )}

              {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}

              <div className="flex items-center justify-between">
                {item ? (
                  <SketchButton
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => setConfirmDelete(true)}
                    className="text-[#ffc9c9] hover:bg-[#ffc9c9]/10"
                  >
                    EXCLUIR
                  </SketchButton>
                ) : (
                  <span />
                )}
                <SketchButton type="submit" variant="filled" disabled={pending}>
                  {isPurchasedMode ? 'CONTINUAR' : 'SALVAR'}
                </SketchButton>
              </div>
            </form>
          )}

          {isPurchasedMode && step === 'FINANCE_QUESTION' && (
            <>
              <p className="text-sm">VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS?</p>
              <div className="flex gap-2">
                <SketchButton variant="filled" disabled={pending} onClick={() => submitPurchased(true)}>
                  SIM
                </SketchButton>
                <SketchButton variant="outline" disabled={pending} onClick={() => setStep('PAYMENT')}>
                  NÃO
                </SketchButton>
              </div>
              {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}
            </>
          )}

          {isPurchasedMode && step === 'PAYMENT' && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitPurchased(false);
              }}
              className="space-y-3"
            >
              <p className="text-sm">FORMA DE PAGAMENTO ({formatCentsToBRL(parsedPriceCents)})</p>
              <div className="flex gap-2">
                <SketchButton
                  type="button"
                  variant={mode === 'CASH' ? 'filled' : 'outline'}
                  onClick={() => setMode('CASH')}
                >
                  À VISTA
                </SketchButton>
                <SketchButton
                  type="button"
                  variant={mode === 'INSTALLMENTS' ? 'filled' : 'outline'}
                  onClick={() => setMode('INSTALLMENTS')}
                >
                  PARCELADO
                </SketchButton>
              </div>
              {mode === 'INSTALLMENTS' && (
                <div className="grid grid-cols-2 gap-2">
                  <Field id="item-installments" label="Nº DE PARCELAS">
                    <input
                      id="item-installments"
                      type="number"
                      min={1}
                      className={inputClass}
                      value={installments}
                      onChange={(e) => setInstallments(e.target.value)}
                    />
                  </Field>
                  <Field id="item-start-month" label="MÊS DA 1ª PARCELA">
                    <input
                      id="item-start-month"
                      type="month"
                      className={inputClass}
                      value={startMonth}
                      onChange={(e) => setStartMonth(e.target.value)}
                    />
                  </Field>
                </div>
              )}
              {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}
              <SketchButton type="submit" variant="filled" disabled={pending}>
                CONFIRMAR
              </SketchButton>
            </form>
          )}
        </div>
      </SketchModal>

      {item && (
        <ConfirmDeleteModal
          isOpen={confirmDelete}
          onClose={() => setConfirmDelete(false)}
          onConfirm={remove}
          itemDescription={`"${item.name}" DA WISHLIST`}
          pending={pending}
        />
      )}
    </>
  );
}

type Step = 'DETAILS' | 'FINANCE_QUESTION' | 'PAYMENT';

function PurchaseModal({
  item,
  today,
  onClose,
}: {
  item: ShoppingItemRecord | null;
  today: string;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>('DETAILS');
  const [storeApp, setStoreApp] = useState('');
  const [eta, setEta] = useState('');
  const [mode, setMode] = useState<'CASH' | 'INSTALLMENTS'>('CASH');
  const [installments, setInstallments] = useState('2');
  const [startMonth, setStartMonth] = useState(today.slice(0, 7));
  const [error, setError] = useState('');
  const [pending, startTransition] = useTransition();

  if (!item) return null;

  function close() {
    setStep('DETAILS');
    setError('');
    onClose();
  }

  function submit(alreadyLoggedInFinances: boolean) {
    startTransition(async () => {
      const res = await markPurchasedAction(item!.id, {
        storeApp,
        estimatedDeliveryDate: eta,
        purchasedAt: today,
        alreadyLoggedInFinances,
        payment: alreadyLoggedInFinances
          ? undefined
          : mode === 'CASH'
            ? { mode: 'CASH' }
            : { mode: 'INSTALLMENTS', totalInstallments: Number(installments), startMonth },
      });
      if (!res.ok) return setError(res.error ?? 'ERRO');
      close();
    });
  }

  return (
    <SketchModal isOpen onClose={close} title={`COMPREI: ${item.name}`}>
      <div className="space-y-3">
        {step === 'DETAILS' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (eta && storeApp.trim()) {
                setStep('FINANCE_QUESTION');
              }
            }}
            className="space-y-3"
          >
            <Field id="purchase-eta" label="DATA ESTIMADA DE CHEGADA">
              <input id="purchase-eta" type="date" className={inputClass} value={eta} onChange={(e) => setEta(e.target.value)} />
            </Field>
            <Field id="purchase-store" label="APP QUE COMPREI">
              <input id="purchase-store" className={inputClass} placeholder="MERCADO LIVRE, ALIEXPRESS, SHOPEE..." value={storeApp} onChange={(e) => setStoreApp(e.target.value)} />
            </Field>
            <SketchButton type="submit" variant="filled" disabled={!eta || !storeApp.trim()}>
              CONTINUAR
            </SketchButton>
          </form>
        )}

        {step === 'FINANCE_QUESTION' && (
          <>
            <p className="text-sm">VOCÊ JÁ LANÇOU ESSE GASTO EM FINANÇAS?</p>
            <div className="flex gap-2">
              <SketchButton variant="filled" disabled={pending} onClick={() => submit(true)}>
                SIM
              </SketchButton>
              <SketchButton variant="outline" disabled={pending} onClick={() => setStep('PAYMENT')}>
                NÃO
              </SketchButton>
            </div>
          </>
        )}

        {step === 'PAYMENT' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(false);
            }}
            className="space-y-3"
          >
            <p className="text-sm">FORMA DE PAGAMENTO ({formatCentsToBRL(item.priceCents)})</p>
            <div className="flex gap-2">
              <SketchButton type="button" variant={mode === 'CASH' ? 'filled' : 'outline'} onClick={() => setMode('CASH')}>
                À VISTA
              </SketchButton>
              <SketchButton type="button" variant={mode === 'INSTALLMENTS' ? 'filled' : 'outline'} onClick={() => setMode('INSTALLMENTS')}>
                PARCELADO
              </SketchButton>
            </div>
            {mode === 'INSTALLMENTS' && (
              <div className="grid grid-cols-2 gap-2">
                <Field id="purchase-installments" label="Nº DE PARCELAS">
                  <input id="purchase-installments" type="number" min={1} className={inputClass} value={installments} onChange={(e) => setInstallments(e.target.value)} />
                </Field>
                <Field id="purchase-start-month" label="MÊS DA 1ª PARCELA">
                  <input id="purchase-start-month" type="month" className={inputClass} value={startMonth} onChange={(e) => setStartMonth(e.target.value)} />
                </Field>
              </div>
            )}
            <SketchButton type="submit" variant="filled" disabled={pending}>
              CONFIRMAR
            </SketchButton>
          </form>
        )}
        {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}
      </div>
    </SketchModal>
  );
}
