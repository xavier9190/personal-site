'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Bot,
  Check,
  FileSpreadsheet,
  FileText,
  ImageIcon,
  MessageSquarePlus,
  Mic,
  MicOff,
  Paperclip,
  RotateCcw,
  Send,
  Trash2,
  Undo2,
  User,
  X,
} from 'lucide-react';
import type { ChatMessageRecord } from '../service';
import {
  cancelPendingActionAction,
  clearThreadMessagesAction,
  confirmPendingActionAction,
  createNewThreadAction,
  undoActionAction,
} from '../actions';
import { EmptyState } from '@/components/sketch/EmptyState';
import { toRecifeTimeHHMM } from '@/lib/dates';
import type { ChatAttachment } from '../ai/intent';

export interface ChatConversationProps {
  initialThreadId: string;
  initialMessages: ChatMessageRecord[];
}

interface ToolCallCardData {
  actionId?: string;
  toolName: string;
  description: string;
  isDestructive: boolean;
  status: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'CANCELLED' | 'UNDONE' | 'READ_SUCCESS';
}

export function ChatConversation({
  initialThreadId,
  initialMessages,
}: ChatConversationProps) {
  const router = useRouter();
  const [threadId, setThreadId] = useState(initialThreadId);
  const [messages, setMessages] = useState<ChatMessageRecord[]>(initialMessages);
  const [inputText, setInputText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCallCardData[]>([]);

  // Attachments state
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Voice dictation state
  const [isListening, setIsListening] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Dynamic card statuses (key: actionId, value: status)
  const [actionStatuses, setActionStatuses] = useState<Record<string, ToolCallCardData['status']>>({});

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
  }, [messages, streamingText, isStreaming, attachments]);

  // Clean up speech recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // -------------------------------------------------------------
  // Attachment Handlers
  // -------------------------------------------------------------
  const handlePaperclipClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    const isImage = file.type.startsWith('image/');
    const isCsv = file.name.endsWith('.csv') || file.type.includes('csv');

    let dataUrl: string | undefined = undefined;
    let textContent: string | undefined = undefined;

    if (isImage) {
      dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
    } else if (isCsv) {
      textContent = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.readAsText(file);
      });
    }

    const newAtt: ChatAttachment = {
      id: `att-${Date.now()}`,
      name: file.name,
      type: file.type || 'application/octet-stream',
      size: file.size,
      dataUrl,
      textContent,
    };

    setAttachments((prev) => [...prev, newAtt]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // -------------------------------------------------------------
  // Voice Dictation (Web Speech API pt-BR)
  // -------------------------------------------------------------
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    setVoiceNotice(null);

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceNotice('RECONHECIMENTO DE VOZ NÃO É SUPORTADO NESTE NAVEGADOR (USE CHROME/EDGE).');
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'pt-BR';
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        if (transcript) {
          setInputText((prev) => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${transcript.trim()}` : transcript.trim();
          });
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'not-allowed') {
          setVoiceNotice('PERMISSÃO DE MICROFONE NEGADA. HABILITE NAS CONFIGURAÇÕES DO NAVEGADOR.');
        } else {
          setVoiceNotice(`AVISO DE ÁUDIO: ${event.error.toUpperCase()}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setIsListening(false);
      setVoiceNotice('NÃO FOI POSSÍVEL INICIAR O MICROFONE.');
    }
  };

  // -------------------------------------------------------------
  // Message Sending & Streaming
  // -------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const content = inputText.trim();
    if ((!content && attachments.length === 0) || isStreaming) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const currentAttachments = [...attachments];
    setInputText('');
    setAttachments([]);

    const tempUserId = `temp-${Date.now()}`;
    const userMessage: ChatMessageRecord = {
      id: tempUserId,
      threadId,
      role: 'USER',
      content: content || `[ARQUIVO ANEXO: ${currentAttachments.map((a) => a.name).join(', ')}]`,
      attachmentsJson: JSON.stringify(currentAttachments),
      toolCallsJson: '[]',
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsStreaming(true);
    setStreamingText('');
    setStreamingToolCalls([]);

    try {
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          threadId,
          message: content,
          attachments: currentAttachments,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('ERRO NA COMUNICAÇÃO COM O SERVIDOR');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let collectedToolCalls: ToolCallCardData[] = [];

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
              if (data.toolCall) {
                collectedToolCalls = [data.toolCall];
                setStreamingToolCalls(collectedToolCalls);
              }
            } else if (data.type === 'token') {
              accumulated += data.token;
              setStreamingText(accumulated);
            } else if (data.type === 'done') {
              const toolCalls = data.toolCalls || collectedToolCalls;
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
                    toolCallsJson: JSON.stringify(toolCalls),
                    createdAt: new Date().toISOString(),
                  },
                ]);
              }
              setStreamingText('');
              setStreamingToolCalls([]);
              // Refresh state on parent and right panel
              router.refresh();
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
              setStreamingToolCalls([]);
            }
          } catch {
            // ignore partial chunk json errors
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
      setStreamingToolCalls([]);
    } finally {
      setIsStreaming(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  // -------------------------------------------------------------
  // Tool Action Card Handlers (Undo & Confirm/Cancel)
  // -------------------------------------------------------------
  const handleUndo = async (actionId: string) => {
    setActionStatuses((prev) => ({ ...prev, [actionId]: 'UNDONE' }));
    const res = await undoActionAction(actionId);
    if (!res.ok) {
      alert(`FALHA AO DESFAZER: ${res.error || 'ERRO DESCONHECIDO'}`);
    } else {
      router.refresh();
    }
  };

  const handleConfirmDelete = async (actionId: string) => {
    setActionStatuses((prev) => ({ ...prev, [actionId]: 'CONFIRMED' }));
    const res = await confirmPendingActionAction(actionId);
    if (!res.ok) {
      alert(`FALHA AO EXCLUIR: ${res.error || 'ERRO DESCONHECIDO'}`);
    } else {
      router.refresh();
    }
  };

  const handleCancelDelete = async (actionId: string) => {
    setActionStatuses((prev) => ({ ...prev, [actionId]: 'CANCELLED' }));
    await cancelPendingActionAction(actionId);
    router.refresh();
  };

  const handleNewConversation = async () => {
    const res = await createNewThreadAction();
    if (res.ok && res.threadId) {
      setThreadId(res.threadId);
      setMessages([]);
      setStreamingText('');
      setIsStreaming(false);
      setAttachments([]);
      setActionStatuses({});
      router.refresh();
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
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.pdf,.csv,image/png,image/jpeg,application/pdf,text/csv"
        onChange={handleFileChange}
        className="hidden"
      />

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

      {/* Voice Warning Banner */}
      {voiceNotice && (
        <div className="my-2 flex items-center justify-between rounded border-2 border-[#ffc9c9] bg-[#1e1e1e] p-2 text-xs text-[#ffc9c9]">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {voiceNotice}
          </span>
          <button
            type="button"
            onClick={() => setVoiceNotice(null)}
            className="text-[#ced4da] hover:text-[#f1f3f5]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

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

            let attachmentsList: ChatAttachment[] = [];
            try {
              attachmentsList = JSON.parse(m.attachmentsJson || '[]');
            } catch {
              // ignore
            }

            let toolCalls: ToolCallCardData[] = [];
            try {
              toolCalls = JSON.parse(m.toolCallsJson || '[]');
            } catch {
              // ignore
            }

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

                  {/* Attachments preview inside message bubble */}
                  {attachmentsList.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-2">
                      {attachmentsList.map((att) => (
                        <div
                          key={att.id}
                          className="flex items-center gap-1.5 rounded border border-[#868e96] bg-[#121212] p-1.5 text-xs text-[#f1f3f5]"
                        >
                          {att.dataUrl ? (
                            <img
                              src={att.dataUrl}
                              alt={att.name}
                              className="h-10 w-10 rounded object-cover border border-[#495057]"
                            />
                          ) : att.name.endsWith('.csv') ? (
                            <FileSpreadsheet className="h-5 w-5 text-[#b2f2bb]" />
                          ) : (
                            <FileText className="h-5 w-5 text-[#a5d8ff]" />
                          )}
                          <div className="flex flex-col">
                            <span className="font-bold truncate max-w-[140px] text-[11px]">
                              {att.name}
                            </span>
                            <span className="text-[9px] text-[#868e96]">
                              {(att.size / 1024).toFixed(1)} KB
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="whitespace-pre-wrap break-words leading-relaxed">
                    {m.content}
                  </div>

                  {/* Interactive Tool Cards on Assistant Message */}
                  {!isUser && toolCalls.length > 0 && (
                    <div className="mt-3 flex flex-col gap-2">
                      {toolCalls.map((tc, idx) => {
                        const effectiveStatus =
                          (tc.actionId && actionStatuses[tc.actionId]) || tc.status;

                        // Destructive Card (Requires Confirmation)
                        if (tc.isDestructive) {
                          return (
                            <div
                              key={tc.actionId || idx}
                              className="rounded-lg border-2 border-[#ffc9c9] bg-[#121212] p-3 text-xs text-[#f1f3f5] sketch-shadow-sm"
                            >
                              <div className="mb-1 flex items-center justify-between text-[#ffc9c9] font-bold">
                                <span className="flex items-center gap-1.5">
                                  <AlertTriangle className="h-3.5 w-3.5" />
                                  <span>CONFIRMAÇÃO NECESSÁRIA</span>
                                </span>
                                <span className="text-[10px] text-[#868e96]">
                                  {tc.toolName}
                                </span>
                              </div>

                              <p className="my-1.5 text-sm font-bold text-[#f1f3f5]">
                                {tc.description}
                              </p>

                              {effectiveStatus === 'PENDING_CONFIRMATION' && tc.actionId ? (
                                <div className="mt-2.5 flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmDelete(tc.actionId!)}
                                    className="flex items-center gap-1 rounded bg-[#ffc9c9] px-3 py-1.5 text-xs font-bold text-[#121212] hover:bg-[#ffb0b0] transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>CONFIRMAR EXCLUSÃO</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleCancelDelete(tc.actionId!)}
                                    className="rounded border border-[#f1f3f5] bg-[#1e1e1e] px-3 py-1.5 text-xs text-[#f1f3f5] hover:bg-[#2c2c2c] transition-colors"
                                  >
                                    CANCELAR
                                  </button>
                                </div>
                              ) : effectiveStatus === 'CONFIRMED' ? (
                                <div className="mt-2 flex items-center gap-1.5 text-[#ffc9c9] font-bold text-[11px]">
                                  <Check className="h-3.5 w-3.5" />
                                  <span>EXCLUÍDO COM SUCESSO</span>
                                </div>
                              ) : (
                                <div className="mt-2 text-[#868e96] font-bold text-[11px]">
                                  EXCLUSÃO CANCELADA
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Mutation Card (Executed Immediately with [DESFAZER])
                        return (
                          <div
                            key={tc.actionId || idx}
                            className="flex items-center justify-between rounded-lg border-2 border-[#b2f2bb] bg-[#121212] p-2.5 text-xs text-[#f1f3f5] sketch-shadow-sm"
                          >
                            <div className="flex flex-col pr-2">
                              <span className="font-bold text-[#b2f2bb]">
                                {tc.description}
                              </span>
                              <span className="text-[10px] text-[#868e96]">
                                STATUS: {effectiveStatus === 'UNDONE' ? 'DESFEITO' : 'REGISTRADO'}
                              </span>
                            </div>

                            {effectiveStatus === 'UNDONE' ? (
                              <span className="flex items-center gap-1 rounded border border-[#868e96] bg-[#1e1e1e] px-2.5 py-1 text-[11px] text-[#868e96] font-bold">
                                <RotateCcw className="h-3 w-3" />
                                DESFEITO
                              </span>
                            ) : tc.actionId ? (
                              <button
                                type="button"
                                onClick={() => handleUndo(tc.actionId!)}
                                className="flex items-center gap-1 rounded border border-[#f1f3f5] bg-[#1e1e1e] px-2.5 py-1 text-xs text-[#f1f3f5] hover:bg-[#2c2c2c] transition-colors sketch-shadow-sm font-bold"
                              >
                                <Undo2 className="h-3 w-3" />
                                <span>DESFAZER</span>
                              </button>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
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

              {/* Streaming Tool Call Preview */}
              {streamingToolCalls.length > 0 && (
                <div className="mt-2 rounded border border-dashed border-[#ffec99] bg-[#121212] p-2 text-xs text-[#ffec99]">
                  PROCESSANDO: {streamingToolCalls[0].description}
                </div>
              )}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Attachments preview bar above input */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2 rounded border border-[#495057] bg-[#1e1e1e] p-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-2 rounded border border-[#f1f3f5] bg-[#121212] px-2 py-1 text-xs text-[#f1f3f5]"
            >
              {att.dataUrl ? (
                <img
                  src={att.dataUrl}
                  alt={att.name}
                  className="h-6 w-6 rounded object-cover"
                />
              ) : att.name.endsWith('.csv') ? (
                <FileSpreadsheet className="h-4 w-4 text-[#b2f2bb]" />
              ) : (
                <FileText className="h-4 w-4 text-[#a5d8ff]" />
              )}
              <span className="truncate max-w-[120px] font-bold">{att.name}</span>
              <button
                type="button"
                onClick={() => removeAttachment(att.id)}
                className="text-[#868e96] hover:text-[#ffc9c9]"
                title="REMOVER ANEXO"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Barra inferior de entrada de mensagem */}
      <form onSubmit={handleSendMessage} className="border-t-2 border-[#f1f3f5] pt-3">
        <div
          className={`flex items-center gap-2 rounded-lg border-2 ${
            isListening ? 'border-[#ffc9c9] ring-2 ring-[#ffc9c9]' : 'border-[#f1f3f5]'
          } bg-[#121212] px-3 py-2 sketch-shadow-sm focus-within:ring-1 focus-within:ring-[#f1f3f5]`}
        >
          {/* Botão de Clipe (Anexos) */}
          <button
            type="button"
            onClick={handlePaperclipClick}
            aria-label="ANEXAR ARQUIVO"
            title="ANEXAR IMAGEM, PDF OU CSV"
            className="flex h-8 w-8 shrink-0 items-center justify-center text-[#868e96] hover:text-[#f1f3f5] transition-colors"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <span aria-hidden="true" className="h-5 w-[2px] bg-[#495057]" />

          {/* Campo de Texto */}
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isListening
                ? 'ESCUTANDO EM PORTUGUÊS (FALE AGORA)...'
                : isStreaming
                ? 'AGUARDE A RESPOSTA...'
                : 'DIGITE SUA MENSAGEM'
            }
            disabled={isStreaming}
            className="flex-1 bg-transparent text-sm tracking-wider text-[#f1f3f5] placeholder:text-[#868e96] focus:outline-none uppercase"
          />

          {/* Botão de Microfone (Web Speech API pt-BR) */}
          <button
            type="button"
            onClick={toggleListening}
            aria-label={isListening ? 'PARAR GRAVAÇÃO DE VOZ' : 'DITAR POR VOZ'}
            title={isListening ? 'PARAR DE ESCUTAR' : 'DITAR POR VOZ (PT-BR)'}
            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded transition-all ${
              isListening
                ? 'bg-[#ffc9c9] text-[#121212] animate-pulse border border-[#ffc9c9]'
                : 'text-[#868e96] hover:text-[#f1f3f5]'
            }`}
          >
            {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          </button>

          {/* Botão de Envio */}
          <button
            type="submit"
            disabled={(!inputText.trim() && attachments.length === 0) || isStreaming}
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
