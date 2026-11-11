export interface ChatContext {
  currentDateRecife: string;
  currentTimeRecife: string;
  timeZone: 'America/Recife';
  summaryUpcomingEvents?: string;
  summaryFinances?: string;
  systemPrompt: string;
}

export interface AIMessageInput {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AIProvider {
  generateStream(
    messages: AIMessageInput[],
    context: ChatContext,
  ): AsyncIterable<string>;
}
