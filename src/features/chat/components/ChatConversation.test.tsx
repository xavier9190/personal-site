import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

import {
  ChatConversation,
  extractToolCallsFromSsePayload,
  StreamingToolCallsPreview,
  type ToolCallCardData,
} from './ChatConversation';
import type { ChatMessageRecord } from '../service';

describe('ChatConversation multi-tool cards & SSE stream payloads', () => {
  it('extracts multiple tool calls from SSE start/done payloads and preserves single toolCall fallback', () => {
    const first: ToolCallCardData = {
      actionId: 'a-1',
      toolName: 'createCalendarEvent',
      description: 'CRIOU EVENTO: DENTISTA (2026-11-20)',
      isDestructive: false,
      status: 'CONFIRMED',
    };
    const second: ToolCallCardData = {
      actionId: 'a-2',
      toolName: 'deleteCalendarEvent',
      description: 'EXCLUIR EVENTO: REUNIÃO ANTIGA (2026-11-21)',
      isDestructive: true,
      status: 'PENDING_CONFIRMATION',
    };

    expect(extractToolCallsFromSsePayload({ toolCalls: [first, second], toolCall: first })).toEqual([
      first,
      second,
    ]);
    expect(extractToolCallsFromSsePayload({ toolCall: first })).toEqual([first]);
    expect(extractToolCallsFromSsePayload({})).toEqual([]);
  });

  it('renders multiple finalized tool cards (Undo + Delete Confirmation + Read) inside a single assistant message', () => {
    const toolCalls: ToolCallCardData[] = [
      {
        actionId: 'act-create',
        toolName: 'createCalendarEvent',
        description: 'CRIOU EVENTO: DENTISTA (2026-11-20)',
        isDestructive: false,
        status: 'CONFIRMED',
      },
      {
        actionId: 'act-wish',
        toolName: 'addWishlistItem',
        description: 'ADICIONOU À WISHLIST: CAFÉ ESPECIAL (R$ 38,00)',
        isDestructive: false,
        status: 'CONFIRMED',
      },
      {
        actionId: 'act-del',
        toolName: 'deleteCalendarEvent',
        description: 'EXCLUIR EVENTO: REUNIÃO ANTIGA (2026-11-21)',
        isDestructive: true,
        status: 'PENDING_CONFIRMATION',
      },
      {
        toolName: 'listCalendarItems',
        description: 'CONSULTA CALENDÁRIO: 2 ITENS ENCONTRADOS',
        isDestructive: false,
        status: 'READ_SUCCESS',
      },
    ];

    const messages: ChatMessageRecord[] = [
      {
        id: 'm-user',
        threadId: 't-1',
        role: 'USER',
        content: 'MARCA DENTISTA, BOTA CAFÉ NA WISHLIST E APAGA REUNIÃO ANTIGA',
        attachmentsJson: '[]',
        toolCallsJson: '[]',
        createdAt: '2026-11-20T15:00:00.000Z',
      },
      {
        id: 'm-assistant',
        threadId: 't-1',
        role: 'ASSISTANT',
        content: 'AÇÕES PROCESSADAS.',
        attachmentsJson: '[]',
        toolCallsJson: JSON.stringify(toolCalls),
        createdAt: '2026-11-20T15:00:02.000Z',
      },
    ];

    const html = renderToStaticMarkup(
      <ChatConversation initialThreadId="t-1" initialMessages={messages} />,
    );

    expect(html).toContain('CRIOU EVENTO: DENTISTA (2026-11-20)');
    expect(html).toContain('ADICIONOU À WISHLIST: CAFÉ ESPECIAL (R$ 38,00)');
    expect(html).toContain('EXCLUIR EVENTO: REUNIÃO ANTIGA (2026-11-21)');
    expect(html).toContain('CONSULTA CALENDÁRIO: 2 ITENS ENCONTRADOS');
    expect(html).toContain('CONSULTA CONCLUÍDA');
    expect(html).toContain('CONFIRMAÇÃO NECESSÁRIA');
    expect(html).toContain('CONFIRMAR EXCLUSÃO');
    expect(html).toContain('CANCELAR');

    const undoCount = html.match(/DESFAZER/g)?.length ?? 0;
    expect(undoCount).toBe(2);
  });

  it('renders all streaming tool call previews during an active multi-intent stream', () => {
    const html = renderToStaticMarkup(
      <StreamingToolCallsPreview
        toolCalls={[
          {
            actionId: 's-1',
            toolName: 'createCalendarEvent',
            description: 'CRIOU EVENTO: DENTISTA (2026-11-20)',
            isDestructive: false,
            status: 'CONFIRMED',
          },
          {
            actionId: 's-2',
            toolName: 'deleteCalendarEvent',
            description: 'EXCLUIR EVENTO: REUNIÃO ANTIGA (2026-11-21)',
            isDestructive: true,
            status: 'PENDING_CONFIRMATION',
          },
        ]}
      />,
    );

    expect(html).toContain('CRIOU EVENTO: DENTISTA (2026-11-20)');
    expect(html).toContain('EXCLUIR EVENTO: REUNIÃO ANTIGA (2026-11-21)');
    expect(html).toContain('PROCESSANDO:');
    expect(html).toContain('AGUARDANDO CONFIRMAÇÃO:');
  });
});
