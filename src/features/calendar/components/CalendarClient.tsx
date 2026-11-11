'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchButton } from '@/components/sketch/SketchButton';
import { SketchCard } from '@/components/sketch/SketchCard';
import { toRecifeDateString } from '@/lib/dates';
import { listCalendarItemsAction } from '../actions';
import type { CalendarItem } from '../logic';
import type { CalendarEventRecord } from '../service';
import {
  CALENDAR_VIEWS,
  VIEW_LABEL,
  eachDay,
  fetchRange,
  monthGridRange,
  navigate,
  parsePure,
  titleFor,
  viewRange,
  type CalendarView,
} from '../views';
import { AgendaView, MiniMonth, MonthView, TimeGridView, YearView } from './CalendarViews';
import { EventFormModal } from './EventFormModal';

export interface CalendarClientProps {
  today: string;
  initialItems: CalendarItem[];
  events: CalendarEventRecord[];
}

export function CalendarClient({ today, initialItems, events }: CalendarClientProps) {
  const router = useRouter();
  const [view, setView] = useState<CalendarView>('WEEK');
  const [date, setDate] = useState(today);
  const [items, setItems] = useState(initialItems);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEventRecord | null>(null);
  const [todayOpen, setTodayOpen] = useState(false);
  const first = useRef(true);

  const reload = useCallback(async () => {
    const r = fetchRange(view, date, today);
    setItems(await listCalendarItemsAction(r.from, r.to));
  }, [view, date, today]);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void reload();
  }, [reload]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const onItemClick = (item: CalendarItem) => {
    if (item.eventId) {
      const ev = events.find((e) => e.id === item.eventId);
      if (ev) {
        setEditing(ev);
        setFormOpen(true);
      }
    } else if (item.href) {
      router.push(item.href);
    }
  };

  const goDay = (d: string) => {
    setDate(d);
    setView('DAY');
  };

  const range = viewRange(view, date);
  const mini = monthGridRange(date);
  const month = parsePure(date).getMonth();
  const viewItems = items.filter((i) => i.date >= range.from && i.date <= range.to);
  const todayItems = items.filter((i) => i.date === today);
  const common = { items: viewItems, today, onItemClick, onDayClick: goDay };

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="VISÃO"
        value={view}
        onChange={(e) => setView(e.target.value as CalendarView)}
        className="min-h-[44px] rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-2 text-sm uppercase text-[#f1f3f5]"
      >
        {CALENDAR_VIEWS.map((v) => (
          <option key={v} value={v}>
            {VIEW_LABEL[v]}
          </option>
        ))}
      </select>
      <SketchButton aria-label="ANTERIOR" onClick={() => setDate(navigate(view, date, -1))}>
        &lt;
      </SketchButton>
      <SketchButton onClick={() => setDate(toRecifeDateString())}>HOJE</SketchButton>
      <SketchButton aria-label="PRÓXIMO" onClick={() => setDate(navigate(view, date, 1))}>
        &gt;
      </SketchButton>
    </div>
  );

  const todayList =
    todayItems.length === 0 ? (
      <EmptyState title="DIA LIVRE HOJE" description="NENHUM COMPROMISSO PARA A DATA ATUAL EM AMERICA/RECIFE." />
    ) : (
      <ul className="space-y-1">
        {todayItems.map((i) => (
          <li key={i.key}>
            <button
              type="button"
              onClick={() => onItemClick(i)}
              style={{ borderLeftColor: i.color }}
              className="w-full border-l-4 pl-2 text-left text-xs uppercase"
            >
              <span className="text-[#868e96]">{i.startTime ? `${i.startTime}–${i.endTime}` : 'DIA TODO'}</span> {i.title}
            </button>
          </li>
        ))}
      </ul>
    );

  return (
    <div className="flex flex-1 flex-col p-4 md:p-6">
      <PageHeader
        moduleId="calendar"
        subtitle="AGENDA PRÓPRIA E PROJEÇÃO UNIFICADA (ACADÊMICO, FINANÇAS E COMPRAS)"
        onAddClick={openNew}
        extraControls={controls}
      />

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-4">
        <section className="flex flex-col lg:col-span-3">
          <SketchCard className="flex flex-1 flex-col space-y-3">
            <h2 className="text-base tracking-wider">{titleFor(view, date)}</h2>
            {view === 'DAY' && <TimeGridView {...common} days={[date]} />}
            {view === 'WEEK' && <TimeGridView {...common} days={eachDay(range)} />}
            {view === 'MONTH' && <MonthView {...common} range={range} month={month} />}
            {view === 'YEAR' && <YearView year={parsePure(date).getFullYear()} items={viewItems} today={today} onDayClick={goDay} />}
            {view === 'AGENDA' && <AgendaView items={viewItems} today={today} onItemClick={onItemClick} />}
          </SketchCard>
        </section>

        <aside className="flex flex-col gap-4">
          <SketchCard className="space-y-2">
            <h2 className="border-b border-[#f1f3f5] pb-2 text-sm tracking-wider">{titleFor('MONTH', date)}</h2>
            <MiniMonth range={mini} month={month} items={items} today={today} selected={date} onDayClick={setDate} />
          </SketchCard>
          <SketchCard className="space-y-3">
            <button
              type="button"
              aria-expanded={todayOpen}
              onClick={() => setTodayOpen((o) => !o)}
              className="flex w-full items-center justify-between border-b border-[#f1f3f5] pb-2 text-sm tracking-wider lg:cursor-default"
            >
              <span>AGENDAS DE HOJE ({todayItems.length})</span>
              <span className="lg:hidden">{todayOpen ? '−' : '+'}</span>
            </button>
            <div className={todayOpen ? 'block' : 'hidden lg:block'}>{todayList}</div>
          </SketchCard>
        </aside>
      </div>

      <EventFormModal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        event={editing}
        defaultDate={date}
        items={items}
        onSaved={() => {
          void reload();
          router.refresh();
        }}
      />
    </div>
  );
}
