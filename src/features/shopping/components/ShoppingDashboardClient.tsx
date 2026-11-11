'use client';

import { useState, useTransition } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { formatCentsToBRL, parseBRLToCents } from '@/lib/currency';
import { formatPureDateShortBR } from '@/lib/dates';
import {
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
  const [, startTransition] = useTransition();

  const act = (fn: () => Promise<unknown>) => startTransition(async () => void (await fn()));

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 md:h-full md:min-h-0 md:overflow-hidden md:p-6">
      <PageHeader
        moduleId="shopping"
        subtitle="QUERO COMPRAR (WISHLIST) E JÁ COMPREI (A CAMINHO)"
        onAddClick={() => setAddOpen(true)}
      />

      <section className="min-h-0 space-y-3">
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

      <section className="min-h-0 space-y-3 border-t-2 border-[#f1f3f5] pt-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base tracking-wider">JÁ COMPREI (A CAMINHO) ({inTransit.length})</h2>
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
          <Carousel>
            {inTransit.map((item) => (
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
                    ? `ATRASADO ${Math.abs(item.daysLeft)} DIAS`
                    : `FALTA ${item.daysLeft} DIAS`}{' '}
                  ({formatPureDateShortBR(item.estimatedDeliveryDate!)})
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

      <ItemModal isOpen={addOpen} item={null} onClose={() => setAddOpen(false)} />
      <ItemModal
        key={editing?.id ?? 'none'}
        isOpen={Boolean(editing)}
        item={editing}
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
    </div>
  );
}

function Carousel({ children }: { children: React.ReactNode }) {
  return <div className="flex gap-4 overflow-x-auto pb-2">{children}</div>;
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
      className={`flex w-fit min-w-[280px] shrink-0 flex-col justify-between rounded-xl border-2 border-[#f1f3f5] bg-[#1e1e1e] p-4 ${onClick ? 'cursor-pointer' : ''}`}
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
        <input className={inputClass} placeholder="NOME DO PRODUTO" value={name} onChange={(e) => setName(e.target.value)} />
        <input className={inputClass} placeholder="PREÇO (R$)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        <input className={inputClass} placeholder="LINK DO PRODUTO" value={url} onChange={(e) => setUrl(e.target.value)} />
        <input className={inputClass} placeholder="APP DA COMPRA" value={storeApp} onChange={(e) => setStoreApp(e.target.value)} />
        <label className="block text-xs">DATA ESTIMADA DE CHEGADA</label>
        <input type="date" className={inputClass} value={eta} onChange={(e) => setEta(e.target.value)} />
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

function ItemModal({
  isOpen,
  item,
  onClose,
}: {
  isOpen: boolean;
  item: ShoppingItemRecord | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? '');
  const [price, setPrice] = useState(
    item ? (item.priceCents / 100).toFixed(2).replace('.', ',') : '',
  );
  const [url, setUrl] = useState(item?.productUrl ?? '');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const input = { name, priceCents: parseBRLToCents(price || '0'), productUrl: url };
      const res = item
        ? await updateWishlistItemAction(item.id, input)
        : await addWishlistItemAction(input);
      if (!res.ok) return setError(res.error ?? 'ERRO');
      if (!item) {
        setName('');
        setPrice('');
        setUrl('');
      }
      setError('');
      onClose();
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

  return (
    <>
      <SketchModal isOpen={isOpen} onClose={onClose} title={item ? 'EDITAR ITEM' : 'ADICIONAR À WISHLIST'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <input className={inputClass} placeholder="NOME DO PRODUTO" value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputClass} placeholder="PREÇO (R$)" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
          <input className={inputClass} placeholder="LINK DO PRODUTO" value={url} onChange={(e) => setUrl(e.target.value)} />
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
              SALVAR
            </SketchButton>
          </div>
        </form>
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
            <label className="block text-xs">DATA ESTIMADA DE CHEGADA</label>
            <input type="date" className={inputClass} value={eta} onChange={(e) => setEta(e.target.value)} />
            <label className="block text-xs">APP QUE COMPREI</label>
            <input className={inputClass} placeholder="MERCADO LIVRE, ALIEXPRESS, SHOPEE..." value={storeApp} onChange={(e) => setStoreApp(e.target.value)} />
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
                <input type="number" min={1} className={inputClass} value={installments} onChange={(e) => setInstallments(e.target.value)} aria-label="Nº DE PARCELAS" />
                <input type="month" className={inputClass} value={startMonth} onChange={(e) => setStartMonth(e.target.value)} aria-label="MÊS DA 1ª PARCELA" />
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
