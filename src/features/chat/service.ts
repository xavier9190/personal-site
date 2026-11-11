import crypto from 'node:crypto';
import { asc, desc, eq } from 'drizzle-orm';
import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export type ChatThreadRecord = typeof schema.chatThreads.$inferSelect;
export type ChatMessageRecord = typeof schema.chatMessages.$inferSelect;
export type PendingToolActionRecord = typeof schema.pendingToolActions.$inferSelect;

export interface AddMessageInput {
  threadId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  attachmentsJson?: string;
  toolCallsJson?: string;
}

export class ChatService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listThreads(): ChatThreadRecord[] {
    return this.db
      .select()
      .from(schema.chatThreads)
      .orderBy(desc(schema.chatThreads.updatedAt))
      .all();
  }

  getThread(id: string): ChatThreadRecord | null {
    const thread = this.db
      .select()
      .from(schema.chatThreads)
      .where(eq(schema.chatThreads.id, id))
      .get();
    return thread ?? null;
  }

  createThread(title: string = 'CONVERSA PRINCIPAL'): ChatThreadRecord {
    const cleanTitle = (title.trim() || 'CONVERSA PRINCIPAL').toUpperCase();
    const now = new Date().toISOString();
    const record: ChatThreadRecord = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      createdAt: now,
      updatedAt: now,
    };
    this.db.insert(schema.chatThreads).values(record).run();
    return record;
  }

  getOrCreateDefaultThread(): ChatThreadRecord {
    const existing = this.listThreads();
    if (existing.length > 0) {
      return existing[0];
    }
    return this.createThread('CONVERSA PRINCIPAL');
  }

  deleteThread(id: string): void {
    this.db
      .delete(schema.chatThreads)
      .where(eq(schema.chatThreads.id, id))
      .run();
  }

  addMessage(input: AddMessageInput): ChatMessageRecord {
    const content = input.content.trim();
    if (!content) {
      throw new Error('CONTEÚDO DA MENSAGEM NÃO PODE SER VAZIO');
    }

    const thread = this.getThread(input.threadId);
    if (!thread) {
      throw new Error(`THREAD NÃO ENCONTRADA: ${input.threadId}`);
    }

    const now = new Date().toISOString();
    const record: ChatMessageRecord = {
      id: crypto.randomUUID(),
      threadId: input.threadId,
      role: input.role,
      content,
      attachmentsJson: input.attachmentsJson ?? '[]',
      toolCallsJson: input.toolCallsJson ?? '[]',
      createdAt: now,
    };

    this.db.insert(schema.chatMessages).values(record).run();
    this.db
      .update(schema.chatThreads)
      .set({ updatedAt: now })
      .where(eq(schema.chatThreads.id, input.threadId))
      .run();

    return record;
  }

  listMessages(threadId?: string): ChatMessageRecord[] {
    if (threadId) {
      return this.db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.threadId, threadId))
        .orderBy(asc(schema.chatMessages.createdAt))
        .all();
    }
    return this.db
      .select()
      .from(schema.chatMessages)
      .orderBy(asc(schema.chatMessages.createdAt))
      .all();
  }

  getMessage(id: string): ChatMessageRecord | null {
    const msg = this.db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id))
      .get();
    return msg ?? null;
  }

  deleteMessage(id: string): void {
    this.db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id))
      .run();
  }

  clearThreadMessages(threadId: string): void {
    this.db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.threadId, threadId))
      .run();
  }

  // ==========================================
  // PENDING TOOL ACTIONS & UNDO ENGINE
  // ==========================================

  createPendingAction(input: {
    id?: string;
    threadId: string;
    toolName: string;
    argsJson: string;
    status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE';
    undoSnapshotJson?: string | null;
  }): PendingToolActionRecord {
    const record: PendingToolActionRecord = {
      id: input.id ?? crypto.randomUUID(),
      threadId: input.threadId,
      toolName: input.toolName,
      argsJson: input.argsJson,
      status: input.status,
      undoSnapshotJson: input.undoSnapshotJson ?? null,
    };
    this.db.insert(schema.pendingToolActions).values(record).run();
    return record;
  }

  getPendingAction(id: string): PendingToolActionRecord | null {
    const action = this.db
      .select()
      .from(schema.pendingToolActions)
      .where(eq(schema.pendingToolActions.id, id))
      .get();
    return action ?? null;
  }

  updatePendingActionStatus(
    id: string,
    status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE',
    undoSnapshotJson?: string | null,
  ): PendingToolActionRecord {
    const existing = this.getPendingAction(id);
    if (!existing) {
      throw new Error(`AÇÃO PENDENTE NÃO ENCONTRADA: ${id}`);
    }

    const updates: Partial<PendingToolActionRecord> = { status };
    if (undoSnapshotJson !== undefined) {
      updates.undoSnapshotJson = undoSnapshotJson;
    }

    this.db
      .update(schema.pendingToolActions)
      .set(updates)
      .where(eq(schema.pendingToolActions.id, id))
      .run();

    return { ...existing, ...updates };
  }

  listPendingActions(threadId?: string): PendingToolActionRecord[] {
    if (threadId) {
      return this.db
        .select()
        .from(schema.pendingToolActions)
        .where(eq(schema.pendingToolActions.threadId, threadId))
        .all();
    }
    return this.db.select().from(schema.pendingToolActions).all();
  }

  deletePendingAction(id: string): void {
    this.db
      .delete(schema.pendingToolActions)
      .where(eq(schema.pendingToolActions.id, id))
      .run();
  }
}
