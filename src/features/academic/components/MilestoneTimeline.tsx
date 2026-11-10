'use client';

import { useState, useTransition } from 'react';
import { SketchButton } from '@/components/sketch/SketchButton';
import { formatPureDateShortBR } from '@/lib/dates';
import { cn } from '@/lib/utils';
import type { ProjectMilestoneView } from '../service';
import {
  addMilestoneAction,
  deleteMilestoneAction,
  toggleMilestoneAction,
} from '../actions';

export interface MilestoneTimelineProps {
  projectId: string;
  milestones: ProjectMilestoneView[];
}

export function MilestoneTimeline({ projectId, milestones }: MilestoneTimelineProps) {
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [error, setError] = useState<string | null>(null);

  function handleToggle(id: string) {
    startTransition(async () => {
      await toggleMilestoneAction(id);
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteMilestoneAction(id);
    });
  }

  async function handleAdd() {
    if (!title.trim() || !dueDate.trim()) {
      setError('PREENCHA O TÍTULO E A DATA DO MARCO.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addMilestoneAction(projectId, {
        title,
        dueDate,
        sortOrder: milestones.length + 1,
      });
      if (!res.ok) {
        setError(res.error ?? 'ERRO AO ADICIONAR MARCO');
      } else {
        setTitle('');
        setDueDate('');
        setAdding(false);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold tracking-wider text-[#f1f3f5]">
          MARCOS IMPORTANTES ({milestones.filter((m) => m.isCompleted).length}/{milestones.length})
        </h4>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="text-[10px] text-[#f1f3f5] underline hover:opacity-80"
        >
          {adding ? 'FECHAR' : '+ NOVO MARCO'}
        </button>
      </div>

      {adding && (
        <div className="rounded-md border border-[#f1f3f5] p-3 space-y-2 bg-[#121212]">
          <input
            placeholder="TÍTULO DO MARCO (EX: ENTREGA DO RELATÓRIO)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-[#f1f3f5] bg-[#121212] px-2.5 py-1 text-xs text-[#f1f3f5] focus:outline-none"
          />
          <div className="flex gap-2">
            <input
              type="date"
              aria-label="DATA DO MARCO"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="flex-1 rounded border border-[#f1f3f5] bg-[#121212] px-2.5 py-1 text-xs text-[#f1f3f5] focus:outline-none"
            />
            <SketchButton
              variant="filled"
              className="min-h-[30px] h-7 px-3 text-[10px]"
              disabled={pending}
              onClick={handleAdd}
            >
              SALVAR
            </SketchButton>
          </div>
          {error && <p className="text-[10px] text-[#868e96]">{error}</p>}
        </div>
      )}

      {milestones.length === 0 ? (
        <p className="text-xs text-[#868e96]">NENHUM MARCO CADASTRADO PARA ESTE PROJETO.</p>
      ) : (
        <ul className="relative space-y-2 border-l-2 border-[#f1f3f5]/40 pl-4 ml-2">
          {milestones.map((m) => (
            <li
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-md border border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs"
            >
              <div className="flex-1 min-w-0">
                <p className={cn('font-medium truncate', m.isCompleted && 'line-through text-[#868e96]')}>
                  {m.title}
                </p>
                <p className="text-[10px] text-[#868e96]">
                  ATÉ {formatPureDateShortBR(m.dueDate)} ({m.dueDate})
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => handleToggle(m.id)}
                  aria-label={m.isCompleted ? 'MARCAR COMO PENDENTE' : 'MARCAR COMO CONCLUÍDO'}
                  className={cn(
                    'inline-flex min-h-[26px] items-center justify-center rounded border px-2 py-0.5 text-[10px] font-bold tracking-wider transition-all',
                    m.isCompleted
                      ? 'border-[#f1f3f5] bg-[#f1f3f5] text-[#121212]'
                      : 'border-[#f1f3f5] bg-transparent text-[#f1f3f5] hover:bg-[#1e1e1e]',
                  )}
                >
                  {m.isCompleted ? '[OK]' : '[  ]'}
                </button>

                <button
                  type="button"
                  aria-label="EXCLUIR MARCO"
                  disabled={pending}
                  onClick={() => handleDelete(m.id)}
                  className="text-[#868e96] hover:text-[#f1f3f5] text-xs px-1"
                >
                  X
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
