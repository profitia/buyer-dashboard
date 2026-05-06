import { create } from 'zustand';

// ── Types ─────────────────────────────────────────────────────────────────────

export type DateRange = 'all' | 'today' | '7d' | '30d' | 'custom';
export type Importance = 'high' | 'medium' | 'low';

export interface FilterState {
  dateRange: DateRange;
  impacts: string[];       // ['steel', 'aluminum', 'transport', 'energy']
  countries: string[];     // ['US', 'EU', 'PL']
  importance: Importance[];
}

export interface SavedView {
  id: string;
  name: string;
  filters: FilterState;
  createdAt: string;
}

const DEFAULT_FILTERS: FilterState = {
  dateRange: 'all',
  impacts: [],
  countries: [],
  importance: [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateCutoff(range: DateRange): string | null {
  if (range === 'all') return null;
  const today = new Date().toISOString().split('T')[0];
  if (range === 'today') return today;
  if (range === '7d') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  }
  if (range === '30d') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  }
  return null;
}

// ── Store ─────────────────────────────────────────────────────────────────────

interface MacroFilterStoreState {
  filters: FilterState;
  drawerOpen: boolean;
  saveModalOpen: boolean;
  savedViews: SavedView[];
  activeViewId: string | null;

  setDateRange: (range: DateRange) => void;
  toggleImpact: (impact: string) => void;
  toggleCountry: (country: string) => void;
  toggleImportance: (level: Importance) => void;
  removeFilterChip: (type: 'impact' | 'country' | 'importance', value: string) => void;
  resetFilters: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
  openSaveModal: () => void;
  closeSaveModal: () => void;

  // SavedViews
  fetchViews: () => Promise<void>;
  saveView: (name: string) => Promise<void>;
  applyView: (view: SavedView) => void;
  clearView: () => void;

  // Computed: filtered events (takes raw events, returns filtered)
  getDateCutoff: () => string | null;
}

export const useMacroFilterStore = create<MacroFilterStoreState>((set, get) => ({
  filters: { ...DEFAULT_FILTERS },
  drawerOpen: false,
  saveModalOpen: false,
  savedViews: [],
  activeViewId: null,

  setDateRange: (range) =>
    set((s) => ({ filters: { ...s.filters, dateRange: range }, activeViewId: null })),

  toggleImpact: (impact) =>
    set((s) => {
      const has = s.filters.impacts.includes(impact);
      return {
        filters: {
          ...s.filters,
          impacts: has
            ? s.filters.impacts.filter((i) => i !== impact)
            : [...s.filters.impacts, impact],
        },
        activeViewId: null,
      };
    }),

  toggleCountry: (country) =>
    set((s) => {
      const has = s.filters.countries.includes(country);
      return {
        filters: {
          ...s.filters,
          countries: has
            ? s.filters.countries.filter((c) => c !== country)
            : [...s.filters.countries, country],
        },
        activeViewId: null,
      };
    }),

  toggleImportance: (level) =>
    set((s) => {
      const has = s.filters.importance.includes(level);
      return {
        filters: {
          ...s.filters,
          importance: has
            ? s.filters.importance.filter((i) => i !== level)
            : [...s.filters.importance, level],
        },
        activeViewId: null,
      };
    }),

  removeFilterChip: (type, value) => {
    const { toggleImpact, toggleCountry, toggleImportance } = get();
    if (type === 'impact') toggleImpact(value);
    else if (type === 'country') toggleCountry(value);
    else toggleImportance(value as Importance);
  },

  resetFilters: () => set({ filters: { ...DEFAULT_FILTERS }, activeViewId: null }),

  openDrawer: () => set({ drawerOpen: true }),
  closeDrawer: () => set({ drawerOpen: false }),
  openSaveModal: () => set({ saveModalOpen: true }),
  closeSaveModal: () => set({ saveModalOpen: false }),

  fetchViews: async () => {
    try {
      const res = await fetch('/api/views');
      if (!res.ok) return;
      const data: SavedView[] = await res.json();
      set({ savedViews: data });
    } catch {
      // silent
    }
  },

  saveView: async (name) => {
    const { filters, fetchViews } = get();
    try {
      const res = await fetch('/api/views', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, filters }),
      });
      if (!res.ok) return;
      await fetchViews();
    } catch {
      // silent
    }
  },

  applyView: (view) =>
    set({ filters: { ...view.filters }, activeViewId: view.id, drawerOpen: false }),

  clearView: () => set({ filters: { ...DEFAULT_FILTERS }, activeViewId: null }),

  getDateCutoff: () => getDateCutoff(get().filters.dateRange),
}));
