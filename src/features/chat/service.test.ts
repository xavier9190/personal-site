import { describe, expect, it } from 'vitest';
import { createDbClient } from '@/db';
import { ChatService } from './service';

function setup() {
  const { db, close } = createDbClient(':memory:');
  return {
    close,
    chat: new ChatService(db),
  };
}

describe('ChatService (SQLite persistence, threads, messages CRUD)', () => {
  it('creates and lists threads, getting or creating default thread', () => {
    const { chat, close } = setup();
    try {
      expect(chat.listThreads()).toHaveLength(0);

      // getOrCreateDefaultThread creates one if none exists
      const defThread = chat.getOrCreateDefaultThread();
      expect(defThread.id).toBeDefined();
      expect(defThread.title).toBe('CONVERSA PRINCIPAL');
      expect(chat.listThreads()).toHaveLength(1);

      // Calling again returns the existing one
      const sameThread = chat.getOrCreateDefaultThread();
      expect(sameThread.id).toBe(defThread.id);

      // Create explicit thread
      const custom = chat.createThread('Planejamento Semanal');
      expect(custom.title).toBe('PLANEJAMENTO SEMANAL');
      expect(chat.listThreads()).toHaveLength(2);

      // Get thread by id
      const fetched = chat.getThread(custom.id);
      expect(fetched?.id).toBe(custom.id);
      expect(fetched?.title).toBe('PLANEJAMENTO SEMANAL');
    } finally {
      close();
    }
  });

  it('adds and lists messages (USER, ASSISTANT, SYSTEM) in chronological order', () => {
    const { chat, close } = setup();
    try {
      const thread = chat.createThread('Conversa');

      const msgUser = chat.addMessage({
        threadId: thread.id,
        role: 'USER',
        content: 'Olá assistente!',
      });
      expect(msgUser.id).toBeDefined();
      expect(msgUser.role).toBe('USER');
      expect(msgUser.content).toBe('Olá assistente!');
      expect(msgUser.threadId).toBe(thread.id);

      const msgAi = chat.addMessage({
        threadId: thread.id,
        role: 'ASSISTANT',
        content: 'Olá! Como posso ajudar você hoje?',
      });
      expect(msgAi.role).toBe('ASSISTANT');

      const msgSys = chat.addMessage({
        threadId: thread.id,
        role: 'SYSTEM',
        content: 'Contexto de fuso America/Recife.',
      });
      expect(msgSys.role).toBe('SYSTEM');

      const messages = chat.listMessages(thread.id);
      expect(messages).toHaveLength(3);
      expect(messages.map((m) => m.role)).toEqual(['USER', 'ASSISTANT', 'SYSTEM']);
      expect(messages.map((m) => m.content)).toEqual([
        'Olá assistente!',
        'Olá! Como posso ajudar você hoje?',
        'Contexto de fuso America/Recife.',
      ]);
    } finally {
      close();
    }
  });

  it('validates empty content and non-existent thread', () => {
    const { chat, close } = setup();
    try {
      const thread = chat.createThread('Teste');

      expect(() =>
        chat.addMessage({
          threadId: thread.id,
          role: 'USER',
          content: '   ',
        }),
      ).toThrow();

      expect(() =>
        chat.addMessage({
          threadId: 'non-existent-id',
          role: 'USER',
          content: 'Validação de FK',
        }),
      ).toThrow();
    } finally {
      close();
    }
  });

  it('deletes message and clears thread messages', () => {
    const { chat, close } = setup();
    try {
      const thread = chat.createThread('Teste Limpeza');
      const m1 = chat.addMessage({ threadId: thread.id, role: 'USER', content: 'M1' });
      const m2 = chat.addMessage({ threadId: thread.id, role: 'ASSISTANT', content: 'M2' });

      chat.deleteMessage(m1.id);
      let msgs = chat.listMessages(thread.id);
      expect(msgs).toHaveLength(1);
      expect(msgs[0].id).toBe(m2.id);

      chat.clearThreadMessages(thread.id);
      msgs = chat.listMessages(thread.id);
      expect(msgs).toHaveLength(0);
    } finally {
      close();
    }
  });

  it('cascades message deletion when a thread is deleted', () => {
    const { chat, close } = setup();
    try {
      const thread = chat.createThread('Thread Deletada');
      chat.addMessage({ threadId: thread.id, role: 'USER', content: 'Msg a ser cascateada' });

      expect(chat.listMessages(thread.id)).toHaveLength(1);

      chat.deleteThread(thread.id);
      expect(chat.getThread(thread.id)).toBeNull();
      expect(chat.listMessages(thread.id)).toHaveLength(0);
    } finally {
      close();
    }
  });
});
