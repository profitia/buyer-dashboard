import { create } from 'zustand';
import { nanoid } from './nanoid';
import type { Category, CategoryTemplate, ComponentWeights, SupplierPriceEntry, TimeRange } from '../../../shared/types';

const TEMPLATES: Record<CategoryTemplate, ComponentWeights> = {
  steel:     { steel: 55, aluminum: 20, transport: 15, energy: 10 },
  aluminum:  { steel: 15, aluminum: 55, transport: 20, energy: 10 },
  logistics: { steel: 25, aluminum: 15, transport: 45, energy: 15 },
  energy:    { steel: 20, aluminum: 20, transport: 20, energy: 40 },
  balanced:  { steel: 25, aluminum: 25, transport: 25, energy: 25 },
  custom:    { steel: 40, aluminum: 30, transport: 20, energy: 10 },
};

function makeDefaultCategory(name: string, template: CategoryTemplate = 'custom'): Category {
  return {
    id: nanoid(),
    name,
    weights: { ...TEMPLATES[template] },
    basePrice: 1000,
    supplierPrices: [],
    timeRange: '3Y',
    template,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

// ─── persist helpers ──────────────────────────────────────────────────────────

function saveToStorage(categories: Category[], activeId: string) {
  try {
    localStorage.setItem('sg_categories', JSON.stringify(categories));
    localStorage.setItem('sg_active_category', activeId);
  } catch { /* ignore quota */ }
}

function loadFromStorage(): { categories: Category[]; activeId: string } {
  try {
    const raw = localStorage.getItem('sg_categories');
    const cats: Category[] = raw ? JSON.parse(raw) : [];
    const activeId = localStorage.getItem('sg_active_category') ?? '';
    return { categories: cats, activeId };
  } catch {
    return { categories: [], activeId: '' };
  }
}

// ─── store ────────────────────────────────────────────────────────────────────

interface CategoryStoreState {
  categories: Category[];
  activeCategoryId: string;

  // derived helpers (call as selectors)
  activeCategory: () => Category | undefined;

  // actions
  addCategory: (name: string, template?: CategoryTemplate) => Category;
  setActiveCategory: (id: string) => void;
  updateActiveCategory: (patch: Partial<Pick<Category, 'weights' | 'basePrice' | 'supplierPrices' | 'timeRange' | 'name'>>) => void;
  renameCategory: (id: string, name: string) => void;
  duplicateCategory: (id: string) => Category;
  removeCategory: (id: string) => void;
  syncFromServer: (serverCats: ServerCategory[]) => void;
}

// shape returned by GET /api/categories
interface ServerCategory {
  id: string;
  name: string;
  steelWeight: number;
  aluminumWeight: number;
  transportWeight: number;
  energyWeight: number;
  basePrice: number;
  supplierPrices: string; // JSON
  timeRange: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

// Bootstrap: load from localStorage, or create default category
const stored = loadFromStorage();
const initialCategories: Category[] =
  stored.categories.length > 0
    ? stored.categories
    : [makeDefaultCategory('Stal', 'steel')];

const initialActiveId =
  stored.activeId && initialCategories.find((c) => c.id === stored.activeId)
    ? stored.activeId
    : initialCategories[0].id;

export const useCategoryStore = create<CategoryStoreState>((set, get) => ({
  categories: initialCategories,
  activeCategoryId: initialActiveId,

  activeCategory: () => {
    const { categories, activeCategoryId } = get();
    return categories.find((c) => c.id === activeCategoryId);
  },

  addCategory: (name, template = 'custom') => {
    const cat = makeDefaultCategory(name, template);
    set((state) => {
      const next = [...state.categories, cat];
      saveToStorage(next, cat.id);
      return { categories: next, activeCategoryId: cat.id };
    });
    return cat;
  },

  setActiveCategory: (id) => {
    set((state) => {
      saveToStorage(state.categories, id);
      return { activeCategoryId: id };
    });
  },

  updateActiveCategory: (patch) => {
    set((state) => {
      const updated = state.categories.map((c) =>
        c.id === state.activeCategoryId
          ? { ...c, ...patch, updatedAt: Date.now() }
          : c
      );
      saveToStorage(updated, state.activeCategoryId);
      return { categories: updated };
    });
  },

  renameCategory: (id, name) => {
    set((state) => {
      const updated = state.categories.map((c) =>
        c.id === id ? { ...c, name, updatedAt: Date.now() } : c
      );
      saveToStorage(updated, state.activeCategoryId);
      return { categories: updated };
    });
  },

  duplicateCategory: (id) => {
    const source = get().categories.find((c) => c.id === id);
    const dup: Category = source
      ? { ...source, id: nanoid(), name: `${source.name} (kopia)`, createdAt: Date.now(), updatedAt: Date.now() }
      : makeDefaultCategory('Kopia');
    set((state) => {
      const next = [...state.categories, dup];
      saveToStorage(next, dup.id);
      return { categories: next, activeCategoryId: dup.id };
    });
    return dup;
  },

  removeCategory: (id) => {
    set((state) => {
      const next = state.categories.filter((c) => c.id !== id);
      if (next.length === 0) {
        const def = makeDefaultCategory('Stal', 'steel');
        saveToStorage([def], def.id);
        return { categories: [def], activeCategoryId: def.id };
      }
      const newActiveId =
        state.activeCategoryId === id ? next[0].id : state.activeCategoryId;
      saveToStorage(next, newActiveId);
      return { categories: next, activeCategoryId: newActiveId };
    });
  },

  syncFromServer: (serverCats) => {
    // Merge server categories — server is source of truth for saved ones
    const local = get().categories;
    const serverIds = new Set(serverCats.map((s) => s.id));

    const converted: Category[] = serverCats.map((s) => ({
      id: s.id,
      name: s.name,
      weights: {
        steel:     s.steelWeight,
        aluminum:  s.aluminumWeight,
        transport: s.transportWeight,
        energy:    s.energyWeight,
      },
      basePrice:     s.basePrice,
      supplierPrices: (() => { try { return JSON.parse(s.supplierPrices); } catch { return []; } })() as SupplierPriceEntry[],
      timeRange:     s.timeRange as TimeRange,
      template:      s.template as CategoryTemplate,
      createdAt:     new Date(s.createdAt).getTime(),
      updatedAt:     new Date(s.updatedAt).getTime(),
    }));

    // Keep local-only categories (not yet saved to server)
    const localOnly = local.filter((c) => !serverIds.has(c.id));
    const merged = [...converted, ...localOnly];

    const activeId = get().activeCategoryId;
    const validActive = merged.find((c) => c.id === activeId) ? activeId : merged[0]?.id ?? '';
    saveToStorage(merged, validActive);
    set({ categories: merged, activeCategoryId: validActive });
  },
}));

export { TEMPLATES };
