import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const academicProjects = sqliteTable('academic_projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  finalDeliveryDate: text('final_delivery_date'),
  groupMembers: text('group_members').notNull().default('[]'),
  status: text('status', { enum: ['IN_PROGRESS', 'COMPLETED'] })
    .notNull()
    .default('IN_PROGRESS'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectMilestones = sqliteTable('project_milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const projectLinks = sqliteTable('project_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  url: text('url').notNull(),
});
