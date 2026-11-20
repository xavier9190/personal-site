import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createPgClient } from './pg';
import { createPgliteTestDb } from './pglite-test';
import * as pgSchema from './schema';
import { runPgMigrations } from '../../scripts/db-migrate';

const EXPECTED_DOMAIN_TABLES = [
  'calendar_events',
  'credit_cards',
  'installment_plans',
  'payable_bills',
  'transactions',
  'finance_preferences',
  'academic_projects',
  'project_milestones',
  'project_links',
  'shopping_items',
  'chat_threads',
  'chat_messages',
  'pending_tool_actions',
] as const;

describe('PostgreSQL database seam (PGlite in-memory + Drizzle pg-core + RLS)', () => {
  it('applies PostgreSQL migrations cleanly and initializes all 13 domain tables empty (0 rows, no seed)', async () => {
    const { db, close } = await createPgliteTestDb();

    try {
      expect(await db.select().from(pgSchema.calendarEvents)).toHaveLength(0);
      expect(await db.select().from(pgSchema.creditCards)).toHaveLength(0);
      expect(await db.select().from(pgSchema.installmentPlans)).toHaveLength(0);
      expect(await db.select().from(pgSchema.payableBills)).toHaveLength(0);
      expect(await db.select().from(pgSchema.transactions)).toHaveLength(0);
      expect(await db.select().from(pgSchema.financePreferences)).toHaveLength(0);
      expect(await db.select().from(pgSchema.academicProjects)).toHaveLength(0);
      expect(await db.select().from(pgSchema.projectMilestones)).toHaveLength(0);
      expect(await db.select().from(pgSchema.projectLinks)).toHaveLength(0);
      expect(await db.select().from(pgSchema.shoppingItems)).toHaveLength(0);
      expect(await db.select().from(pgSchema.chatThreads)).toHaveLength(0);
      expect(await db.select().from(pgSchema.chatMessages)).toHaveLength(0);
      expect(await db.select().from(pgSchema.pendingToolActions)).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('enables Row Level Security and revokes anon/authenticated privileges on 100% of domain tables', async () => {
    const { client, close } = await createPgliteTestDb({
      beforeMigrate: async (pglite) => {
        await pglite.exec(`
          CREATE ROLE anon NOLOGIN;
          CREATE ROLE authenticated NOLOGIN;
          ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated;
        `);
      },
    });

    try {
      const rlsResult = await client.query<{
        relname: string;
        relrowsecurity: boolean;
      }>(`
        SELECT c.relname, c.relrowsecurity
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
      `);

      const rlsByTable = new Map(rlsResult.rows.map((row) => [row.relname, row.relrowsecurity]));

      for (const table of EXPECTED_DOMAIN_TABLES) {
        expect(rlsByTable.get(table), `RLS should be enabled on ${table}`).toBe(true);

        const privResult = await client.query<{
          anon_select: boolean;
          anon_insert: boolean;
          auth_select: boolean;
          auth_insert: boolean;
        }>(
          `SELECT
            has_table_privilege('anon', $1, 'SELECT') AS anon_select,
            has_table_privilege('anon', $1, 'INSERT') AS anon_insert,
            has_table_privilege('authenticated', $1, 'SELECT') AS auth_select,
            has_table_privilege('authenticated', $1, 'INSERT') AS auth_insert`,
          [`public."${table}"`],
        );

        expect(privResult.rows[0]).toEqual({
          anon_select: false,
          anon_insert: false,
          auth_select: false,
          auth_insert: false,
        });
      }

      const sql = fs.readFileSync(
        path.join(process.cwd(), 'src', 'db', 'migrations-pg', '0000_initial.sql'),
        'utf8',
      );
      for (const table of EXPECTED_DOMAIN_TABLES) {
        expect(sql).toContain(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY;`);
        expect(sql).toContain(`REVOKE ALL ON TABLE "${table}" FROM anon, authenticated;`);
      }
    } finally {
      await close();
    }
  });

  it('enforces ON DELETE CASCADE and ON DELETE SET NULL referential integrity in PostgreSQL', async () => {
    const { db, close } = await createPgliteTestDb();

    try {
      // 1. Academic project cascade -> project_milestones & project_links
      await db.insert(pgSchema.academicProjects).values({
        id: 'proj-1',
        title: 'SISTEMAS DISTRIBUÍDOS',
        description: 'TRABALHO FINAL',
        finalDeliveryDate: '2026-11-18',
        groupMembers: JSON.stringify(['XAVIER', 'LETICIA']),
        status: 'IN_PROGRESS',
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      });
      await db.insert(pgSchema.projectMilestones).values({
        id: 'ms-1',
        projectId: 'proj-1',
        title: '1 ENTREGA',
        dueDate: '2026-09-05',
        isCompleted: false,
        sortOrder: 1,
      });
      await db.insert(pgSchema.projectLinks).values({
        id: 'lnk-1',
        projectId: 'proj-1',
        label: 'GitHub',
        url: 'https://github.com/example/repo',
      });

      await db.delete(pgSchema.academicProjects);
      expect(await db.select().from(pgSchema.projectMilestones)).toHaveLength(0);
      expect(await db.select().from(pgSchema.projectLinks)).toHaveLength(0);

      // 2. Chat thread cascade -> chat_messages & pending_tool_actions
      await db.insert(pgSchema.chatThreads).values({
        id: 'thread-1',
        title: 'Resumo financeiro',
        createdAt: '2026-11-10T00:00:00.000Z',
        updatedAt: '2026-11-10T00:00:00.000Z',
      });
      await db.insert(pgSchema.chatMessages).values({
        id: 'msg-1',
        threadId: 'thread-1',
        role: 'USER',
        content: 'Quanto falta pagar?',
        createdAt: '2026-11-10T00:00:00.000Z',
      });
      await db.insert(pgSchema.pendingToolActions).values({
        id: 'act-1',
        threadId: 'thread-1',
        toolName: 'delete_event',
        argsJson: '{"id":"evt-1"}',
        status: 'PENDING_CONFIRMATION',
      });

      await db.delete(pgSchema.chatThreads);
      expect(await db.select().from(pgSchema.chatMessages)).toHaveLength(0);
      expect(await db.select().from(pgSchema.pendingToolActions)).toHaveLength(0);

      // 3. SET NULL on credit_cards, shopping_items, payable_bills
      await db.insert(pgSchema.creditCards).values({
        id: 'card-1',
        name: 'Nubank',
        closingDay: 10,
        dueDay: 17,
        limitCents: 500000,
      });
      await db.insert(pgSchema.shoppingItems).values({
        id: 'shop-1',
        name: 'Monitor 144Hz',
        priceCents: 57600,
        status: 'IN_TRANSIT',
      });
      await db.insert(pgSchema.installmentPlans).values({
        id: 'plan-1',
        description: 'Monitor 144Hz',
        category: 'Eletrônicos',
        totalInstallments: 4,
        paidInstallments: 0,
        installmentAmountCents: 14400,
        creditCardId: 'card-1',
        startMonth: '2026-11',
        shoppingItemId: 'shop-1',
      });
      await db.insert(pgSchema.payableBills).values({
        id: 'bill-1',
        title: 'Fatura Nubank',
        billType: 'CREDIT_CARD_BILL',
        amountCents: 14400,
        category: 'Cartão',
        dueDate: '2026-11-17',
        competenceMonth: '2026-11',
        status: 'PENDING',
        creditCardId: 'card-1',
      });
      await db.insert(pgSchema.transactions).values({
        id: 'tx-1',
        type: 'EXPENSE',
        description: 'Pagamento Fatura',
        category: 'Cartão',
        amountCents: 14400,
        occurredAt: '2026-11-17',
        status: 'PAID',
        payableBillId: 'bill-1',
        shoppingItemId: 'shop-1',
      });

      await db.delete(pgSchema.creditCards);
      await db.delete(pgSchema.shoppingItems);
      await db.delete(pgSchema.payableBills);

      const [plan] = await db.select().from(pgSchema.installmentPlans);
      const [tx] = await db.select().from(pgSchema.transactions);
      expect(plan.creditCardId).toBeNull();
      expect(plan.shoppingItemId).toBeNull();
      expect(tx.payableBillId).toBeNull();
      expect(tx.shoppingItemId).toBeNull();
    } finally {
      await close();
    }
  });

  it('configures PostgreSQL pool safely for Supabase Supavisor and guards missing DATABASE_URL', async () => {
    expect(() => createPgClient('')).toThrow(/DATABASE_URL/i);

    const client = createPgClient('postgres://postgres:postgres@127.0.0.1:5432/postgres');
    try {
      expect(client.pool.options.max).toBe(5);
      expect(client.pool.options.connectionTimeoutMillis).toBe(15_000);
      expect(client.db).toBeDefined();
    } finally {
      await client.close();
    }

    await expect(runPgMigrations('')).rejects.toThrow(/DATABASE_URL/i);
  });
});
