'use client';

import { useEffect, useRef, useState } from 'react';
import { Bot, MessageSquarePlus, Mic, Paperclip, Send, User } from 'lucide-react';
import type { ChatMessageRecord } from '../service';
import { createNewThreadAction } from '../actions';
import { EmptyState } from '@/components/sketch/EmptyState';
import { toRecifeTimeHHMM } from '@/lib/dates';

export interface ChatConversationProps {
  initialThreadId: string;
  initialMessages: ChatMessageRecord[];
}

export function ChatConversation({
  initialThreadId,
  initialMessages,
}: ChatConversationProps) {
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState<ChatMessageRecord[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom('auto');
  }, []);

  useEffect(() => {
    scrollToBottom('smooth');
  }, [messages, streamingText, isStreaming]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if (!content || isStreaming) return;

    setInputText('');

    const tempUserId = `temp-${Date.now()}`;
    const userMessage: ChatMessageRecord = {
      id: tempUserId,
      threadId,
      role: 'USER',
      content,
      attachmentsJson: '[]',
      toolCallsJson: '[]',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingText('');

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threadId, message: content }),
      });

      if (!response.ok || !response.body) {
        throw new Error('ERRO NA COMUNICAÇÃO COM O SERVIDOR');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith('data: ')) continue;
          const jsonStr = trimmed.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'start') {
              if (data.threadId) setThreadId(data.threadId);
            } else if (data.type === 'token') {
              accumulated += data.token;
              setStreamingText(accumulated);
            } else if (data.type === 'done') {
              if (data.assistantMessage) {
                setMessages((prev) => [...prev, data.assistantMessage]);
              } else {
                setMessages((prev) => [
                  ...prev,
                  {
                    id: `done-${Date.now()}`,
                    threadId,
                    role: 'ASSISTANT',
                    content: accumulated,
                    attachmentsJson: '[]',
                    toolCallsJson: '[]',
                    createdAt: new Date().toISOString(),
                  },
                ]);
              }
              setStreamingText('');
            } else if (data.type === 'error') {
              setMessages((prev) => [
                ...prev,
                {
                  id: `err-${Date.now()}`,
                  threadId,
                  role: 'ASSISTANT',
                  content: `ERRO: ${data.error || 'NÃO FOI POSSÍVEL PROCESSAR SUA SOLICITAÇÃO.'}`,
                  attachmentsJson: '[]',
                  toolCallsJson: '[]',
                  createdAt: new Date().toISOString(),
                },
              ]);
              setStreamingText('');
            }
          } catch {
            // ignore parse errors for partial chunks
          }
        }
      }
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'ERRO AO PROCESSAR COMANDO';
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          threadId,
          role: 'ASSISTANT',
          content: `DESCULPE, OCORREU UM ERRO: ${errMessage.toUpperCase()}`,
          attachmentsJson: '[]',
          toolCallsJson: '[]',
          createdAt: new Date().toISOString(),
        },
      ]);
      setStreamingText('');
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleNewConversation = async () => {
    const res = await createNewThreadAction();
    if (res.ok && res.threadId) {
      setThreadId(res.threadId);
      setMessages([]);
      setStreamingText('');
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <section className="flex flex-1 flex-col justify-between p-4 md:p-5 h-full min-h-0 overflow-hidden bg-[#121212]">
      {/* Cabeçalho da conversa */}
      <div className="flex items-center justify-between border-b-2 border-[#f1f3f5] pb-2">
        <h1 className="text-xl tracking-wider text-[#f1f3f5] uppercase md:text-2xl font-bold">
          CHAT
        </h1>

        <button
          type="button"
          onClick={handleNewConversation}
          className="flex items-center gap-1.5 rounded border border-[#f1f3f5] bg-[#1e1e1e] px-2.5 py-1 text-xs text-[#f1f3f5] hover:bg-[#2c2c2c] transition-colors sketch-shadow-sm uppercase"
          title="INICIAR NOVA CONVERSA"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" />
          <span>NOVA CONVERSA</span>
        </button>
      </div>

      {/* Área de mensagens com scroll */}
      <div
        ref={scrollContainerRef}
        className="my-3 flex flex-1 flex-col gap-3 overflow-y-auto pr-1"
      >
        {messages.length === 0 && !isStreaming ? (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              title="NENHUMA MENSAGEM NESTA CONVERSA"
              description="ENVIE UM COMANDO PARA LER, ADICIONAR, EDITAR OU EXCLUIR DADOS EM CALENDÁRIO, FINANÇAS, ACADÊMICO E COMPRAS."
            />
          </div>
        ) : (
          messages.map((m) => {
            const isUser = m.role === 'USER';
            const isSys = m.role === 'SYSTEM';

            if (isSys) {
              return (
                <div key={m.id} className="my-1 flex justify-center">
                  <span className="rounded border border-dashed border-[#868e96] bg-[#1e1e1e] px-3 py-1 text-[11px] text-[#868e96] uppercase">
                    {m.content}
                  </span>
                </div>
              );
            }

            return (
              <div
                key={m.id}
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`flex max-w-[85%] flex-col rounded-lg border-2 border-[#f1f3f5] p-3 text-sm md:max-w-[70%] ${
                    isUser
                      ? 'bg-[#1e1e1e] text-[#f1f3f5] sketch-shadow-sm'
                      : 'bg-[#1e1e1e] text-[#f1f3f5] sketch-shadow'
                  }`}
                >
                  <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[#868e96]">
                    {isUser ? (
                      <>
                        <User className="h-3 w-3" />
                        <span className="font-bold">VOCÊ</span>
                      </>
                    ) : (
                      <>
                        <Bot className="h-3 w-3 text-[#a5d8ff]" />
                        <span className="font-bold text-[#a5d8ff]">ASSISTENTE</span>
                      </>
                    )}
                    <span>•</span>
                    <span>{toRecifeTimeHHMM(m.createdAt)}</span>
                  </div>

                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {/* Balão do assistente transmitindo tokens em streaming */}
        {isStreaming && (
          <div className="flex w-full justify-start">
            <div className="flex max-w-[85%] flex-col rounded-lg border-2 border-[#f1f3f5] bg-[#1e1e1e] p-3 text-sm text-[#f1f3f5] md:max-w-[70%] sketch-shadow">
              <div className="mb-1 flex items-center gap-1.5 text-[11px] text-[#868e96]">
                <Bot className="h-3 w-3 text-[#a5d8ff]" />
                <span className="font-bold text-[#a5d8ff]">ASSISTENTE</span>
                <span>•</span>
                <span className="text-[#ffec99]">TRANSMITINDO...</span>
              </div>

              {streamingText ? (
                <div className="whitespace-pre-wrap break-words leading-relaxed">
                  {streamingText}
                  <span className="inline-block animate-pulse text-[#a5d8ff] font-bold"> _</span>
                </div>
              ) : (
                /* Indicador de digitação '...' animado */
                <div className="flex items-center gap-1 py-1" aria-label="Digitando...">
                  <span className="h-2 w-2 rounded-full bg-[#f1f3f5] animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-[#f1f3f5] animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-[#f1f3f5] animate-bounce" />
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra inferior de entrada de mensagem */}
      <form onSubmit={handleSendMessage} className="border-t-2 border-[#f1f3f5] pt-3">
        <div className="flex items-center gap-2 rounded-lg border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 sketch-shadow-sm focus-within:ring-1 focus-within:ring-[#f1f3f5]">
          <button
            type="button"
            aria-label="ANEXAR ARQUIVO"
            title="ANEXAR ARQUIVO (EM BREVE)"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#868e96] hover:text-[#f1f3f5] transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <span aria-hidden="true" className="h-5 w-[2px] bg-[#495057]" />

          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isStreaming ? 'AGUARDE A RESPOSTA...' : 'DIGITE SUA MENSAGEM'}
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm tracking-wider text-[#f1f3f5] placeholder:text-[#868e96] focus:outline-none uppercase"
          />

          <button
            type="button"
            aria-label="DITAR POR VOZ"
            title="DITAR POR VOZ (EM BREVE)"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#868e96] hover:text-[#f1f3f5] transition-colors"
          >
            <Mic className="h-5 w-5" />
          </button>

          <button
            type="submit"
            disabled={!inputText.trim() || isStreaming}
            aria-label="ENVIAR MENSAGEM"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-[#f1f3f5] text-[#121212] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[#e9ecef] transition-all"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </section>
  );
}
