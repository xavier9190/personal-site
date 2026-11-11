'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { layoutDay, type CalendarItem } from '../logic';
import { WEEKDAYS_SHORT, eachDay, monthName, parsePure, type DateRange } from '../views';

const HOUR_PX = 48;

export interface ViewProps {
  items: CalendarItem[];
  today: string;
  onItemClick: (item: CalendarItem) => void;
  onDayClick: (date: string) => void;
}

const dayNum = (d: string) => Number(d.slice(8, 10));

function ItemChip({ item, onItemClick, className }: { item: CalendarItem; onItemClick: ViewProps['onItemClick']; className?: string }) {
  return (
    <button
      type="button"
      onClick={() => onItemClick(item)}
      style={{ backgroundColor: item.color }}
      className={cn(
        'block w-full truncate rounded border border-[#121212] px-1 text-left text-[10px] uppercase text-[#121212]',
        item.done && 'line-through opacity-60',
        className,
      )}
      title={item.title}
    >
      {item.startTime ? `${item.startTime} ` : ''}
      {item.title}
    </button>
  );
}

export function TimeGridView({ days, items, today, onItemClick, onDayClick }: ViewProps & { days: string[] }) {
  const scroller = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scroller.current) scroller.current.scrollTop = 7 * HOUR_PX;
  }, []);
  const cols = { gridTemplateColumns: `3rem repeat(${days.length}, minmax(0, 1fr))` };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid border-b-2 border-[#f1f3f5]" style={cols}>
        <div />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onDayClick(d)}
            className={cn('p-1 text-center text-xs uppercase', d === today && 'bg-[#f1f3f5] text-[#121212]')}
          >
            {WEEKDAYS_SHORT[parsePure(d).getDay()]} {dayNum(d)}
          </button>
        ))}
      </div>
      <div className="grid border-b border-[#868e96]" style={cols}>
        <div className="p-1 text-[9px] text-[#868e96]">DIA TODO</div>
        {days.map((d) => (
          <div key={d} className="min-h-6 space-y-0.5 border-l border-[#343a40] p-0.5">
            {items
              .filter((i) => i.date === d && i.allDay)
              .map((i) => (
                <ItemChip key={i.key} item={i} onItemClick={onItemClick} />
              ))}
          </div>
        ))}
      </div>
      <div ref={scroller} className="max-h-[60vh] min-h-0 flex-1 overflow-y-auto" data-testid="time-grid">
        <div className="grid" style={{ ...cols, height: 24 * HOUR_PX }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} className="absolute right-1 text-[9px] text-[#868e96]" style={{ top: h * HOUR_PX }}>
                {String(h).padStart(2, '0')}:00
              </div>
            ))}
          </div>
          {days.map((d) => (
            <div key={d} className="relative border-l border-[#343a40]">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="absolute inset-x-0 border-t border-[#343a40]" style={{ top: h * HOUR_PX }} />
              ))}
              {layoutDay(items.filter((i) => i.date === d)).map((l) => (
                <div
                  key={l.item.key}
                  className="absolute px-px"
                  style={{
                    top: (l.startMinute / 60) * HOUR_PX,
                    height: Math.max(((l.endMinute - l.startMinute) / 60) * HOUR_PX, 18),
                    left: `${(l.column / l.columns) * 100}%`,
                    width: `${100 / l.columns}%`,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => onItemClick(l.item)}
                    style={{ backgroundColor: l.item.color }}
                    className="h-full w-full overflow-hidden rounded border border-[#121212] p-0.5 text-left text-[10px] uppercase leading-tight text-[#121212]"
                  >
                    {l.item.startTime}–{l.item.endTime} {l.item.title}
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MonthView({ range, month, items, today, onItemClick, onDayClick }: ViewProps & { range: DateRange; month: number }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="grid grid-cols-7 border-b-2 border-[#f1f3f5] text-center text-xs">
        {WEEKDAYS_SHORT.map((w) => (
          <div key={w} className="p-1">
            {w}
          </div>
        ))}
      </div>
      <div className="grid flex-1 grid-cols-7">
        {eachDay(range).map((d) => {
          const dayItems = items.filter((i) => i.date === d);
          return (
            <div
              key={d}
              className={cn(
                'min-h-20 border border-[#343a40] p-0.5',
                parsePure(d).getMonth() !== month && 'opacity-40',
              )}
            >
              <button
                type="button"
                onClick={() => onDayClick(d)}
                className={cn('mb-0.5 px-1 text-xs', d === today && 'bg-[#f1f3f5] text-[#121212]')}
              >
                {dayNum(d)}
              </button>
              <div className="space-y-0.5">
                {dayItems.slice(0, 3).map((i) => (
                  <ItemChip key={i.key} item={i} onItemClick={onItemClick} />
                ))}
                {dayItems.length > 3 && <p className="text-[9px] text-[#868e96]">+{dayItems.length - 3} MAIS</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function MiniMonth({ range, month, items, today, selected, onDayClick }: {
  range: DateRange;
  month: number;
  items: CalendarItem[];
  today: string;
  selected: string;
  onDayClick: (d: string) => void;
}) {
  const marked = new Set(items.map((i) => i.date));
  return (
    <div className="grid grid-cols-7 gap-px text-center text-[10px]">
      {WEEKDAYS_SHORT.map((w) => (
        <div key={w} className="text-[#868e96]">
          {w[0]}
        </div>
      ))}
      {eachDay(range).map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onDayClick(d)}
          aria-label={d}
          className={cn(
            'flex h-8 flex-col items-center justify-center rounded',
            parsePure(d).getMonth() !== month && 'opacity-40',
            d === selected && 'border border-[#f1f3f5]',
            d === today && 'bg-[#f1f3f5] text-[#121212]',
          )}
        >
          <span>{dayNum(d)}</span>
          <span className="h-3 text-[10px] leading-none" data-marker={marked.has(d) ? 'o' : ''}>
            {marked.has(d) ? 'o' : ''}
          </span>
        </button>
      ))}
    </div>
  );
}

export function YearView({ year, items, today, onDayClick }: { year: number; items: CalendarItem[]; today: string; onDayClick: (d: string) => void }) {
  const marked = new Set(items.map((i) => i.date));
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: 12 }, (_, m) => {
        const first = `${year}-${String(m + 1).padStart(2, '0')}-01`;
        const lead = parsePure(first).getDay();
        const days = new Date(year, m + 1, 0).getDate();
        return (
          <div key={m}>
            <h3 className="mb-1 text-xs tracking-wider">{monthName(m)}</h3>
            <div className="grid grid-cols-7 gap-px text-center text-[10px]">
              {Array.from({ length: lead }, (_, i) => (
                <div key={`b${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const d = `${year}-${String(m + 1).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => onDayClick(d)}
                    className={cn('rounded py-0.5', d === today && 'bg-[#f1f3f5] text-[#121212]', marked.has(d) && d !== today && 'underline')}
                  >
                    {i + 1}
                    {marked.has(d) ? 'o' : ''}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function AgendaView({ items, today, onItemClick }: Pick<ViewProps, 'items' | 'today' | 'onItemClick'>) {
  const dates = Array.from(new Set(items.map((i) => i.date))).sort();
  if (dates.length === 0) return <p className="p-6 text-center text-sm text-[#868e96]">NENHUM EVENTO OU PRAZO NO PERÍODO</p>;
  return (
    <div className="space-y-3">
      {dates.map((d) => (
        <div key={d}>
          <h3 className={cn('border-b border-[#868e96] pb-1 text-xs tracking-wider', d === today && 'text-[#b2f2bb]')}>
            {d.split('-').reverse().join('/')} {WEEKDAYS_SHORT[parsePure(d).getDay()]}
          </h3>
          <div className="mt-1 space-y-1">
            {items
              .filter((i) => i.date === d)
              .map((i) => (
                <ItemChip key={i.key} item={i} onItemClick={onItemClick} className="py-1 text-xs" />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}
