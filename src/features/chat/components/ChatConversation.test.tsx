import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { setDbForTesting } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import ChatPage from '@/app/page';

globalThis.React = React;

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
import { ChatService, type ChatMessageRecord } from '../service';

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

  it('renders a compact Sketch Draft Card with collected fields, missing required fields, and CANCELAR button', () => {
    const draftToolCall: ToolCallCardData = {
      actionId: 'draft-evt-1',
      toolName: 'createCalendarEvent',
      description: 'CRIAR EVENTO DE AGENDA — FALTA: TÍTULO',
      isDestructive: false,
      status: 'DRAFTING',
      draftArgs: { date: '2026-11-21', startTime: '15:00' },
      missingFields: ['title'],
      draftSummary: {
        actionLabel: 'CRIAR EVENTO DE AGENDA',
        collectedFields: [
          { key: 'date', label: 'DATA', value: '2026-11-21' },
          { key: 'startTime', label: 'HORÁRIO DE INÍCIO', value: '15:00' },
        ],
        missingFields: [{ key: 'title', label: 'TÍTULO' }],
      },
    };

    const messages: ChatMessageRecord[] = [
      {
        id: 'm-draft',
        threadId: 't-1',
        role: 'ASSISTANT',
        content: 'RASCUNHO EM ANDAMENTO. PARA CONCLUIR, INFORME APENAS: TÍTULO.',
        attachmentsJson: '[]',
        toolCallsJson: JSON.stringify([draftToolCall]),
        createdAt: '2026-11-20T15:00:00.000Z',
      },
    ];

    const html = renderToStaticMarkup(
      <ChatConversation initialThreadId="t-1" initialMessages={messages} />,
    );

    expect(html).toContain('RASCUNHO EM ANDAMENTO');
    expect(html).toContain('DATA');
    expect(html).toContain('2026-11-21');
    expect(html).toContain('HORÁRIO DE INÍCIO');
    expect(html).toContain('15:00');
    expect(html).toContain('FALTA INFORMAR');
    expect(html).toContain('TÍTULO');
    expect(html).toContain('CANCELAR');
    expect(html).not.toContain('DESFAZER');

    const streamHtml = renderToStaticMarkup(
      <StreamingToolCallsPreview toolCalls={[draftToolCall]} />,
    );
    expect(streamHtml).toContain('RASCUNHO EM ANDAMENTO:');
    expect(streamHtml).toContain('CRIAR EVENTO DE AGENDA — FALTA: TÍTULO');
  });

  it('hydrates persisted pending_tool_actions statuses across page reload (DRAFTING, CANCELLED, CONFIRMED, UNDONE)', async () => {
    const { db, close } = await createPgliteTestDb();
    setDbForTesting(db);

    try {
      const chat = new ChatService(db);
      const thread = await chat.getOrCreateDefaultThread();

      const cancelledDraft = await chat.createPendingAction({
        threadId: thread.id,
        toolName: 'createCalendarEvent',
        argsJson: JSON.stringify({ date: '2026-11-21', startTime: '15:00' }),
        status: 'CANCELLED',
        missingFieldsJson: JSON.stringify(['title']),
      });

      const completedDraft = await chat.createPendingAction({
        threadId: thread.id,
        toolName: 'createCalendarEvent',
        argsJson: JSON.stringify({ title: 'SPRINT', date: '2026-11-22', startTime: '10:00' }),
        status: 'CONFIRMED',
      });

      const undoneMutation = await chat.createPendingAction({
        threadId: thread.id,
        toolName: 'addWishlistItem',
        argsJson: JSON.stringify({ name: 'CAFÉ', priceCents: 3800 }),
        status: 'UNDONE',
      });

      const confirmedDelete = await chat.createPendingAction({
        threadId: thread.id,
        toolName: 'deleteCalendarEvent',
        argsJson: JSON.stringify({ id: 'evt-99' }),
        status: 'CONFIRMED',
      });

      const activeDraft = await chat.upsertActiveDraft({
        threadId: thread.id,
        toolName: 'createPayableBill',
        argsJson: JSON.stringify({ title: 'INTERNET', amountCents: 9990 }),
        missingFieldsJson: JSON.stringify(['dueDate']),
      });

      await chat.addMessage({
        threadId: thread.id,
        role: 'ASSISTANT',
        content: 'HISTÓRICO DE AÇÕES.',
        toolCallsJson: JSON.stringify([
          {
            actionId: cancelledDraft.id,
            toolName: 'createCalendarEvent',
            description: 'CRIAR EVENTO DE AGENDA — FALTA: TÍTULO',
            isDestructive: false,
            status: 'DRAFTING',
            missingFieldLabels: ['TÍTULO'],
          },
          {
            actionId: completedDraft.id,
            toolName: 'createCalendarEvent',
            description: 'CRIAR EVENTO DE AGENDA — FALTA: TÍTULO',
            isDestructive: false,
            status: 'DRAFTING',
          },
          {
            actionId: undoneMutation.id,
            toolName: 'addWishlistItem',
            description: 'ADICIONOU À WISHLIST: CAFÉ (R$ 38,00)',
            isDestructive: false,
            status: 'CONFIRMED',
          },
          {
            actionId: confirmedDelete.id,
            toolName: 'deleteCalendarEvent',
            description: 'EXCLUIR EVENTO: REUNIÃO',
            isDestructive: true,
            status: 'PENDING_CONFIRMATION',
          },
          {
            actionId: activeDraft.id,
            toolName: 'createPayableBill',
            description: 'CADASTRAR CONTA A PAGAR — FALTA: VENCIMENTO',
            isDestructive: false,
            status: 'DRAFTING',
            draftArgs: { title: 'INTERNET', amountCents: 9990 },
            missingFields: ['dueDate'],
            missingFieldLabels: ['VENCIMENTO'],
          },
        ]),
      });

      const pageElement = await ChatPage();
      const html = renderToStaticMarkup(pageElement);

      expect(html).toContain('RASCUNHO CANCELADO');
      expect(html).toContain('RASCUNHO CONCLUÍDO');
      expect(html).toContain('DESFEITO');
      expect(html).toContain('EXCLUÍDO COM SUCESSO');
      expect(html).toContain('RASCUNHO EM ANDAMENTO');
      expect(html).toContain('VENCIMENTO');
      // Only the still-active DRAFTING card shows CANCELAR; resolved cards do not leak stale buttons
      expect(html.match(/>CANCELAR</g)?.length ?? 0).toBe(1);
      expect(html).not.toContain('CONFIRMAR EXCLUSÃO');
      expect(html).not.toContain('>DESFAZER<');
    } finally {
      setDbForTesting(null);
      await close();
    }
  });
});
