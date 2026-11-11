import { NextRequest } from 'next/server';
import { ChatService } from '@/features/chat/service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { AntigravityAIProvider } from '@/features/chat/ai/provider';
import { buildChatContext } from '@/features/chat/ai/context';
import type { AIMessageInput } from '@/features/chat/ai/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return new Response(JSON.stringify({ error: 'MENSAGEM NÃO PODE SER VAZIA' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const chatService = new ChatService();
    const calendarService = new CalendarService();
    const financesService = new FinancesService();

    const thread = body.threadId
      ? chatService.getThread(body.threadId) ?? chatService.getOrCreateDefaultThread()
      : chatService.getOrCreateDefaultThread();

    // Persist USER message
    const userMsg = chatService.addMessage({
      threadId: thread.id,
      role: 'USER',
      content: message,
    });

    const threadMessages = chatService.listMessages(thread.id);
    const aiMessages: AIMessageInput[] = threadMessages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const context = buildChatContext(calendarService, financesService);
    const aiProvider = new AntigravityAIProvider();
    const stream = aiProvider.generateStream(aiMessages, context);

    const encoder = new TextEncoder();
    let accumulatedContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata event with threadId and userMsgId
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'start', threadId: thread.id, userMessage: userMsg })}\n\n`,
            ),
          );

          for await (const token of stream) {
            accumulatedContent += token;
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'token', token })}\n\n`),
            );
          }

          // Persist ASSISTANT message
          const assistantMsg = chatService.addMessage({
            threadId: thread.id,
            role: 'ASSISTANT',
            content: accumulatedContent,
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: 'done', assistantMessage: assistantMsg })}\n\n`,
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'ERRO INTERNO' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
