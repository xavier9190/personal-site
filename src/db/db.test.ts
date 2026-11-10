import { describe, expect, it } from 'vitest';
import { createDbClient } from './index';
import * as schema from './schema';

describe('database seam (SQLite :memory: + Drizzle schema without seed)', () => {
  it('initializes all domain tables 100% empty (0 rows, no seed data)', () => {
    const { db, close } = createDbClient(':memory:');

    try {
      expect(db.select().from(schema.calendarEvents).all()).toHaveLength(0);
      expect(db.select().from(schema.creditCards).all()).toHaveLength(0);
      expect(db.select().from(schema.installmentPlans).all()).toHaveLength(0);
      expect(db.select().from(schema.payableBills).all()).toHaveLength(0);
      expect(db.select().from(schema.transactions).all()).toHaveLength(0);
      expect(db.select().from(schema.financePreferences).all()).toHaveLength(0);
      expect(db.select().from(schema.academicProjects).all()).toHaveLength(0);
      expect(db.select().from(schema.projectMilestones).all()).toHaveLength(0);
      expect(db.select().from(schema.projectLinks).all()).toHaveLength(0);
      expect(db.select().from(schema.shoppingItems).all()).toHaveLength(0);
      expect(db.select().from(schema.chatThreads).all()).toHaveLength(0);
      expect(db.select().from(schema.chatMessages).all()).toHaveLength(0);
      expect(db.select().from(schema.pendingToolActions).all()).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('enforces foreign key cascade deletes across related tables', () => {
    const { db, close } = createDbClient(':memory:');

    try {
      db.insert(schema.academicProjects)
        .values({
          id: 'proj-1',
          title: 'SISTEMAS DISTRIBUÍDOS',
          description: 'TRABALHO FINAL',
          finalDeliveryDate: '2026-11-18',
          groupMembers: JSON.stringify(['XAVIER', 'LETICIA']),
          status: 'IN_PROGRESS',
          createdAt: '2026-11-10T00:00:00.000Z',
          updatedAt: '2026-11-10T00:00:00.000Z',
        })
        .run();

      db.insert(schema.projectMilestones)
        .values({
          id: 'ms-1',
          projectId: 'proj-1',
          title: '1 ENTREGA',
          dueDate: '2026-09-05',
          isCompleted: false,
          sortOrder: 1,
        })
        .run();

      expect(db.select().from(schema.projectMilestones).all()).toHaveLength(1);

      db.delete(schema.academicProjects).run();

      expect(db.select().from(schema.projectMilestones).all()).toHaveLength(0);
    } finally {
      close();
    }
  });
});
