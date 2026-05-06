import { useEffect } from 'react';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useChatStore } from '../../store/chatStore';
import type { ChatSessionMeta } from '../../../../shared/types';

function groupByDate(sessions: ChatSessionMeta[]) {
  const todayStart  = new Date(); todayStart.setHours(0, 0, 0, 0);
  const yestStart   = new Date(todayStart); yestStart.setDate(yestStart.getDate() - 1);

  const today:     ChatSessionMeta[] = [];
  const yesterday: ChatSessionMeta[] = [];
  const older:     ChatSessionMeta[] = [];

  for (const s of sessions) {
    if (s.updatedAt >= todayStart.getTime()) today.push(s);
    else if (s.updatedAt >= yestStart.getTime()) yesterday.push(s);
    else older.push(s);
  }
  return { today, yesterday, older };
}

export function HistoryPanel() {
  const { t } = useTranslation();
  const {
    sessions,
    currentSessionId,
    isHistoryOpen,
    setHistoryOpen,
    fetchSessions,
    loadSession,
    deleteSession,
    newSession,
  } = useChatStore();

  // Load sessions when panel opens
  useEffect(() => {
    if (isHistoryOpen) fetchSessions();
  }, [isHistoryOpen, fetchSessions]);

  if (!isHistoryOpen) return null;

  const groups = groupByDate(sessions);

  function SessionItem({ session }: { session: ChatSessionMeta }) {
    const isActive = session.id === currentSessionId;
    return (
      <div
        className={clsx(
          'group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all',
          isActive
            ? 'bg-blue-600/15 border border-blue-500/30'
            : 'hover:bg-surface-2'
        )}
        onClick={() => loadSession(session.id)}
      >
        <div className="flex-1 min-w-0">
          <p className={clsx(
            'text-sm truncate',
            isActive ? 'text-blue-400 font-medium' : 'text-fg'
          )}>
            {session.title}
          </p>
          <p className="text-[10px] text-fg-muted mt-0.5">
            {new Date(session.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); deleteSession(session.id); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-fg-muted hover:text-red-400 text-xs p-1"
          title={t('history.delete')}
        >
          🗑
        </button>
      </div>
    );
  }

  function Group({ label, items }: { label: string; items: ChatSessionMeta[] }) {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-widest text-fg-muted px-3 pt-2 pb-1 font-semibold">{label}</p>
        {items.map((s) => <SessionItem key={s.id} session={s} />)}
      </div>
    );
  }

  return (
    // Overlay
    <div
      className="absolute inset-0 z-30 flex"
      onClick={() => setHistoryOpen(false)}
    >
      {/* Panel — right side */}
      <div
        className="ml-auto w-72 h-full bg-surface border-l border-border flex flex-col shadow-2xl animate-slide-up"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'slideInRight 200ms ease' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <p className="text-sm font-semibold text-fg">{t('history.title')}</p>
          <button
            onClick={() => setHistoryOpen(false)}
            className="text-fg-muted hover:text-fg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* New conversation */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <button
            onClick={() => { newSession(); setHistoryOpen(false); }}
            className="w-full btn-primary text-sm py-2"
          >
            + {t('history.newConversation')}
          </button>
        </div>

        {/* Sessions list */}
        <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {sessions.length === 0 ? (
            <p className="text-fg-muted text-sm text-center py-8">{t('history.empty')}</p>
          ) : (
            <>
              <Group label={t('history.today')}     items={groups.today} />
              <Group label={t('history.yesterday')} items={groups.yesterday} />
              <Group label={t('history.older')}     items={groups.older} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
