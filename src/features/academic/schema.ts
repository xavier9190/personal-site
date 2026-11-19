import { boolean, integer, pgTable, text } from 'drizzle-orm/pg-core';

export const academicProjects = pgTable('academic_projects', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  finalDeliveryDate: text('final_delivery_date'),
  groupMembers: text('group_members').notNull().default('[]'),
  status: text('status', { enum: ['PLANNED', 'IN_PROGRESS', 'COMPLETED'] })
    .notNull()
    .default('IN_PROGRESS'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const projectMilestones = pgTable('project_milestones', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dueDate: text('due_date').notNull(),
  isCompleted: boolean('is_completed').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const projectLinks = pgTable('project_links', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => academicProjects.id, { onDelete: 'cascade' }),
  label: text('label').notNull(),
  url: text('url').notNull(),
});
