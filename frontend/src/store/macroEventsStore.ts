import { create } from 'zustand';
import type { MacroEvent, HistoricalMacroEvent } from '../../../shared/types';
import { API_BASE } from '../lib/api';

interface MacroEventsState {
  events: MacroEvent[];
  isLoading: boolean;
  error: string | null;
  highlightDate: string | null;   // YYYY-MM date to highlight on chart

  // DB-backed historical events for chart annotations
  chartEvents: HistoricalMacroEvent[];
  chartEventsLoading: boolean;

  fetchEvents: (lang?: string) => Promise<void>;
  fetchChartEvents: (category?: string) => Promise<void>;
  setHighlightDate: (date: string | null) => void;
}

export const useMacroEventsStore = create<MacroEventsState>((set) => ({
  events: [],
  isLoading: false,
  error: null,
  highlightDate: null,
  chartEvents: [],
  chartEventsLoading: false,

  fetchEvents: async (lang = 'pl') => {
    set({ isLoading: true, error: null });
    try {
      const res = await fetch(`${API_BASE}/api/macro-events?lang=${lang}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: MacroEvent[] = await res.json();
      set({ events: data, isLoading: false });
    } catch (err) {
      set({ error: (err as Error).message, isLoading: false });
    }
  },

  fetchChartEvents: async (category?: string) => {
    set({ chartEventsLoading: true });
    try {
      const params = new URLSearchParams();
      if (category) params.set('category', category);
      // Fetch last 3 years of events for chart
      params.set('from', new Date(Date.now() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
      const res = await fetch(`${API_BASE}/api/events?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HistoricalMacroEvent[] = await res.json();
      set({ chartEvents: data, chartEventsLoading: false });
    } catch {
      set({ chartEventsLoading: false });
    }
  },

  setHighlightDate: (date) => set({ highlightDate: date }),
}));
