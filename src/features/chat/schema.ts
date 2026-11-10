import { sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const chatThreads = sqliteTable('chat_threads', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

export const chatMessages = sqliteTable('chat_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThreads.id, { onDelete: 'cascade' }),
  role: text('role', { enum: ['USER', 'ASSISTANT', 'SYSTEM'] }).notNull(),
  content: text('content').notNull(),
  attachmentsJson: text('attachments_json').notNull().default('[]'),
  toolCallsJson: text('tool_calls_json').notNull().default('[]'),
  createdAt: text('created_at').notNull(),
});

export const pendingToolActions = sqliteTable('pending_tool_actions', {
  id: text('id').primaryKey(),
  threadId: text('thread_id')
    .notNull()
    .references(() => chatThreads.id, { onDelete: 'cascade' }),
  toolName: text('tool_name').notNull(),
  argsJson: text('args_json').notNull(),
  status: text('status', {
    enum: ['PENDING_CONFIRMATION', 'CONFIRMED', 'CANCELLED', 'UNDONE'],
  }).notNull(),
  undoSnapshotJson: text('undo_snapshot_json'),
});
