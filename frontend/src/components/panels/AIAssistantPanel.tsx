/**
 * AIAssistantPanel — Painel de chat com o assistente de IA elétrica (ELIAS).
 * Roda 100% offline via Ollama. Suporta streaming de respostas.
 */
'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAiStore, AVAILABLE_MODELS, DEFAULT_MODEL } from '@/store/aiStore';
import { useProjectStore } from '@/store/projectStore';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const QUICK_QUESTIONS = [
  'Analise os resultados do projeto atual',
  'Como posso melhorar a tensão de toque?',
  'Explique a equação de Sverak para Rg',
  'Qual o impacto da resistividade do solo no GPR?',
  'Quantas hastes devo adicionar para aprovação?',
];

export default function AIAssistantPanel() {
  const {
    messages, isStreaming, includeContext, modelStatus, selectedModel,
    isPulling, pullProgress,
    addMessage, appendToLastMessage, setLastMessageError, clearMessages,
    setIsStreaming, setIncludeContext, setModelStatus,
    setSelectedModel, setIsPulling, setPullProgress,
  } = useAiStore();

  const { activeScenario, calculationResult } = useProjectStore();
  const [input, setInput] = useState('');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkStatus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const checkStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/status`);
      if (res.ok) {
        const data = await res.json();
        setModelStatus(data);
      } else {
        setModelStatus({ available: false, models: [] });
      }
    } catch {
      setModelStatus({ available: false, models: [] });
    }
  };

  const buildContext = useCallback(() => {
    if (!includeContext || !activeScenario) return undefined;
    return {
      soil: activeScenario.soil_data,
      mesh: activeScenario.mesh_data,
      fault: activeScenario.fault_data,
      results: calculationResult ?? undefined,
    };
  }, [includeContext, activeScenario, calculationResult]);

  const isModelInstalled = modelStatus?.models.some((m) =>
    m.startsWith(selectedModel.split(':')[0])
  );

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    setInput('');
    addMessage('user', content);

    const history = messages
      .filter((m) => !m.isError)
      .map((m) => ({ role: m.role, content: m.content }));
    history.push({ role: 'user', content });

    addMessage('assistant', '');
    setIsStreaming(true);

    try {
      const response = await fetch(`${API_BASE}/api/v1/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history,
          model: selectedModel,
          context: buildContext(),
        }),
      });

      if (!response.ok || !response.body) {
        setLastMessageError('Erro ao conectar ao assistente de IA.');
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n');
        buffer = parts.pop() ?? '';

        for (const line of parts) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.content) appendToLastMessage(parsed.content);
            if (parsed.error) setLastMessageError(`⚠️ ${parsed.error}`);
          } catch {
            // ignore malformed chunks
          }
        }
      }
    } catch {
      setLastMessageError('⚠️ Erro de conexão com o assistente. Verifique se o Ollama está rodando.');
    } finally {
      setIsStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const pullModel = async (modelName: string) => {
    setIsPulling(true);
    setPullProgress('Iniciando download...');
    try {
      const response = await fetch(
        `${API_BASE}/api/v1/ai/pull/${encodeURIComponent(modelName)}`,
        { method: 'POST' }
      );
      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split('\n');
        buf = lines.pop() ?? '';
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (raw === '[DONE]') break;
          try {
            const parsed = JSON.parse(raw);
            if (parsed.status) setPullProgress(parsed.status);
          } catch {}
        }
      }

      await checkStatus();
    } catch {
      setPullProgress('Erro ao baixar modelo.');
    } finally {
      setIsPulling(false);
      setPullProgress('');
    }
  };

  // ── Ollama indisponível ──
  if (modelStatus && !modelStatus.available) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-status-warning/10 border border-status-warning/30 flex items-center justify-center">
          <IconRobot className="w-7 h-7 text-status-warning-light" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">Ollama não detectado</p>
          <p className="text-xs text-text-muted max-w-52">
            Inicie o serviço Ollama:<br />
            <code className="font-mono text-accent-blue-light">docker-compose up ollama</code>
          </p>
        </div>
        <button onClick={checkStatus} className="btn-secondary text-xs px-4 py-1.5">
          Verificar Novamente
        </button>
      </div>
    );
  }

  // ── Modelo não instalado ──
  if (modelStatus?.available && !isModelInstalled) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-accent-blue/10 border border-accent-blue/30 flex items-center justify-center">
          <IconRobot className="w-7 h-7 text-accent-blue-light" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-semibold text-text-primary">Modelo não instalado</p>
          <p className="text-xs text-text-muted max-w-56">
            O modelo{' '}
            <code className="font-mono text-accent-blue-light">{selectedModel}</code>{' '}
            precisa ser baixado (~2 GB, apenas uma vez).
          </p>
        </div>

        {isPulling ? (
          <div className="w-full space-y-2 px-2">
            <div className="h-1.5 bg-background-primary rounded-full overflow-hidden">
              <div className="h-full bg-accent-blue animate-pulse rounded-full" style={{ width: '70%' }} />
            </div>
            <p className="text-[10px] text-text-muted truncate">{pullProgress}</p>
          </div>
        ) : (
          <div className="space-y-2 w-full">
            <button
              onClick={() => pullModel(selectedModel)}
              className="w-full btn-primary text-xs py-2"
            >
              Baixar {selectedModel}
            </button>
            <div className="space-y-1">
              {AVAILABLE_MODELS.filter((m) => m.name !== selectedModel).map((m) => (
                <button
                  key={m.name}
                  onClick={() => setSelectedModel(m.name)}
                  className="w-full text-left px-3 py-1.5 rounded border border-background-border
                             hover:border-accent-blue/40 text-[10px] text-text-secondary
                             hover:text-text-primary transition-colors"
                >
                  <span className="font-mono">{m.name}</span>{' '}
                  <span className="text-text-muted">{m.size} — {m.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Carregando status ──
  if (!modelStatus) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ── Interface de chat ──
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-background-border flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center">
            <IconRobot className="w-3 h-3 text-accent-blue-light" />
          </div>
          <span className="text-xs font-semibold text-text-primary">ELIAS</span>
          <span className="w-1.5 h-1.5 rounded-full bg-status-safe-light animate-pulse" title="Modelo online" />

          {/* Model selector */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu((v) => !v)}
              className="text-[10px] text-text-muted hover:text-text-secondary px-1 py-0.5 rounded
                         hover:bg-background-surface transition-colors font-mono"
            >
              {selectedModel.split(':')[0]}
            </button>
            {showModelMenu && (
              <div className="absolute left-0 top-full mt-1 z-50 bg-background-secondary border border-background-border
                              rounded shadow-lg min-w-48 py-1">
                {AVAILABLE_MODELS.map((m) => {
                  const installed = modelStatus.models.some((installed) =>
                    installed.startsWith(m.name.split(':')[0])
                  );
                  return (
                    <button
                      key={m.name}
                      onClick={() => { setSelectedModel(m.name); setShowModelMenu(false); }}
                      className={`w-full text-left px-3 py-1.5 text-[10px] hover:bg-background-surface transition-colors
                                  ${m.name === selectedModel ? 'text-accent-blue-light' : 'text-text-secondary'}`}
                    >
                      <span className="font-mono">{m.name}</span>
                      <span className={`ml-1 ${installed ? 'text-status-safe-light' : 'text-text-muted'}`}>
                        {installed ? '✓' : '↓'}
                      </span>
                      <span className="text-text-muted block">{m.description}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setIncludeContext(!includeContext)}
            title={includeContext ? 'Contexto do projeto ativo' : 'Contexto desativado'}
            className={`p-1 rounded transition-colors ${
              includeContext
                ? 'text-accent-blue-light bg-accent-blue/10'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            <IconDoc className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={clearMessages}
            title="Limpar conversa"
            className="p-1 rounded text-text-muted hover:text-text-primary transition-colors"
          >
            <IconTrash className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Context pill */}
      {includeContext && activeScenario && (
        <div className="px-3 py-1 bg-accent-blue/5 border-b border-accent-blue/15 flex-shrink-0">
          <p className="text-[10px] text-accent-blue-light">
            Contexto ativo — usando dados do cenário atual
          </p>
        </div>
      )}

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0"
        onClick={() => setShowModelMenu(false)}
      >
        {messages.length === 0 ? (
          <EmptyState
            onQuickQuestion={(q) => {
              setInput(q);
              inputRef.current?.focus();
            }}
          />
        ) : (
          messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} isStreaming={isStreaming} isLast={msg === messages[messages.length - 1]} />
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-background-border flex-shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte sobre engenharia elétrica..."
            rows={2}
            disabled={isStreaming}
            className="flex-1 bg-background-primary border border-background-border rounded px-3 py-2
                       text-xs text-text-primary placeholder-text-muted resize-none
                       focus:outline-none focus:border-accent-blue/50 transition-colors
                       disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isStreaming}
            title="Enviar (Enter)"
            className="p-2.5 rounded bg-accent-blue text-white flex-shrink-0
                       hover:bg-accent-blue-bright disabled:opacity-40 transition-colors"
          >
            {isStreaming ? (
              <div className="w-4 h-4 border border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <IconSend className="w-4 h-4" />
            )}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">Enter — enviar · Shift+Enter — nova linha</p>
      </div>
    </div>
  );
}

// ── Subcomponentes ──

function EmptyState({ onQuickQuestion }: { onQuickQuestion: (q: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 py-6 text-center">
      <div className="w-12 h-12 rounded-full bg-accent-blue/10 border border-accent-blue/20 flex items-center justify-center">
        <IconRobot className="w-6 h-6 text-accent-blue-light" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-text-primary">Olá! Sou o ELIAS</p>
        <p className="text-xs text-text-muted max-w-52">
          Especialista em IEEE 80, ABNT NBR e cálculos de aterramento. Pergunte qualquer coisa.
        </p>
      </div>
      <div className="space-y-1.5 w-full">
        {QUICK_QUESTIONS.map((q) => (
          <button
            key={q}
            onClick={() => onQuickQuestion(q)}
            className="w-full text-left px-3 py-2 rounded bg-background-primary border border-background-border
                       hover:border-accent-blue/40 text-xs text-text-secondary hover:text-text-primary transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message, isStreaming, isLast,
}: {
  message: { role: string; content: string; isError?: boolean };
  isStreaming: boolean;
  isLast: boolean;
}) {
  const isUser = message.role === 'user';
  const isTyping = !isUser && isStreaming && isLast && message.content === '';

  return (
    <div className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <div className="w-5 h-5 rounded-full bg-accent-blue/20 flex items-center justify-center flex-shrink-0 mt-0.5">
          <IconRobot className="w-3 h-3 text-accent-blue-light" />
        </div>
      )}
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
          isUser
            ? 'bg-accent-blue text-white'
            : message.isError
            ? 'bg-status-danger/10 border border-status-danger/30 text-status-danger-light'
            : 'bg-background-primary border border-background-border text-text-primary'
        }`}
      >
        {isTyping ? (
          <TypingIndicator />
        ) : isUser ? (
          <span>{message.content}</span>
        ) : (
          <MarkdownContent content={message.content} />
        )}
      </div>
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 py-0.5">
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="w-1.5 h-1.5 rounded-full bg-accent-blue-light animate-bounce"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

function MarkdownContent({ content }: { content: string }) {
  const lines = content.split('\n');

  return (
    <div className="space-y-0.5">
      {lines.map((line, i) => {
        // Headers
        if (line.match(/^#{1,3} /)) {
          return (
            <p key={i} className="font-semibold text-accent-blue-light mt-1">
              {renderInline(line.replace(/^#+\s/, ''))}
            </p>
          );
        }
        // Bullet
        if (line.match(/^[-*•] /)) {
          return (
            <p key={i} className="pl-2">
              <span className="text-accent-blue-light mr-1">·</span>
              {renderInline(line.slice(2))}
            </p>
          );
        }
        // Numbered list
        if (line.match(/^\d+\. /)) {
          return (
            <p key={i} className="pl-2">
              {renderInline(line)}
            </p>
          );
        }
        // Code block delimiter — skip rendering the ``` markers
        if (line.trim().startsWith('```')) {
          return null;
        }
        // Empty line → spacer
        if (!line.trim()) {
          return <div key={i} className="h-1" />;
        }
        return <p key={i}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-text-primary">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={i} className="font-mono bg-background-surface px-1 py-0.5 rounded text-accent-blue-light text-[10px]">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

// ── Ícones ──

function IconRobot({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="3" y="11" width="18" height="11" rx="2" />
      <path d="M12 2v4" />
      <circle cx="12" cy="2" r="1" fill="currentColor" stroke="none" />
      <path d="M9 11V9a3 3 0 016 0v2" />
      <circle cx="9" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="15" cy="16" r="1.2" fill="currentColor" stroke="none" />
      <path d="M9 20h6" strokeLinecap="round" />
    </svg>
  );
}

function IconSend({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 2L11 13M22 2L15 22l-4-9-9-4 20-7z" strokeLinejoin="round" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" strokeLinecap="round" />
    </svg>
  );
}

function IconDoc({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 12h6M9 16h6M17 21H7a2 2 0 01-2-2V5a2 2 0 012-2h7l5 5v11a2 2 0 01-2 2z" strokeLinecap="round" />
    </svg>
  );
}
