import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { buildChatContext } from './ai/context';
import type { ChatAttachment } from './ai/intent';
import { formatToolExecutionSummary, getAIProvider } from './ai/provider';
import type {
  AIMessageInput,
  AIProvider,
  AIToolResultInput,
} from './ai/types';
import { ChatService, type ChatMessageRecord } from './service';
import { getActionCatalogEntry, getGeminiFunctionDeclarations } from './tools/catalog';
import { ChatToolDispatcher, type ToolExecutionResult } from './tools/dispatcher';

export interface ChatTurnOrchestratorDeps {
  db?: AppDatabase;
  aiProvider?: AIProvider;
  dispatcher?: ChatToolDispatcher;
  chatService?: ChatService;
  calendarService?: CalendarService;
  financesService?: FinancesService;
}

export interface RunChatTurnInput {
  threadId?: string;
  message: string;
  attachments?: ChatAttachment[];
  referenceDate?: Date;
}

export interface PreparedChatTurn {
  threadId: string;
  userMessage: ChatMessageRecord;
  toolCalls: ToolExecutionResult[];
  streamTokens: AsyncIterable<string>;
}

function extractReadableError(err: unknown, toolName?: string): string {
  if (err && typeof err === 'object') {
    const issues = (
      err as {
        issues?: Array<{ message?: string; code?: string; path?: Array<string | number> }>;
      }
    ).issues;
    if (Array.isArray(issues) && issues.length > 0) {
      const entry = toolName ? getActionCatalogEntry(toolName) : undefined;
      return issues
        .map((issue) => {
          const fieldKey = issue.path?.[0] !== undefined ? String(issue.path[0]) : undefined;
          const fieldLabel = fieldKey ? entry?.fields[fieldKey]?.label ?? fieldKey.toUpperCase() : undefined;
          if (
            fieldLabel &&
            issue.message &&
            (issue.code === 'invalid_type' || issue.message.startsWith('Invalid input'))
          ) {
            return `${fieldLabel} OBRIGATÓRIO`;
          }
          return issue.message;
        })
        .filter((m): m is string => Boolean(m))
        .join('; ');
    }
  }
  if (err instanceof Error) {
    return err.message;
  }
  return 'FALHA INTERNA';
}

async function* streamTextByWords(text: string): AsyncIterable<string> {
  const words = text.split(' ');
  for (let i = 0; i < words.length; i++) {
    const piece = (i > 0 ? ' ' : '') + words[i];
    yield piece;
    if (process.env.NODE_ENV !== 'test') {
      await new Promise((r) => setTimeout(r, 15));
    }
  }
}

export class ChatTurnOrchestrator {
  private readonly db: AppDatabase;
  private readonly aiProvider: AIProvider;
  private readonly dispatcher: ChatToolDispatcher;
  private readonly chatService: ChatService;
  private readonly calendarService: CalendarService;
  private readonly financesService: FinancesService;

  constructor(deps: ChatTurnOrchestratorDeps = {}) {
    this.db = deps.db ?? getDb();
    this.aiProvider = deps.aiProvider ?? getAIProvider();
    this.dispatcher = deps.dispatcher ?? new ChatToolDispatcher(this.db);
    this.chatService = deps.chatService ?? new ChatService(this.db);
    this.calendarService = deps.calendarService ?? new CalendarService(this.db);
    this.financesService = deps.financesService ?? new FinancesService(this.db);
  }

  async prepareTurn(input: RunChatTurnInput): Promise<PreparedChatTurn> {
    const attachments = input.attachments ?? [];
    const trimmedMessage = input.message.trim();
    const effectiveMessage =
      trimmedMessage ||
      (attachments.length > 0
        ? `[ANEXO ENVIADO: ${attachments.map((a) => a.name).join(', ')}]`
        : '');

    const thread = input.threadId
      ? (await this.chatService.getThread(input.threadId)) ??
        (await this.chatService.getOrCreateDefaultThread())
      : await this.chatService.getOrCreateDefaultThread();

    const userMessage = await this.chatService.addMessage({
      threadId: thread.id,
      role: 'USER',
      content: effectiveMessage,
      attachmentsJson: JSON.stringify(attachments),
    });

    const threadMessages = await this.chatService.listMessages(thread.id);
    const aiMessages: AIMessageInput[] = threadMessages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content,
      attachments: m.id === userMessage.id ? attachments : undefined,
    }));

    const context = await buildChatContext(
      this.calendarService,
      this.financesService,
      input.referenceDate,
    );

    const declarations = getGeminiFunctionDeclarations();
    const firstTurn = await this.aiProvider.generateTurn({
      messages: aiMessages,
      context,
      tools: declarations,
    });

    if (firstTurn.toolCalls.length === 0) {
      const directText = firstTurn.text.trim();
      return {
        threadId: thread.id,
        userMessage,
        toolCalls: [],
        streamTokens: directText
          ? streamTextByWords(directText)
          : this.aiProvider.generateStream(aiMessages, context),
      };
    }

    const executedToolCalls: ToolExecutionResult[] = [];
    const toolResultsForModel: AIToolResultInput[] = [];

    for (const tc of firstTurn.toolCalls) {
      try {
        const res = await this.dispatcher.execute(tc.name, tc.args, {
          threadId: thread.id,
          currentDateRecife: context.currentDateRecife,
        });
        executedToolCalls.push(res);
        toolResultsForModel.push({
          callId: tc.id,
          toolName: tc.name,
          status: res.status,
          description: res.description,
          data: res.data,
        });
      } catch (err) {
        const errorMessage = extractReadableError(err, tc.name);
        toolResultsForModel.push({
          callId: tc.id,
          toolName: tc.name,
          status: 'ERROR',
          description: `ERRO AO EXECUTAR ${tc.name}: ${errorMessage}`,
          error: errorMessage,
        });
      }
    }

    const hasReadCall = executedToolCalls.some((r) => r.status === 'READ_SUCCESS');
    const hasErrors = toolResultsForModel.some((r) => r.status === 'ERROR');

    let finalReplyText = '';
    if (firstTurn.text.trim().length > 0 && !hasReadCall && !hasErrors) {
      finalReplyText = firstTurn.text.trim();
    } else {
      const followUpTurn = await this.aiProvider.generateTurn({
        messages: aiMessages,
        context,
        tools: [],
        toolResults: toolResultsForModel,
        priorTurn: {
          toolCalls: firstTurn.toolCalls,
          rawModelContent: firstTurn.rawModelContent,
        },
      });
      finalReplyText =
        followUpTurn.text.trim() || formatToolExecutionSummary(toolResultsForModel);
    }

    return {
      threadId: thread.id,
      userMessage,
      toolCalls: executedToolCalls,
      streamTokens: streamTextByWords(finalReplyText),
    };
  }

  async finalizeAssistantMessage(
    threadId: string,
    content: string,
    toolCalls: ToolExecutionResult[],
  ): Promise<ChatMessageRecord> {
    const safeContent = content.trim() || 'COMANDO PROCESSADO.';
    return this.chatService.addMessage({
      threadId,
      role: 'ASSISTANT',
      content: safeContent,
      toolCallsJson: JSON.stringify(toolCalls),
    });
  }
}
