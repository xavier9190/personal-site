import { describe, expect, it } from 'vitest';
import { createPgliteTestDb } from '@/db/pglite-test';
import { ChatService } from './service';

async function setup() {
  const { db, close } = await createPgliteTestDb();
  return {
    close,
    chat: new ChatService(db),
  };
}

describe('ChatService (PostgreSQL persistence, threads, messages CRUD)', () => {
  it('creates and lists threads, getting or creating default thread', async () => {
    const { chat, close } = await setup();
    try {
      expect(await chat.listThreads()).toHaveLength(0);

      // getOrCreateDefaultThread creates one if none exists
      const defThread = await chat.getOrCreateDefaultThread();
      expect(defThread.id).toBeDefined();
      expect(defThread.title).toBe('CONVERSA PRINCIPAL');
      expect(await chat.listThreads()).toHaveLength(1);

      // Calling again returns the existing one
      const sameThread = await chat.getOrCreateDefaultThread();
      expect(sameThread.id).toBe(defThread.id);

      // Create explicit thread
      const custom = await chat.createThread('Planejamento Semanal');
      expect(custom.title).toBe('PLANEJAMENTO SEMANAL');
      expect(await chat.listThreads()).toHaveLength(2);

      // Get thread by id
      const fetched = await chat.getThread(custom.id);
      expect(fetched?.id).toBe(custom.id);
      expect(fetched?.title).toBe('PLANEJAMENTO SEMANAL');
    } finally {
      await close();
    }
  });

  it('adds and lists messages (USER, ASSISTANT, SYSTEM) in chronological order', async () => {
    const { chat, close } = await setup();
    try {
      const thread = await chat.createThread('Conversa');

      const msgUser = await chat.addMessage({
        threadId: thread.id,
        role: 'USER',
        content: 'Olá assistente!',
      });
      expect(msgUser.id).toBeDefined();
      expect(msgUser.role).toBe('USER');
      expect(msgUser.content).toBe('Olá assistente!');
      expect(msgUser.threadId).toBe(thread.id);

      const msgAi = await chat.addMessage({
        threadId: thread.id,
        role: 'ASSISTANT',
        content: 'Olá! Como posso ajudar você hoje?',
      });
      expect(msgAi.role).toBe('ASSISTANT');

      const msgSys = await chat.addMessage({
        threadId: thread.id,
        role: 'SYSTEM',
        content: 'Contexto de fuso America/Recife.',
      });
      expect(msgSys.role).toBe('SYSTEM');

      const messages = await chat.listMessages(thread.id);
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT', 'SYSTEM']);
      expect(messages.map((m) => m.content)).toEqual([
        'Olá assistente!',
        'Olá! Como posso ajudar você hoje?',
        'Contexto de fuso America/Recife.',
      ]);
    } finally {
      await close();
    }
  });

  it('validates empty content and non-existent thread', async () => {
    const { chat, close } = await setup();
    try {
      const thread = await chat.createThread('Teste');

      await expect(
        chat.addMessage({
          threadId: thread.id,
          role: 'USER',
          content: '   ',
        }),
      ).rejects.toThrow();

      await expect(
        chat.addMessage({
          threadId: 'non-existent-id',
          role: 'USER',
          content: 'Validação de FK',
        }),
      ).rejects.toThrow();
    } finally {
      await close();
    }
  });

  it('deletes message and clears thread messages', async () => {
    const { chat, close } = await setup();
    try {
      const thread = await chat.createThread('Teste Limpeza');
      const m1 = await chat.addMessage({ threadId: thread.id, role: 'USER', content: 'M1' });
      const m2 = await chat.addMessage({ threadId: thread.id, role: 'ASSISTANT', content: 'M2' });

      await chat.deleteMessage(m1.id);
      let msgs = await chat.listMessages(thread.id);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe(m2.id);

      await chat.clearThreadMessages(thread.id);
      msgs = await chat.listMessages(thread.id);
      expect(msgs).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it('cascades message deletion when a thread is deleted', async () => {
    const { chat, close } = await setup();
    try {
      const thread = await chat.createThread('Thread Deletada');
      await chat.addMessage({ threadId: thread.id, role: 'USER', content: 'Msg a ser cascateada' });

      expect(await chat.listMessages(thread.id)).toHaveLength(1);

      await chat.deleteThread(thread.id);
      expect(await chat.getThread(thread.id)).toBeNull();
      expect(await chat.listMessages(thread.id)).toHaveLength(0);
    } finally {
      await close();
    }
  });
});
