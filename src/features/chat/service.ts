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

  async listThreads(): Promise<ChatThreadRecord[]> {
    return this.db
      .select()
      .from(schema.chatThreads)
      .orderBy(desc(schema.chatThreads.updatedAt));
  }

  async getThread(id: string): Promise<ChatThreadRecord | null> {
    const [thread] = await this.db
      .select()
      .from(schema.chatThreads)
      .where(eq(schema.chatThreads.id, id));
    return thread ?? null;
  }

  async createThread(title: string = 'CONVERSA PRINCIPAL'): Promise<ChatThreadRecord> {
    const cleanTitle = (title.trim() || 'CONVERSA PRINCIPAL').toUpperCase();
    const now = new Date().toISOString();
    const record: ChatThreadRecord = {
      id: crypto.randomUUID(),
      title: cleanTitle,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.insert(schema.chatThreads).values(record);
    return record;
  }

  async getOrCreateDefaultThread(): Promise<ChatThreadRecord> {
    const existing = await this.listThreads();
    if (existing.length > 0) {
      return existing[0];
    }
    return this.createThread('CONVERSA PRINCIPAL');
  }

  async deleteThread(id: string): Promise<void> {
    await this.db
      .delete(schema.chatThreads)
      .where(eq(schema.chatThreads.id, id));
  }

  async addMessage(input: AddMessageInput): Promise<ChatMessageRecord> {
    const content = input.content.trim();
    if (!content) {
      throw new Error('CONTEÚDO DA MENSAGEM NÃO PODE SER VAZIO');
    }

    const thread = await this.getThread(input.threadId);
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

    await this.db.insert(schema.chatMessages).values(record);
    await this.db
      .update(schema.chatThreads)
      .set({ updatedAt: now })
      .where(eq(schema.chatThreads.id, input.threadId));

    return record;
  }

  async listMessages(threadId?: string): Promise<ChatMessageRecord[]> {
    if (threadId) {
      return this.db
        .select()
        .from(schema.chatMessages)
        .where(eq(schema.chatMessages.threadId, threadId))
        .orderBy(asc(schema.chatMessages.createdAt));
    }
    return this.db
      .select()
      .from(schema.chatMessages)
      .orderBy(asc(schema.chatMessages.createdAt));
  }

  async getMessage(id: string): Promise<ChatMessageRecord | null> {
    const [msg] = await this.db
      .select()
      .from(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id));
    return msg ?? null;
  }

  async deleteMessage(id: string): Promise<void> {
    await this.db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.id, id));
  }

  async clearThreadMessages(threadId: string): Promise<void> {
    await this.db
      .delete(schema.chatMessages)
      .where(eq(schema.chatMessages.threadId, threadId));
  }

  // ==========================================
  // PENDING TOOL ACTIONS & UNDO ENGINE
  // ==========================================

  async createPendingAction(input: {
    id?: string;
    threadId: string;
    toolName: string;
    argsJson: string;
    status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE';
    undoSnapshotJson?: string | null;
  }): Promise<PendingToolActionRecord> {
    const record: PendingToolActionRecord = {
      id: input.id ?? crypto.randomUUID(),
      threadId: input.threadId,
      toolName: input.toolName,
      argsJson: input.argsJson,
      status: input.status,
      undoSnapshotJson: input.undoSnapshotJson ?? null,
    };
    await this.db.insert(schema.pendingToolActions).values(record);
    return record;
  }

  async getPendingAction(id: string): Promise<PendingToolActionRecord | null> {
    const [action] = await this.db
      .select()
      .from(schema.pendingToolActions)
      .where(eq(schema.pendingToolActions.id, id));
    return action ?? null;
  }

  async updatePendingActionStatus(
    id: string,
    status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE',
    undoSnapshotJson?: string | null,
  ): Promise<PendingToolActionRecord> {
    const existing = await this.getPendingAction(id);
    if (!existing) {
      throw new Error(`AÇÃO PENDENTE NÃO ENCONTRADA: ${id}`);
    }

    const updates: Partial<PendingToolActionRecord> = { status };
    if (undoSnapshotJson !== undefined) {
      updates.undoSnapshotJson = undoSnapshotJson;
    }

    await this.db
      .update(schema.pendingToolActions)
      .set(updates)
      .where(eq(schema.pendingToolActions.id, id));

    return { ...existing, ...updates };
  }

  async listPendingActions(threadId?: string): Promise<PendingToolActionRecord[]> {
    if (threadId) {
      return this.db
        .select()
        .from(schema.pendingToolActions)
        .where(eq(schema.pendingToolActions.threadId, threadId));
    }
    return this.db.select().from(schema.pendingToolActions);
  }

  async deletePendingAction(id: string): Promise<void> {
    await this.db
      .delete(schema.pendingToolActions)
      .where(eq(schema.pendingToolActions.id, id));
  }
}
