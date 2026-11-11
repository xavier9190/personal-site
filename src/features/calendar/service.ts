import crypto from 'node:crypto';
import { and, eq, gte, isNotNull, lte } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { academicProjects, projectMilestones } from '@/features/academic/schema';
import { payableBills } from '@/features/finances/schema';
import { shoppingItems } from '@/features/shopping/schema';
import * as schema from './schema';
import {
  COLOR_HEX,
  detectConflicts,
  eventInputSchema,
  expandOccurrenceDates,
  layoutDay,
  timesOverlap,
  type CalendarItem,
  type EventInput,
} from './logic';

export * from './logic';

export type CalendarEventRecord = typeof schema.calendarEvents.$inferSelect;

const SEMANTIC = {
  academic: '#a5d8ff',
  finance: '#ffc9c9',
  shopping: '#ffec99',
} as const;

const timePart = (iso: string) => iso.slice(11, 16);
const datePart = (iso: string) => iso.slice(0, 10);

export class CalendarService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listEvents(): CalendarEventRecord[] {
    return this.db.select().from(schema.calendarEvents).all();
  }

  getEvent(id: string): CalendarEventRecord {
    const ev = this.db.select().from(schema.calendarEvents).where(eq(schema.calendarEvents.id, id)).get();
    if (!ev) throw new Error(`EVENTO NÃO ENCONTRADO: ${id}`);
    return ev;
  }

  private toValues(input: EventInput) {
    const v = eventInputSchema.parse(input);
    const start = v.allDay ? '00:00' : v.startTime!;
    const end = v.allDay ? '23:59' : v.endTime!;
    return {
      title: v.title.toUpperCase(),
      description: v.description ? v.description.toUpperCase() : null,
      startAt: `${v.date}T${start}`,
      endAt: `${v.date}T${end}`,
      allDay: v.allDay,
      color: v.color,
      recurrenceRule: v.recurrence,
      recurrenceUntil: v.recurrence === 'NONE' ? null : (v.recurrenceUntil ?? null),
    };
  }

  createEvent(input: EventInput): CalendarEventRecord {
    const now = new Date().toISOString();
    const record = { id: crypto.randomUUID(), ...this.toValues(input), createdAt: now, updatedAt: now };
    this.db.insert(schema.calendarEvents).values(record).run();
    return record;
  }

  updateEvent(id: string, input: EventInput): CalendarEventRecord {
    this.getEvent(id);
    this.db
      .update(schema.calendarEvents)
      .set({ ...this.toValues(input), updatedAt: new Date().toISOString() })
      .where(eq(schema.calendarEvents.id, id))
      .run();
    return this.getEvent(id);
  }

  deleteEvent(id: string): void {
    this.getEvent(id);
    this.db.delete(schema.calendarEvents).where(eq(schema.calendarEvents.id, id)).run();
  }

  /** Projeção unificada de [from, to] (YYYY-MM-DD, inclusive): eventos + Acadêmico + Finanças + Compras. */
  listItems(from: string, to: string): CalendarItem[] {
    const items: CalendarItem[] = [
      ...this.eventItems(from, to),
      ...this.academicItems(from, to),
      ...this.financeItems(from, to),
      ...this.shoppingItems(from, to),
    ];
    return items.sort(
      (a, b) =>
        a.date.localeCompare(b.date) ||
        Number(b.allDay) - Number(a.allDay) ||
        (a.startTime ?? '').localeCompare(b.startTime ?? '') ||
        a.title.localeCompare(b.title),
    );
  }

  private eventItems(from: string, to: string): CalendarItem[] {
    const out: CalendarItem[] = [];
    for (const ev of this.listEvents()) {
      const start = datePart(ev.startAt);
      for (const date of expandOccurrenceDates(start, ev.recurrenceRule, ev.recurrenceUntil, from, to)) {
        out.push({
          key: `event:${ev.id}:${date}`,
          source: 'EVENT',
          title: ev.title,
          date,
          startTime: ev.allDay ? null : timePart(ev.startAt),
          endTime: ev.allDay ? null : timePart(ev.endAt),
          allDay: ev.allDay,
          color: COLOR_HEX[ev.color],
          eventId: ev.id,
          sourceId: null,
          readOnly: false,
          done: false,
          href: null,
        });
      }
    }
    return out;
  }

  private projected(
    key: string,
    source: CalendarItem['source'],
    title: string,
    date: string,
    color: string,
    sourceId: string,
    done: boolean,
    href: string,
  ): CalendarItem {
    return {
      key, source, title, date, startTime: null, endTime: null, allDay: true, color,
      eventId: null, sourceId, readOnly: true, done, href,
    };
  }

  private academicItems(from: string, to: string): CalendarItem[] {
    const milestones = this.db
      .select({ m: projectMilestones, p: academicProjects })
      .from(projectMilestones)
      .innerJoin(academicProjects, eq(projectMilestones.projectId, academicProjects.id))
      .where(and(gte(projectMilestones.dueDate, from), lte(projectMilestones.dueDate, to)))
      .all()
      .map(({ m }) =>
        this.projected(`milestone:${m.id}`, 'ACADEMIC_MILESTONE', m.title.toUpperCase(), m.dueDate,
          SEMANTIC.academic, m.id, m.isCompleted, '/academico'),
      );
    const deliveries = this.db
      .select()
      .from(academicProjects)
      .where(
        and(
          isNotNull(academicProjects.finalDeliveryDate),
          gte(academicProjects.finalDeliveryDate, from),
          lte(academicProjects.finalDeliveryDate, to),
        ),
      )
      .all()
      .map((p) =>
        this.projected(`delivery:${p.id}`, 'ACADEMIC_DELIVERY', `ENTREGA: ${p.title.toUpperCase()}`,
          p.finalDeliveryDate!, SEMANTIC.academic, p.id, p.status === 'COMPLETED', '/academico'),
      );
    return [...milestones, ...deliveries];
  }

  private financeItems(from: string, to: string): CalendarItem[] {
    return this.db
      .select()
      .from(payableBills)
      .where(and(gte(payableBills.dueDate, from), lte(payableBills.dueDate, to)))
      .all()
      .map((b) =>
        this.projected(`bill:${b.id}`, 'FINANCE_BILL', b.title.toUpperCase(), b.dueDate,
          SEMANTIC.finance, b.id, b.status === 'PAID', '/financas'),
      );
  }

  private shoppingItems(from: string, to: string): CalendarItem[] {
    return this.db
      .select()
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.status, 'IN_TRANSIT'),
          isNotNull(shoppingItems.estimatedDeliveryDate),
          gte(shoppingItems.estimatedDeliveryDate, from),
          lte(shoppingItems.estimatedDeliveryDate, to),
        ),
      )
      .all()
      .map((s) =>
        this.projected(`shopping:${s.id}`, 'SHOPPING_DELIVERY', `ENTREGA: ${s.name.toUpperCase()}`,
          s.estimatedDeliveryDate!, SEMANTIC.shopping, s.id, false, '/compras'),
      );
  }

  detectConflicts(items: CalendarItem[]) {
    return detectConflicts(items);
  }

  layoutDay(items: CalendarItem[]) {
    return layoutDay(items);
  }

  /** Itens com horário que colidem com um candidato (ignora `ignoreEventId`). */
  findConflictsFor(
    candidate: { date: string; startTime: string; endTime: string },
    ignoreEventId?: string,
  ): CalendarItem[] {
    return this.listItems(candidate.date, candidate.date).filter(
      (i) =>
        !i.allDay &&
        i.startTime !== null &&
        i.endTime !== null &&
        i.eventId !== ignoreEventId &&
        timesOverlap(candidate.startTime, candidate.endTime, i.startTime, i.endTime),
    );
  }
}
