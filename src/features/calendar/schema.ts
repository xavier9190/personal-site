import { boolean, pgTable, text } from 'drizzle-orm/pg-core';

export const calendarEvents = pgTable('calendar_events', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  description: text('description'),
  startAt: text('start_at').notNull(),
  endAt: text('end_at').notNull(),
  allDay: boolean('all_day').notNull().default(false),
  color: text('color', { enum: ['green', 'red', 'blue', 'yellow'] }).notNull(),
  recurrenceRule: text('recurrence_rule', {
    enum: ['NONE', 'DAILY', 'WEEKLY', 'MONTHLY'],
  })
    .notNull()
    .default('NONE'),
  recurrenceUntil: text('recurrence_until'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});
