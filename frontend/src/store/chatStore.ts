import { create } from 'zustand';
import { nanoid } from './nanoid';
import type { Message, MessageType, Language, ChatRequest, ChatSessionMeta } from '../../../shared/types';
import { API_BASE } from '../lib/api';

// ─── types ────────────────────────────────────────────────────────────────────

interface ChatState {
  messages: Message[];
  isLoading: boolean;
  language: Language;

  // session management
  currentSessionId: string;
  sessions: ChatSessionMeta[];         // loaded from /api/sessions
  isHistoryOpen: boolean;

  // actions
  addMessage: (type: MessageType, content: string) => void;
  sendMessage: (content: string, context: ChatRequest['context'], categoryId?: string) => Promise<void>;
  setLanguage: (lang: Language) => void;
  clearMessages: () => void;
  newSession: () => void;
  loadSession: (sessionId: string) => Promise<void>;
  fetchSessions: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  setHistoryOpen: (open: boolean) => void;
  updateSessionTitle: (id: string, title: string) => void;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function newSessionId() { return nanoid(); }

const initialSessionId = newSessionId();

// ─── language init ───────────────────────────────────────────────────────────

const LANG_KEY = 'appLanguage';

function detectBrowserLanguage(): Language {
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith('pl')) return 'pl';
  return 'en';
}

function initLanguage(): Language {
  // Migrate legacy key
  const legacy = localStorage.getItem('buyer-dashboard_lang') as Language | null;
  if (legacy === 'pl' || legacy === 'en') {
    localStorage.setItem(LANG_KEY, legacy);
    localStorage.removeItem('buyer-dashboard_lang');
    return legacy;
  }
  const saved = localStorage.getItem(LANG_KEY) as Language | null;
  if (saved === 'pl' || saved === 'en') return saved;
  const detected = detectBrowserLanguage();
  localStorage.setItem(LANG_KEY, detected);
  return detected;
}

export { LANG_KEY };

// ─── store ────────────────────────────────────────────────────────────────────

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  language: initLanguage(),
  currentSessionId: initialSessionId,
  sessions: [],
  isHistoryOpen: false,

  addMessage: (type, content) => {
    const msg: Message = { id: nanoid(), type, content, timestamp: Date.now() };
    set((state) => ({ messages: [...state.messages, msg] }));
  },

  sendMessage: async (content, context, categoryId) => {
    const { language, currentSessionId, addMessage } = get();

    addMessage('user', content);
    set({ isLoading: true });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15_000);

    try {
      const body: ChatRequest & { sessionId: string; categoryId?: string } = {
        message: content,
        language,
        context,
        sessionId: currentSessionId,
        categoryId,
      };

      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        addMessage('assistant', `⚠ ${(err as { error?: string }).error ?? 'API error'}`);
        return;
      }

      const data = (await res.json()) as { reply: string; sessionTitle?: string; sources?: import('../../../shared/types').SourceLink[] };
      const msg: Message = { id: nanoid(), type: 'assistant', content: data.reply, timestamp: Date.now(), sources: data.sources };
      set((state) => ({ messages: [...state.messages, msg] }));

      // Update session title if backend returned one
      if (data.sessionTitle) {
        get().updateSessionTitle(currentSessionId, data.sessionTitle);
      }

    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const isTimeout = err instanceof DOMException && err.name === 'AbortError';
      const msg = isTimeout
        ? language === 'pl'
          ? 'Hmm… to trwa dłużej niż zwykle 😅 Spróbuj ponownie za chwilę.'
          : 'Hmm… this is taking longer than usual 😅 Please try again.'
        : language === 'pl'
          ? 'Coś poszło nie tak 😅 Sprawdź połączenie z backendem i spróbuj ponownie.'
          : 'Something went wrong 😅 Check your connection and try again.';
      addMessage('assistant', msg);
    } finally {
      set({ isLoading: false });
    }
  },

  setLanguage: (lang) => {
    localStorage.setItem(LANG_KEY, lang);
    set({ language: lang });
  },

  clearMessages: () => set({ messages: [] }),

  newSession: () => {
    const id = newSessionId();
    set({ currentSessionId: id, messages: [] });
  },

  loadSession: async (sessionId) => {
    set({ isLoading: true });
    try {
      const res = await fetch(`${API_BASE}/api/sessions/${sessionId}/messages`);
      if (!res.ok) throw new Error('Failed to load session');
      const data = await res.json() as { messages: Array<{ id: string; role: string; content: string; createdAt: string }> };

      const messages: Message[] = data.messages.map((m) => ({
        id: m.id,
        type: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
        timestamp: new Date(m.createdAt).getTime(),
      }));

      set({ currentSessionId: sessionId, messages, isHistoryOpen: false });
    } catch (err) {
      console.error('[loadSession]', err);
    } finally {
      set({ isLoading: false });
    }
  },

  fetchSessions: async () => {
    try {
      const res = await fetch(`${API_BASE}/api/sessions`);
      if (!res.ok) return;
      const data = await res.json() as { sessions: Array<{ id: string; title: string; createdAt: string; updatedAt: string; messageCount: number }> };
      const sessions: ChatSessionMeta[] = data.sessions.map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: new Date(s.createdAt).getTime(),
        updatedAt: new Date(s.updatedAt).getTime(),
      }));
      set({ sessions });
    } catch (err) {
      console.error('[fetchSessions]', err);
    }
  },

  deleteSession: async (sessionId) => {
    try {
      await fetch(`${API_BASE}/api/sessions/${sessionId}`, { method: 'DELETE' });
      set((state) => ({
        sessions: state.sessions.filter((s) => s.id !== sessionId),
        // If deleted active session, start fresh
        ...(state.currentSessionId === sessionId ? { currentSessionId: newSessionId(), messages: [] } : {}),
      }));
    } catch (err) {
      console.error('[deleteSession]', err);
    }
  },

  setHistoryOpen: (open) => set({ isHistoryOpen: open }),

  updateSessionTitle: (id, title) => {
    set((state) => {
      const existing = state.sessions.find((s) => s.id === id);
      if (existing) {
        return {
          sessions: state.sessions.map((s) => s.id === id ? { ...s, title } : s),
        };
      }
      // Add new session meta entry
      return {
        sessions: [
          { id, title, createdAt: Date.now(), updatedAt: Date.now() },
          ...state.sessions,
        ],
      };
    });
  },
}));


