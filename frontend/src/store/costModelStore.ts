import { create } from 'zustand';
import type { ComponentWeights, TimeRange, SupplierPriceEntry } from '../../../shared/types';

interface VisibleComponentsBool {
  steel: boolean;
  aluminum: boolean;
  transport: boolean;
  energy: boolean;
  shouldCost: boolean;
  supplierPrice: boolean;
}

interface CostModelState {
  weights: ComponentWeights;
  basePrice: number;
  supplierPrices: SupplierPriceEntry[];
  timeRange: TimeRange;
  visibleComponents: VisibleComponentsBool;

  setWeights: (weights: Partial<ComponentWeights>) => void;
  setBasePrice: (price: number) => void;
  addSupplierPrice: (entry: SupplierPriceEntry) => void;
  removeSupplierPrice: (date: string) => void;
  clearSupplierPrices: () => void;
  setSupplierPrices: (entries: SupplierPriceEntry[]) => void;
  setTimeRange: (range: TimeRange) => void;
  toggleComponent: (key: keyof VisibleComponentsBool) => void;
  applyTemplate: (template: 'steel' | 'aluminum' | 'logistics' | 'energy' | 'balanced') => void;
}

const TEMPLATES: Record<string, ComponentWeights> = {
  steel:     { steel: 55, aluminum: 20, transport: 15, energy: 10 },
  aluminum:  { steel: 15, aluminum: 55, transport: 20, energy: 10 },
  logistics: { steel: 25, aluminum: 15, transport: 45, energy: 15 },
  energy:    { steel: 20, aluminum: 20, transport: 20, energy: 40 },
  balanced:  { steel: 25, aluminum: 25, transport: 25, energy: 25 },
};

export const useCostModelStore = create<CostModelState>((set) => ({
  weights: { steel: 40, aluminum: 30, transport: 20, energy: 10 },
  basePrice: 1000,
  supplierPrices: [],
  timeRange: '3Y',
  visibleComponents: {
    steel: true,
    aluminum: true,
    transport: true,
    energy: true,
    shouldCost: true,
    supplierPrice: true,
  },

  setWeights: (partial) =>
    set((state) => ({ weights: { ...state.weights, ...partial } })),

  setBasePrice: (price) => set({ basePrice: price }),

  addSupplierPrice: (entry) =>
    set((state) => {
      const filtered = state.supplierPrices.filter((e) => e.date !== entry.date);
      return { supplierPrices: [...filtered, entry].sort((a, b) => a.date.localeCompare(b.date)) };
    }),

  removeSupplierPrice: (date) =>
    set((state) => ({
      supplierPrices: state.supplierPrices.filter((e) => e.date !== date),
    })),

  clearSupplierPrices: () => set({ supplierPrices: [] }),

  setSupplierPrices: (entries) =>
    set({ supplierPrices: [...entries].sort((a, b) => a.date.localeCompare(b.date)) }),

  setTimeRange: (range) => set({ timeRange: range }),

  toggleComponent: (key) =>
    set((state) => ({
      visibleComponents: {
        ...state.visibleComponents,
        [key]: !state.visibleComponents[key],
      },
    })),

  applyTemplate: (template) =>
    set({ weights: TEMPLATES[template] }),
}));
