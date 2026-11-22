import type { FunctionDeclaration } from '@google/genai';
import type { ChatAttachment } from './intent';

export interface ActiveDraftContext {
  actionId: string;
  toolName: string;
  displayName: string;
  entityLabel: string;
  collectedArgs: Record<string, unknown>;
  missingFields: Array<{
    name: string;
    label: string;
    description: string;
  }>;
}

export interface ChatContext {
  currentDateRecife: string;
  currentTimeRecife: string;
  timeZone: 'America/Recife';
  summaryUpcomingEvents?: string;
  summaryFinances?: string;
  activeDraft?: ActiveDraftContext | null;
  systemPrompt: string;
}

export interface AIMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
  attachments?: ChatAttachment[];
}

export interface AIToolCallRequest {
  id?: string;
  name: string;
  args: Record<string, unknown>;
}

export interface AIToolResultInput {
  toolName: string;
  callId?: string;
  status: 'DRAFTING' | 'CONFIRMED' | 'PENDING_CONFIRMATION' | 'READ_SUCCESS' | 'ERROR';
  description: string;
  data?: unknown;
  error?: string;
  missingFieldLabels?: string[];
}

export interface GenerateTurnInput {
  messages: AIMessageInput[];
  context: ChatContext;
  tools: FunctionDeclaration[];
  toolResults?: AIToolResultInput[];
  priorTurn?: {
    toolCalls: AIToolCallRequest[];
    rawModelContent?: unknown;
  };
}

export interface GenerateTurnOutput {
  text: string;
  toolCalls: AIToolCallRequest[];
  rawModelContent?: unknown;
  source?: 'gemini' | 'worker' | 'fallback' | 'mock';
}

export interface AIProvider {
  generateStream(
    messages: AIMessageInput[],
    context: ChatContext,
  ): AsyncIterable<string>;

  generateTurn(input: GenerateTurnInput): Promise<GenerateTurnOutput>;
}
