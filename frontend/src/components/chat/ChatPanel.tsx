import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useChatStore } from '../../store/chatStore';
import { useCategoryStore } from '../../store/categoryStore';
import { HistoryPanel } from './HistoryPanel';
import type { Message, SourceLink } from '../../../../shared/types';

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-surface-2 px-1 rounded text-xs">$1</code>');
}

function SourceBadges({ sources }: { sources: SourceLink[] }) {
  const { t } = useTranslation();
  if (!sources || sources.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      <span className="text-[10px] text-fg-muted">{t('chat.sources', 'Źródła')}:</span>
      {sources.map((s) => (
        <a
          key={s.url}
          href={s.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full
                     bg-blue-500/10 text-blue-400 border border-blue-500/20
                     hover:bg-blue-500/20 transition-colors"
        >
          {s.name} ↗
        </a>
      ))}
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

function MessageBubble({ message }: MessageBubbleProps) {
  const { t } = useTranslation();
  const isUser      = message.type === 'user';
  const isInsight   = message.type === 'insight';
  const isSuggestion = message.type === 'suggestion';

  if (isInsight || isSuggestion) {
    return (
      <div className="animate-slide-up">
        <div className={clsx(
          'rounded-xl px-4 py-3 border text-sm leading-relaxed text-fg',
          isInsight
            ? 'bg-blue-500/8 border-blue-500/20'
            : 'bg-violet-500/8 border-violet-500/20'
        )}>
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
        </div>
        <p className="text-[10px] text-fg-muted mt-1 pl-1">
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end animate-slide-up">
        <div className="max-w-[80%]">
          <div className="bg-blue-600 text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 leading-relaxed">
            {message.content}
          </div>
          <p className="text-[10px] text-fg-muted mt-1 text-right pr-1">{t('chat.you')}</p>
        </div>
      </div>
    );
  }

  // assistant
  return (
    <div className="flex gap-2.5 animate-slide-up">
      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30
                      flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-xs">🤖</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-surface-2 border border-border text-fg text-sm
                        rounded-2xl rounded-tl-sm px-4 py-2.5 leading-relaxed">
          <div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }} />
          {message.sources && <SourceBadges sources={message.sources} />}
        </div>
        <p className="text-[10px] text-fg-muted mt-1 pl-1">
          Buyer Dashboard AI ·{' '}
          {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
    </div>
  );
}

function TypingIndicator({ elapsed }: { elapsed: number }) {
  const { t } = useTranslation();
  const isLong = elapsed > 10_000;

  return (
    <div className="flex gap-2.5 animate-fade-in">
      <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30
                      flex items-center justify-center flex-shrink-0">
        <span className="text-xs">🤖</span>
      </div>
      <div className="bg-surface-2 border border-border rounded-2xl rounded-tl-sm px-4 py-3">
        {isLong ? (
          <p className="text-xs text-fg-muted">{t('chat.thinkingLong')}</p>
        ) : (
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 bg-fg-muted rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 150}ms` }}
                />
              ))}
            </div>
            <span className="text-xs text-fg-muted">{t('chat.thinking')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatPanel() {
  const { t } = useTranslation();
  const { messages, isLoading, sendMessage, clearMessages, isHistoryOpen, setHistoryOpen } = useChatStore();
  const { activeCategory, activeCategoryId } = useCategoryStore();
  const [input, setInput] = useState('');
  const [loadingElapsed, setLoadingElapsed] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLTextAreaElement>(null);

  const category = activeCategory();

  // Auto-scroll to bottom on new message or loading state change
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, isLoading]);

  // Track loading elapsed time for long-wait fallback message
  useEffect(() => {
    if (!isLoading) { setLoadingElapsed(0); return; }
    const start = Date.now();
    const id = setInterval(() => setLoadingElapsed(Date.now() - start), 1000);
    return () => clearInterval(id);
  }, [isLoading]);

  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || !category) return;
    setInput('');

    const latestSupplierPrice = category.supplierPrices.length > 0
      ? [...category.supplierPrices].sort((a, b) => b.date.localeCompare(a.date))[0].price
      : null;

    await sendMessage(
      trimmed,
      {
        weights: category.weights,
        basePrice: category.basePrice,
        supplierPrices: category.supplierPrices,
        latestSupplierPrice,
        dateRange: category.timeRange,
        categoryName: category.name,
      },
      activeCategoryId,
    );
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="relative flex flex-col h-full bg-surface">

      {/* History panel (slide-in overlay) */}
      <HistoryPanel />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30
                          flex items-center justify-center">
            <span className="text-sm">🤖</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">{t('chat.title')}</p>
            <p className="text-[10px] text-fg-muted">{t('chat.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* History button */}
          <button
            onClick={() => setHistoryOpen(!isHistoryOpen)}
            className={clsx(
              'w-7 h-7 rounded-lg flex items-center justify-center text-sm transition-colors',
              isHistoryOpen
                ? 'bg-blue-600/20 text-blue-400'
                : 'text-fg-muted hover:text-fg hover:bg-surface-2'
            )}
            title={t('history.title')}
          >
            🕐
          </button>
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse-slow" />
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-fg-muted hover:text-fg-soft transition-colors"
              title={t('chat.clear')}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
      >
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <p className="text-3xl">💬</p>
              <p className="text-fg-muted text-sm">{t('chat.placeholder')}</p>
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {isLoading && <TypingIndicator elapsed={loadingElapsed} />}
      </div>

      {/* Input */}
      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-border bg-surface">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('chat.placeholder')}
            rows={1}
            className="flex-1 resize-none input-base py-2.5 max-h-32 leading-5"
            style={{ minHeight: '42px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="btn-primary h-[42px] px-4 flex-shrink-0 flex items-center gap-1.5"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
            <span className="text-sm">{t('chat.send')}</span>
          </button>
        </div>
        <p className="text-[10px] text-fg-muted mt-1.5 pl-1">
          Enter ↵ {t('chat.sendHint')} · Shift+Enter {t('chat.newLine')}
        </p>
      </div>
    </div>
  );
}

