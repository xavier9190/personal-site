import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { AcademicService } from '@/features/academic/service';
import { FinancesService } from '@/features/finances/service';
import { ShoppingService } from '@/features/shopping/service';
import { CalendarService } from './service';

function setup() {
  const { db, close } = createDbClient(':memory:');
  return {
    close,
    calendar: new CalendarService(db),
    academic: new AcademicService(db),
    finances: new FinancesService(db),
    shopping: new ShoppingService(db),
  };
}

const base = {
  date: '2026-11-11',
  startTime: '09:00',
  endTime: '10:00',
  color: 'green' as const,
};

describe('CalendarService (eventos, projeção unificada, recorrência, conflitos)', () => {
  it('creates, edits and deletes an event (title uppercased)', () => {
    const { calendar, close } = setup();
    try {
      const ev = calendar.createEvent({ ...base, title: 'Reunião' });
      expect(ev.title).toBe('REUNIÃO');
      let items = calendar.listItems('2026-11-11', '2026-11-11');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        source: 'EVENT',
        eventId: ev.id,
        date: '2026-11-11',
        startTime: '09:00',
        endTime: '10:00',
        color: '#b2f2bb',
      });

      calendar.updateEvent(ev.id, { ...base, title: 'Aula', color: 'red', startTime: '10:00', endTime: '11:30' });
      items = calendar.listItems('2026-11-11', '2026-11-11');
      expect(items[0]).toMatchObject({ title: 'AULA', color: '#ffc9c9', startTime: '10:00', endTime: '11:30' });

      calendar.deleteEvent(ev.id);
      expect(calendar.listItems('2026-11-01', '2026-11-30')).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('rejects end time before start time and empty title', () => {
    const { calendar, close } = setup();
    try {
      expect(() => calendar.createEvent({ ...base, title: 'X', startTime: '10:00', endTime: '09:00' })).toThrow();
      expect(() => calendar.createEvent({ ...base, title: '  ' })).toThrow();
    } finally {
      close();
    }
  });

  it('projects academic milestones and final deliveries without new tables', () => {
    const { calendar, academic, close } = setup();
    try {
      const p = academic.createProject({
        title: 'TCC',
        description: 'x',
        finalDeliveryDate: '2026-11-30',
      });
      academic.addMilestone(p.id, { title: 'Capítulo 1', dueDate: '2026-11-15' });
      const items = calendar.listItems('2026-11-01', '2026-11-30');
      expect(items.find((i) => i.source === 'ACADEMIC_MILESTONE')).toMatchObject({
        title: 'CAPÍTULO 1',
        date: '2026-11-15',
        allDay: true,
        readOnly: true,
        sourceId: expect.any(String),
      });
      expect(items.find((i) => i.source === 'ACADEMIC_DELIVERY')).toMatchObject({
        date: '2026-11-30',
        readOnly: true,
      });
      expect(calendar.listEvents()).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('projects finance bill due dates', () => {
    const { calendar, finances, close } = setup();
    try {
      finances.createPayableBill({
        title: 'Aluguel',
        billType: 'SINGLE_BILL',
        amountCents: 100000,
        category: 'MORADIA',
        dueDate: '2026-11-05',
      });
      const items = calendar.listItems('2026-11-01', '2026-11-30');
      const bill = items.find((i) => i.source === 'FINANCE_BILL');
      expect(bill).toMatchObject({ title: 'ALUGUEL', date: '2026-11-05', allDay: true, readOnly: true });
      expect(calendar.listItems('2026-12-01', '2026-12-31')).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('projects shopping estimated delivery dates only for in-transit items', () => {
    const { calendar, shopping, close } = setup();
    try {
      const a = shopping.addWishlistItem({ name: 'Mouse', priceCents: 1000 });
      shopping.addWishlistItem({ name: 'Wish', priceCents: 1000 });
      shopping.markPurchased(a.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-10',
        estimatedDeliveryDate: '2026-11-20',
        alreadyLoggedInFinances: true,
      });
      const items = calendar.listItems('2026-11-01', '2026-11-30');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ source: 'SHOPPING_DELIVERY', date: '2026-11-20', readOnly: true });

      shopping.markDelivered(a.id, '2026-11-18');
      expect(calendar.listItems('2026-11-01', '2026-11-30')).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('merges all four sources, sorted by date then time', () => {
    const { calendar, academic, finances, shopping, close } = setup();
    try {
      const p = academic.createProject({ title: 'P', description: 'x' });
      academic.addMilestone(p.id, { title: 'M', dueDate: '2026-11-10' });
      finances.createPayableBill({
        title: 'Luz', billType: 'SINGLE_BILL', amountCents: 100, category: 'X', dueDate: '2026-11-10',
      });
      const s = shopping.addWishlistItem({ name: 'I', priceCents: 1 });
      shopping.markPurchased(s.id, {
        storeApp: 'A', purchasedAt: '2026-11-01', estimatedDeliveryDate: '2026-11-10', alreadyLoggedInFinances: true,
      });
      calendar.createEvent({ ...base, date: '2026-11-10', title: 'Evento' });
      const items = calendar.listItems('2026-11-10', '2026-11-10');
      expect(new Set(items.map((i) => i.source))).toEqual(
        new Set(['EVENT', 'ACADEMIC_MILESTONE', 'FINANCE_BILL', 'SHOPPING_DELIVERY']),
      );
      // all-day projected items first, then timed events
      expect(items[items.length - 1].source).toBe('EVENT');
      expect(items.slice(0, -1).every((i) => i.allDay)).toBe(true);
    } finally {
      close();
    }
  });

  it('expands DAILY recurrence within range and until limit', () => {
    const { calendar, close } = setup();
    try {
      calendar.createEvent({ ...base, title: 'Daily', recurrence: 'DAILY', recurrenceUntil: '2026-11-13' });
      const items = calendar.listItems('2026-11-10', '2026-11-20');
      expect(items.map((i) => i.date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
      expect(new Set(items.map((i) => i.eventId)).size).toBe(1);
    } finally {
      close();
    }
  });

  it('expands WEEKLY recurrence on same weekday', () => {
    const { calendar, close } = setup();
    try {
      calendar.createEvent({ ...base, title: 'Weekly', recurrence: 'WEEKLY' });
      const items = calendar.listItems('2026-11-01', '2026-12-05');
      expect(items.map((i) => i.date)).toEqual(['2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02']);
    } finally {
      close();
    }
  });

  it('expands MONTHLY recurrence clamping to the last day of short months', () => {
    const { calendar, close } = setup();
    try {
      calendar.createEvent({ ...base, title: 'Monthly', date: '2026-01-31', recurrence: 'MONTHLY' });
      const items = calendar.listItems('2026-01-01', '2026-04-30');
      expect(items.map((i) => i.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    } finally {
      close();
    }
  });

  it('does not show recurring events before their start date', () => {
    const { calendar, close } = setup();
    try {
      calendar.createEvent({ ...base, title: 'D', recurrence: 'DAILY' });
      expect(calendar.listItems('2026-11-01', '2026-11-10')).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('detects time conflicts between overlapping timed items only', () => {
    const { calendar, close } = setup();
    try {
      const a = calendar.createEvent({ ...base, title: 'A', startTime: '09:00', endTime: '10:30' });
      const b = calendar.createEvent({ ...base, title: 'B', startTime: '10:00', endTime: '11:00', color: 'blue' });
      calendar.createEvent({ ...base, title: 'C', startTime: '10:30', endTime: '11:30', color: 'yellow' });
      calendar.createEvent({ ...base, title: 'D', startTime: '13:00', endTime: '14:00', color: 'red' });
      const conflicts = calendar.detectConflicts(calendar.listItems('2026-11-11', '2026-11-11'));
      const pairs = conflicts.map(([x, y]) => [x.eventId, y.eventId].sort().join('|'));
      expect(pairs).toContain([a.id, b.id].sort().join('|'));
      // C starts exactly when A ends: no conflict with A; conflicts with B
      expect(conflicts).toHaveLength(2);
    } finally {
      close();
    }
  });

  it('findConflictsFor flags a candidate overlapping an existing event, ignoring itself', () => {
    const { calendar, close } = setup();
    try {
      const a = calendar.createEvent({ ...base, title: 'A' });
      expect(calendar.findConflictsFor({ date: base.date, startTime: '09:30', endTime: '10:30' })).toHaveLength(1);
      expect(
        calendar.findConflictsFor({ date: base.date, startTime: '09:30', endTime: '10:30' }, a.id),
      ).toHaveLength(0);
      expect(calendar.findConflictsFor({ date: base.date, startTime: '10:00', endTime: '11:00' })).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('layoutDay places overlapping items side by side', () => {
    const { calendar, close } = setup();
    try {
      calendar.createEvent({ ...base, title: 'A', startTime: '09:00', endTime: '10:30' });
      calendar.createEvent({ ...base, title: 'B', startTime: '10:00', endTime: '11:00', color: 'blue' });
      calendar.createEvent({ ...base, title: 'C', startTime: '12:00', endTime: '13:00', color: 'red' });
      const layout = calendar.layoutDay(calendar.listItems('2026-11-11', '2026-11-11'));
      const byTitle = Object.fromEntries(layout.map((l) => [l.item.title, l]));
      expect(byTitle.A).toMatchObject({ column: 0, columns: 2 });
      expect(byTitle.B).toMatchObject({ column: 1, columns: 2 });
      expect(byTitle.C).toMatchObject({ column: 0, columns: 1 });
    } finally {
      close();
    }
  });
});
