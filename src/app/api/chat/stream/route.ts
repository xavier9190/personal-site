import { NextRequest } from 'next/server';
import { ChatService } from '@/features/chat/service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { AntigravityAIProvider } from '@/features/chat/ai/provider';
import { buildChatContext } from '@/features/chat/ai/context';
import type { AIMessageInput } from '@/features/chat/ai/types';
import { detectToolIntent, type ChatAttachment } from '@/features/chat/ai/intent';
import { executeChatTool, type ToolExecutionResult } from '@/features/chat/tools/dispatcher';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
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

    const effectiveMessage = message || (attachments.length > 0 ? `[ANEXO ENVIADO: ${attachments.map((a) => a.name).join(', ')}]` : '');

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
      content: effectiveMessage,
      attachmentsJson: JSON.stringify(attachments),
    });

    // Detect tool intent (from text and/or attachments)
    const detected = detectToolIntent(effectiveMessage, attachments);
    let executedToolCall: ToolExecutionResult | null = null;
    let toolPrefix = '';

    if (detected) {
      try {
        executedToolCall = await executeChatTool(detected.toolName, detected.args, {
          threadId: thread.id,
        });

        if (executedToolCall.status === 'PENDING_CONFIRMATION') {
          toolPrefix = `ATENÇÃO: AÇÃO DESTRUTIVA IDENTIFICADA.\n${executedToolCall.description}.\nPOR MOTIVOS DE SEGURANÇA, ESTA AÇÃO EXIGE SUA CONFIRMAÇÃO ABAIXO:`;
        } else if (executedToolCall.status === 'CONFIRMED') {
          toolPrefix = `AÇÃO EXECUTADA COM SUCESSO!\n${executedToolCall.description}.\nVOCÊ PODE DESFAZER ESSA AÇÃO CLICANDO EM [DESFAZER] NO CARD ABAIXO.`;
        } else if (executedToolCall.status === 'READ_SUCCESS') {
          toolPrefix = `CONSULTA CONCLUÍDA:\n${executedToolCall.description}`;
        }
      } catch (toolErr) {
        toolPrefix = `ERRO AO EXECUTAR AÇÃO: ${toolErr instanceof Error ? toolErr.message : 'FALHA INTERNA'}`;
      }
    }

    const threadMessages = chatService.listMessages(thread.id);
    const aiMessages: AIMessageInput[] = threadMessages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content,
    }));

    const context = buildChatContext(calendarService, financesService);
    const aiProvider = new AntigravityAIProvider();

    const encoder = new TextEncoder();
    let accumulatedContent = '';

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send initial metadata event with threadId and userMsg
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'start',
                threadId: thread.id,
                userMessage: userMsg,
                toolCall: executedToolCall,
              })}\n\n`,
            ),
          );

          if (toolPrefix) {
            // Stream the tool explanation prefix directly
            const words = toolPrefix.split(' ');
            for (let i = 0; i < words.length; i++) {
              const piece = (i > 0 ? ' ' : '') + words[i];
              accumulatedContent += piece;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', token: piece })}\n\n`),
              );
              if (process.env.NODE_ENV !== 'test') {
                await new Promise((r) => setTimeout(r, 15));
              }
            }
          } else {
            // Standard conversational streaming
            const stream = aiProvider.generateStream(aiMessages, context);
            for await (const token of stream) {
              accumulatedContent += token;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'token', token })}\n\n`),
              );
            }
          }

          const toolCalls = executedToolCall ? [executedToolCall] : [];

          // Persist ASSISTANT message
          const assistantMsg = chatService.addMessage({
            threadId: thread.id,
            role: 'ASSISTANT',
            content: accumulatedContent,
            toolCallsJson: JSON.stringify(toolCalls),
          });

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: 'done',
                assistantMessage: assistantMsg,
                toolCalls,
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
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : 'ERRO INTERNO' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
}
