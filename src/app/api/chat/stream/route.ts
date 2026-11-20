import { NextRequest } from 'next/server';
import { requireSessionAuth, UnauthorizedSessionError } from '@/lib/session-auth';
import type { ChatAttachment } from '@/features/chat/ai/intent';
import { ChatTurnOrchestrator } from '@/features/chat/orchestrator';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await requireSessionAuth(req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    const attachments: ChatAttachment[] = Array.isArray(body.attachments)
      ? body.attachments
      : [];

    if (!message && attachments.length === 0) {
      return new Response(JSON.stringify({ error: 'MENSAGEM NÃO PODE SER VAZIA' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const orchestrator = new ChatTurnOrchestrator();
    const prepared = await orchestrator.prepareTurn({
      threadId: typeof body.threadId === 'string' ? body.threadId : undefined,
      message,
      attachments,
    });

    const encoder = new TextEncoder();
    let accumulatedContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'start',
                threadId: prepared.threadId,
                userMessage: prepared.userMessage,
                toolCall: prepared.toolCalls[0] ?? null,
                toolCalls: prepared.toolCalls,
              })}\n\n`,
            ),
          );

          for await (const token of prepared.streamTokens) {
            accumulatedContent += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'token', token })}\n\n`),
            );
          }

          const assistantMsg = await orchestrator.finalizeAssistantMessage(
            prepared.threadId,
            accumulatedContent,
            prepared.toolCalls,
          );

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                assistantMessage: assistantMsg,
                toolCalls: prepared.toolCalls,
              })}\n\n`,
            ),
          );
          controller.close();
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'ERRO AO TRANSMITIR RESPOSTA';
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: 'error', error: errorMsg })}\n\n`),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
      },
    });
  } catch (err) {
    if (err instanceof UnauthorizedSessionError) {
      return new Response(JSON.stringify({ ok: false, error: err.message }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'ERRO INTERNO' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
