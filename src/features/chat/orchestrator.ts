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
  AIToolCallRequest,
  AIToolResultInput,
} from './ai/types';
import type { PendingActionStatus } from './schema';
import { ChatService, type ChatMessageRecord, type PendingToolActionRecord } from './service';
import { getActionCatalogEntry, getGeminiFunctionDeclarations } from './tools/catalog';
import type { ActionCatalogEntry } from './tools/catalog/types';
import { ChatToolDispatcher, type ToolExecutionResult } from './tools/dispatcher';
import {
  buildActiveDraftContext,
  formatDraftDescription,
  inspectActionSlots,
  isExplicitDraftCancellation,
  mergeDraftArgs,
  safeParseArgsJson,
  type DraftSummary,
} from './tools/slots';

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
  resolvedActionStatuses: Record<string, PendingActionStatus>;
  streamTokens: AsyncIterable<string>;
}

function buildDraftToolOutputs(
  actionId: string,
  entry: ActionCatalogEntry,
  collectedArgs: Record<string, unknown>,
  missingFields: string[],
  missingFieldLabels: string[],
  draftSummary: DraftSummary,
): { cardResult: ToolExecutionResult; modelResult: AIToolResultInput } {
  const description = formatDraftDescription(entry, missingFields);
  return {
    cardResult: {
      toolName: entry.name,
      status: 'DRAFTING',
      actionId,
      description,
      isDestructive: false,
      draftArgs: collectedArgs,
      missingFields,
      missingFieldLabels,
      draftSummary,
    },
    modelResult: {
      toolName: entry.name,
      status: 'DRAFTING',
      description,
      missingFieldLabels,
      data: {
        collectedArgs,
        missingFields: missingFieldLabels,
      },
    },
  };
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

    let activeDraft = await this.chatService.getActiveDraft(thread.id);
    if (activeDraft && isExplicitDraftCancellation(effectiveMessage)) {
      const cancelled = await this.chatService.cancelActiveDraft(thread.id);
      const draftEntry = getActionCatalogEntry(activeDraft.toolName);
      const cancelReply = `RASCUNHO CANCELADO! (${draftEntry?.displayName ?? activeDraft.toolName}). COMO POSSO AJUDAR AGORA?`;
      return {
        threadId: thread.id,
        userMessage,
        toolCalls: [],
        resolvedActionStatuses: cancelled ? { [cancelled.id]: 'CANCELLED' } : {},
        streamTokens: streamTextByWords(cancelReply),
      };
    }

    const threadMessages = await this.chatService.listMessages(thread.id);
    const aiMessages: AIMessageInput[] = threadMessages.map((m) => ({
      role: m.role.toLowerCase() as 'user' | 'assistant' | 'system',
      content: m.content,
      attachments: m.id === userMessage.id ? attachments : undefined,
    }));

    const activeDraftContext = buildActiveDraftContext(activeDraft);
    const context = await buildChatContext(
      this.calendarService,
      this.financesService,
      input.referenceDate,
      activeDraftContext,
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
        resolvedActionStatuses: {},
        streamTokens: directText
          ? streamTextByWords(directText)
          : this.aiProvider.generateStream(aiMessages, context),
      };
    }

    const { executedToolCalls, toolResultsForModel, resolvedActionStatuses } =
      await this.executeToolCallsWithDrafting(
        firstTurn.toolCalls,
        thread.id,
        context.currentDateRecife,
        activeDraft,
      );

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
      resolvedActionStatuses,
      streamTokens: streamTextByWords(finalReplyText),
    };
  }

  private async executeToolCallsWithDrafting(
    toolCalls: AIToolCallRequest[],
    threadId: string,
    currentDateRecife: string,
    initialDraft: PendingToolActionRecord | null,
  ): Promise<{
    executedToolCalls: ToolExecutionResult[];
    toolResultsForModel: AIToolResultInput[];
    resolvedActionStatuses: Record<string, PendingActionStatus>;
  }> {
    const executedToolCalls: ToolExecutionResult[] = [];
    const toolResultsForModel: AIToolResultInput[] = [];
    const resolvedActionStatuses: Record<string, PendingActionStatus> = {};
    let activeDraft = initialDraft;

    // Topic switching mid-draft: if no emitted tool matches the active draft, cancel it first
    if (activeDraft && !toolCalls.some((tc) => tc.name === activeDraft!.toolName)) {
      const cancelled = await this.chatService.cancelActiveDraft(threadId);
      if (cancelled) {
        resolvedActionStatuses[cancelled.id] = 'CANCELLED';
      }
      activeDraft = null;
    }

    for (const tc of toolCalls) {
      try {
        const entry = getActionCatalogEntry(tc.name);
        const isContinuingDraft = Boolean(entry && activeDraft && activeDraft.toolName === tc.name);
        const isMutatingWithSlots = Boolean(
          entry && (entry.operation === 'create' || entry.operation === 'update'),
        );

        let argsToExecute: unknown = tc.args;
        let draftActionId: string | undefined;

        if (entry && (isContinuingDraft || isMutatingWithSlots)) {
          const candidateArgs = isContinuingDraft
            ? mergeDraftArgs(tc.name, safeParseArgsJson(activeDraft!.argsJson), tc.args)
            : tc.args;
          const slotCheck = inspectActionSlots(entry, candidateArgs, { currentDateRecife });

          if (slotCheck.status === 'INCOMPLETE') {
            if (!isContinuingDraft && activeDraft) {
              const errorMessage = `JÁ EXISTE UM RASCUNHO ATIVO (${activeDraft.toolName}). CONCLUA OU CANCELE O RASCUNHO ATUAL ANTES DE INICIAR OUTRO.`;
              toolResultsForModel.push({
                callId: tc.id,
                toolName: tc.name,
                status: 'ERROR',
                description: errorMessage,
                error: errorMessage,
              });
              continue;
            }

            activeDraft = isContinuingDraft
              ? await this.chatService.updateDraft(activeDraft!.id, {
                  argsJson: JSON.stringify(slotCheck.collectedArgs),
                  missingFieldsJson: JSON.stringify(slotCheck.missingFields),
                })
              : await this.chatService.upsertActiveDraft({
                  threadId,
                  toolName: tc.name,
                  argsJson: JSON.stringify(slotCheck.collectedArgs),
                  missingFieldsJson: JSON.stringify(slotCheck.missingFields),
                });

            const { cardResult, modelResult } = buildDraftToolOutputs(
              activeDraft.id,
              entry,
              slotCheck.collectedArgs,
              slotCheck.missingFields,
              slotCheck.missingFieldLabels,
              slotCheck.draftSummary,
            );
            modelResult.callId = tc.id;
            executedToolCalls.push(cardResult);
            toolResultsForModel.push(modelResult);
            resolvedActionStatuses[activeDraft.id] = 'DRAFTING';
            continue;
          }

          if (slotCheck.status === 'INVALID') {
            const errorMessage = extractReadableError(slotCheck.zodError, tc.name);
            toolResultsForModel.push({
              callId: tc.id,
              toolName: tc.name,
              status: 'ERROR',
              description: `ERRO AO EXECUTAR ${tc.name}: ${errorMessage}`,
              error: errorMessage,
            });
            continue;
          }

          argsToExecute = slotCheck.preparedArgs;
          if (isContinuingDraft) {
            draftActionId = activeDraft!.id;
            activeDraft = null;
          }
        }

        const res = await this.dispatcher.execute(tc.name, argsToExecute, {
          threadId,
          currentDateRecife,
          draftActionId,
        });
        if (res.actionId && res.status !== 'READ_SUCCESS') {
          resolvedActionStatuses[res.actionId] = res.status as PendingActionStatus;
        }
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

    return {
      executedToolCalls,
      toolResultsForModel,
      resolvedActionStatuses,
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
