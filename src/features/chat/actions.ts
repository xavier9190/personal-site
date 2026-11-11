'use server';

import { revalidatePath } from 'next/cache';
import { ChatService } from './service';

export interface ActionResult {
  ok: boolean;
  error?: string;
  threadId?: string;
}

export async function createNewThreadAction(title?: string): Promise<ActionResult> {
  try {
    const service = new ChatService();
    const thread = service.createThread(title);
    revalidatePath('/');
    return { ok: true, threadId: thread.id };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO CRIAR CONVERSA',
    };
  }
}

export async function clearThreadMessagesAction(threadId: string): Promise<ActionResult> {
  try {
    const service = new ChatService();
    service.clearThreadMessages(threadId);
    revalidatePath('/');
    return { ok: true, threadId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO LIMPAR MENSAGENS',
    };
  }
}
