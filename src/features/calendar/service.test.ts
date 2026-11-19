import { describe, expect, it } from 'vitest';
import { createPgliteTestDb } from '@/db/pglite-test';
import { AcademicService } from '@/features/academic/service';
import { FinancesService } from '@/features/finances/service';
import { ShoppingService } from '@/features/shopping/service';
import { CalendarService } from './service';

async function setup() {
  const { db, close } = await createPgliteTestDb();
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
  it('creates, edits and deletes an event (title uppercased)', async () => {
    const { calendar, close } = await setup();
    try {
      const ev = await calendar.createEvent({ ...base, title: 'Reunião' });
      expect(ev.title).toBe('REUNIÃO');
      let items = await calendar.listItems('2026-11-11', '2026-11-11');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        source: 'EVENT',
        eventId: ev.id,
        date: '2026-11-11',
        startTime: '09:00',
        endTime: '10:00',
        color: '#b2f2bb',
      });

      await calendar.updateEvent(ev.id, { ...base, title: 'Aula', color: 'red', startTime: '10:00', endTime: '11:30' });
      items = await calendar.listItems('2026-11-11', '2026-11-11');
      expect(items[0]).toMatchObject({ title: 'AULA', color: '#ffc9c9', startTime: '10:00', endTime: '11:30' });

      await calendar.deleteEvent(ev.id);
      expect(await calendar.listItems('2026-11-01', '2026-11-30')).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('rejects end time before start time and empty title', async () => {
    const { calendar, close } = await setup();
    try {
      await expect(calendar.createEvent({ ...base, title: 'X', startTime: '10:00', endTime: '09:00' })).rejects.toThrow();
      await expect(calendar.createEvent({ ...base, title: '  ' })).rejects.toThrow();
    } finally {
      await close();
    }
  });

  it('projects academic milestones and final deliveries without new tables', async () => {
    const { calendar, academic, close } = await setup();
    try {
      const p = await academic.createProject({
        title: 'TCC',
        description: 'x',
        finalDeliveryDate: '2026-11-30',
      });
      await academic.addMilestone(p.id, { title: 'Capítulo 1', dueDate: '2026-11-15' });
      const items = await calendar.listItems('2026-11-01', '2026-11-30');
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
      expect(await calendar.listEvents()).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('projects finance bill due dates', async () => {
    const { calendar, finances, close } = await setup();
    try {
      await finances.createPayableBill({
        title: 'Aluguel',
        billType: 'SINGLE_BILL',
        amountCents: 100000,
        category: 'MORADIA',
        dueDate: '2026-11-05',
      });
      const items = await calendar.listItems('2026-11-01', '2026-11-30');
      const bill = items.find((i) => i.source === 'FINANCE_BILL');
      expect(bill).toMatchObject({ title: 'ALUGUEL', date: '2026-11-05', allDay: true, readOnly: true });
      expect(await calendar.listItems('2026-12-01', '2026-12-31')).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('projects shopping estimated delivery dates only for in-transit items', async () => {
    const { calendar, shopping, close } = await setup();
    try {
      const a = await shopping.addWishlistItem({ name: 'Mouse', priceCents: 1000 });
      await shopping.addWishlistItem({ name: 'Wish', priceCents: 1000 });
      await shopping.markPurchased(a.id, {
        storeApp: 'Shopee',
        purchasedAt: '2026-11-10',
        estimatedDeliveryDate: '2026-11-20',
        alreadyLoggedInFinances: true,
      });
      const items = await calendar.listItems('2026-11-01', '2026-11-30');
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({ source: 'SHOPPING_DELIVERY', date: '2026-11-20', readOnly: true });

      await shopping.markDelivered(a.id, '2026-11-18');
      expect(await calendar.listItems('2026-11-01', '2026-11-30')).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('merges all four sources, sorted by date then time', async () => {
    const { calendar, academic, finances, shopping, close } = await setup();
    try {
      const p = await academic.createProject({ title: 'P', description: 'x' });
      await academic.addMilestone(p.id, { title: 'M', dueDate: '2026-11-10' });
      await finances.createPayableBill({
        title: 'Luz', billType: 'SINGLE_BILL', amountCents: 100, category: 'X', dueDate: '2026-11-10',
      });
      const s = await shopping.addWishlistItem({ name: 'I', priceCents: 1 });
      await shopping.markPurchased(s.id, {
        storeApp: 'A', purchasedAt: '2026-11-01', estimatedDeliveryDate: '2026-11-10', alreadyLoggedInFinances: true,
      });
      await calendar.createEvent({ ...base, date: '2026-11-10', title: 'Evento' });
      const items = await calendar.listItems('2026-11-10', '2026-11-10');
      expect(new Set(items.map((i) => i.source))).toEqual(
        new Set(['EVENT', 'ACADEMIC_MILESTONE', 'FINANCE_BILL', 'SHOPPING_DELIVERY']),
      );
      // all-day projected items first, then timed events
      expect(items[items.length - 1].source).toBe('EVENT');
      expect(items.slice(0, -1).every((i) => i.allDay)).toBe(true);
    } finally {
      await close();
    }
  });

  it('expands DAILY recurrence within range and until limit', async () => {
    const { calendar, close } = await setup();
    try {
      await calendar.createEvent({ ...base, title: 'Daily', recurrence: 'DAILY', recurrenceUntil: '2026-11-13' });
      const items = await calendar.listItems('2026-11-10', '2026-11-20');
      expect(items.map((i) => i.date)).toEqual(['2026-11-11', '2026-11-12', '2026-11-13']);
      expect(new Set(items.map((i) => i.eventId)).size).toBe(1);
    } finally {
      await close();
    }
  });

  it('expands WEEKLY recurrence on same weekday', async () => {
    const { calendar, close } = await setup();
    try {
      await calendar.createEvent({ ...base, title: 'Weekly', recurrence: 'WEEKLY' });
      const items = await calendar.listItems('2026-11-01', '2026-12-05');
      expect(items.map((i) => i.date)).toEqual(['2026-11-11', '2026-11-18', '2026-11-25', '2026-12-02']);
    } finally {
      await close();
    }
  });

  it('expands MONTHLY recurrence clamping to the last day of short months', async () => {
    const { calendar, close } = await setup();
    try {
      await calendar.createEvent({ ...base, title: 'Monthly', date: '2026-01-31', recurrence: 'MONTHLY' });
      const items = await calendar.listItems('2026-01-01', '2026-04-30');
      expect(items.map((i) => i.date)).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
    } finally {
      await close();
    }
  });

  it('does not show recurring events before their start date', async () => {
    const { calendar, close } = await setup();
    try {
      await calendar.createEvent({ ...base, title: 'D', recurrence: 'DAILY' });
      expect(await calendar.listItems('2026-11-01', '2026-11-10')).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('detects time conflicts between overlapping timed items only', async () => {
    const { calendar, close } = await setup();
    try {
      const a = await calendar.createEvent({ ...base, title: 'A', startTime: '09:00', endTime: '10:30' });
      const b = await calendar.createEvent({ ...base, title: 'B', startTime: '10:00', endTime: '11:00', color: 'blue' });
      await calendar.createEvent({ ...base, title: 'C', startTime: '10:30', endTime: '11:30', color: 'yellow' });
      await calendar.createEvent({ ...base, title: 'D', startTime: '13:00', endTime: '14:00', color: 'red' });
      const conflicts = calendar.detectConflicts(await calendar.listItems('2026-11-11', '2026-11-11'));
      const pairs = conflicts.map(([x, y]) => [x.eventId, y.eventId].sort().join('|'));
      expect(pairs).toContain([a.id, b.id].sort().join('|'));
      // C starts exactly when A ends: no conflict with A; conflicts with B
      expect(conflicts).toHaveLength(2);
    } finally {
      await close();
    }
  });

  it('findConflictsFor flags a candidate overlapping an existing event, ignoring itself', async () => {
    const { calendar, close } = await setup();
    try {
      const a = await calendar.createEvent({ ...base, title: 'A' });
      expect(await calendar.findConflictsFor({ date: base.date, startTime: '09:30', endTime: '10:30' })).toHaveLength(1);
      expect(
        await calendar.findConflictsFor({ date: base.date, startTime: '09:30', endTime: '10:30' }, a.id),
      ).toHaveLength(0);
      expect(await calendar.findConflictsFor({ date: base.date, startTime: '10:00', endTime: '11:00' })).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('layoutDay places overlapping items side by side', async () => {
    const { calendar, close } = await setup();
    try {
      await calendar.createEvent({ ...base, title: 'A', startTime: '09:00', endTime: '10:30' });
      await calendar.createEvent({ ...base, title: 'B', startTime: '10:00', endTime: '11:00', color: 'blue' });
      await calendar.createEvent({ ...base, title: 'C', startTime: '12:00', endTime: '13:00', color: 'red' });
      const layout = calendar.layoutDay(await calendar.listItems('2026-11-11', '2026-11-11'));
      const byTitle = Object.fromEntries(layout.map((l) => [l.item.title, l]));
      expect(byTitle.A).toMatchObject({ column: 0, columns: 2 });
      expect(byTitle.B).toMatchObject({ column: 1, columns: 2 });
      expect(byTitle.C).toMatchObject({ column: 0, columns: 1 });
    } finally {
      await close();
    }
  });
});
