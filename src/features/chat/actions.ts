'use server';

import { revalidatePath } from 'next/cache';
import { ChatService } from './service';
import {
  cancelPendingAction,
  confirmPendingAction,
  executeChatTool,
  undoChatAction,
} from './tools/dispatcher';

export interface ActionResult {
  ok: boolean;
  error?: string;
  threadId?: string;
  data?: any;
}

function revalidateAllModules() {
  revalidatePath('/');
  revalidatePath('/financas');
  revalidatePath('/calendario');
  revalidatePath('/academico');
  revalidatePath('/compras');
}

export async function createNewThreadAction(title?: string): Promise<ActionResult> {
  try {
    const service = new ChatService();
    const thread = service.createThread(title);
    revalidateAllModules();
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
    revalidateAllModules();
    return { ok: true, threadId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO LIMPAR MENSAGENS',
    };
  }
}

export async function confirmPendingActionAction(actionId: string): Promise<ActionResult> {
  try {
    const result = confirmPendingAction(actionId);
    revalidateAllModules();
    return { ok: result.ok, error: result.ok ? undefined : result.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO CONFIRMAR EXCLUSÃO',
    };
  }
}

export async function cancelPendingActionAction(actionId: string): Promise<ActionResult> {
  try {
    const result = cancelPendingAction(actionId);
    revalidateAllModules();
    return { ok: result.ok, error: result.ok ? undefined : result.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO CANCELAR AÇÃO',
    };
  }
}

export async function undoActionAction(actionId: string): Promise<ActionResult> {
  try {
    const result = undoChatAction(actionId);
    revalidateAllModules();
    return { ok: result.ok, error: result.ok ? undefined : result.message };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO DESFAZER AÇÃO',
    };
  }
}

export async function executeDirectToolAction(
  threadId: string,
  toolName: string,
  rawArgs: unknown,
): Promise<ActionResult> {
  try {
    const result = await executeChatTool(toolName, rawArgs, { threadId });
    revalidateAllModules();
    return { ok: true, data: result };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'ERRO AO EXECUTAR TOOL',
    };
  }
}
