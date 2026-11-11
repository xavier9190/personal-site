'use client';

import { useState, useTransition } from 'react';
import { ConfirmDeleteModal } from '@/components/sketch/ConfirmDeleteModal';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchModal } from '@/components/sketch/SketchModal';
import { cn } from '@/lib/utils';
import { createEventAction, deleteEventAction, updateEventAction } from '../actions';
import {
  COLOR_HEX,
  EVENT_COLORS,
  RECURRENCES,
  RECURRENCE_LABEL,
  timesOverlap,
  type CalendarItem,
  type EventColor,
  type Recurrence,
} from '../logic';
import type { CalendarEventRecord } from '../service';

const inputClass =
  'w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-sm uppercase text-[#f1f3f5]';

export interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Evento sendo editado; `null` para criar. */
  event: CalendarEventRecord | null;
  defaultDate: string;
  /** Itens conhecidos, usados para avisar conflitos de horário. */
  items: CalendarItem[];
  onSaved: () => void;
}

export function EventFormModal(props: EventFormModalProps) {
  if (!props.isOpen) return null;
  // key remonta o formulário a cada abertura/evento, reiniciando o estado.
  return <EventForm key={props.event?.id ?? `new-${props.defaultDate}`} {...props} />;
}

function EventForm({ onClose, event, defaultDate, items, onSaved }: EventFormModalProps) {
  const [title, setTitle] = useState(event?.title ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [date, setDate] = useState(event ? event.startAt.slice(0, 10) : defaultDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startTime, setStartTime] = useState(event ? event.startAt.slice(11, 16) : '09:00');
  const [endTime, setEndTime] = useState(event ? event.endAt.slice(11, 16) : '10:00');
  const [color, setColor] = useState<EventColor>(event?.color ?? 'green');
  const [recurrence, setRecurrence] = useState<Recurrence>(event?.recurrenceRule ?? 'NONE');
  const [until, setUntil] = useState(event?.recurrenceUntil ?? '');
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const conflicts = allDay
    ? []
    : items.filter(
        (i) =>
          !i.allDay &&
          i.date === date &&
          i.eventId !== event?.id &&
          i.startTime &&
          i.endTime &&
          endTime > startTime &&
          timesOverlap(startTime, endTime, i.startTime, i.endTime),
      );

  const submit = () => {
    setError(null);
    const payload = {
      title,
      description: description || null,
      date,
      allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      color,
      recurrence,
      recurrenceUntil: recurrence === 'NONE' || !until ? null : until,
    };
    startTransition(async () => {
      const res = event ? await updateEventAction(event.id, payload) : await createEventAction(payload);
      if (!res.ok) return setError(res.error ?? 'ERRO AO SALVAR');
      onSaved();
      onClose();
    });
  };

  const remove = () => {
    if (!event) return;
    startTransition(async () => {
      const res = await deleteEventAction(event.id);
      if (!res.ok) return setError(res.error ?? 'ERRO AO EXCLUIR');
      setConfirmDelete(false);
      onSaved();
      onClose();
    });
  };

  return (
    <>
      <SketchModal isOpen onClose={onClose} title={event ? 'EDITAR EVENTO' : 'NOVO EVENTO'}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="space-y-3"
        >
          <input
            className={inputClass}
            placeholder="TÍTULO"
            aria-label="TÍTULO"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />
          <div className="grid grid-cols-2 gap-3">
            <input type="date" className={inputClass} aria-label="DATA" value={date} onChange={(e) => setDate(e.target.value)} />
            <label className="flex items-center gap-2 text-xs uppercase">
              <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
              DIA INTEIRO
            </label>
          </div>
          {!allDay && (
            <div className="grid grid-cols-2 gap-3">
              <input type="time" className={inputClass} aria-label="INÍCIO" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
              <input type="time" className={inputClass} aria-label="FIM" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          )}
          <div className="flex items-center gap-2" role="radiogroup" aria-label="COR">
            {EVENT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c.toUpperCase()}
                onClick={() => setColor(c)}
                style={{ backgroundColor: COLOR_HEX[c] }}
                className={cn('h-8 w-8 rounded-md border-2', color === c ? 'border-[#f1f3f5] ring-2 ring-[#f1f3f5]' : 'border-transparent')}
              />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select className={inputClass} aria-label="REPETIÇÃO" value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
              {RECURRENCES.map((r) => (
                <option key={r} value={r}>
                  {RECURRENCE_LABEL[r]}
                </option>
              ))}
            </select>
            {recurrence !== 'NONE' && (
              <input type="date" className={inputClass} aria-label="REPETIR ATÉ" value={until} onChange={(e) => setUntil(e.target.value)} />
            )}
          </div>
          <input
            className={inputClass}
            placeholder="DESCRIÇÃO (OPCIONAL)"
            aria-label="DESCRIÇÃO"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          {conflicts.length > 0 && (
            <p className="text-xs text-[#ffec99]">
              ! CONFLITO DE HORÁRIO COM: {conflicts.map((c) => c.title).join(', ')}
            </p>
          )}
          {error && <p className="text-xs text-[#ffc9c9]">{error}</p>}
          <div className="flex items-center justify-between gap-3 pt-1">
            {event ? (
              <SketchButton type="button" variant="outline" disabled={pending} onClick={() => setConfirmDelete(true)}>
                EXCLUIR
              </SketchButton>
            ) : (
              <span />
            )}
            <div className="flex gap-3">
              <SketchButton type="button" variant="outline" disabled={pending} onClick={onClose}>
                CANCELAR
              </SketchButton>
              <SketchButton type="submit" variant="filled" disabled={pending}>
                {pending ? 'SALVANDO...' : 'SALVAR'}
              </SketchButton>
            </div>
          </div>
        </form>
      </SketchModal>
      <ConfirmDeleteModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
        itemDescription={event?.title}
        pending={pending}
      />
    </>
  );
}
