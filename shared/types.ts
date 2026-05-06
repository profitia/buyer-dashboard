export interface CostDataRow {
  date: string;
  steel: number;
  aluminum: number;
  transport: number;
  energy: number;
}

export type ComponentKey = 'steel' | 'aluminum' | 'transport' | 'energy';

export interface ComponentWeights {
  steel: number;
  aluminum: number;
  transport: number;
  energy: number;
}

export type MessageType = 'insight' | 'suggestion' | 'user' | 'assistant';

export interface SourceLink {
  name: string;
  url: string;
}

export interface Message {
  id: string;
  type: MessageType;
  content: string;
  timestamp: number;
  categoryId?: string;
  sources?: SourceLink[];
}

export interface SupplierPriceEntry {
  date: string;   // ISO yyyy-MM format
  price: number;  // EUR
}

export type TimeRange = '1M' | '3M' | '6M' | '1Y' | '3Y' | 'all';
export type Language = 'en' | 'pl';

// ── Category ─────────────────────────────────────────────────────────────────

export type CategoryTemplate = 'steel' | 'aluminum' | 'logistics' | 'energy' | 'balanced' | 'custom';

export interface Category {
  id: string;
  name: string;
  weights: ComponentWeights;
  basePrice: number;
  supplierPrices: SupplierPriceEntry[];
  timeRange: TimeRange;
  template: CategoryTemplate;
  createdAt: number;
  updatedAt: number;
}

// ── Chat Session ──────────────────────────────────────────────────────────────

export interface ChatSessionMeta {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

// ── API ───────────────────────────────────────────────────────────────────────

export interface ChatRequest {
  message: string;
  language: Language;
  sessionId?: string;
  categoryId?: string;
  context: {
    weights: ComponentWeights;
    basePrice: number;
    supplierPrices: SupplierPriceEntry[];
    latestSupplierPrice: number | null;
    dateRange: TimeRange;
    categoryName?: string;
  };
}

export interface ChatResponse {
  reply: string;
  sessionTitle?: string;
  sources?: SourceLink[];
}

// ── Category API ──────────────────────────────────────────────────────────────

export interface SaveCategoryRequest {
  id?: string;
  name: string;
  weights: ComponentWeights;
  basePrice: number;
  supplierPrices: SupplierPriceEntry[];
  timeRange: TimeRange;
  template: CategoryTemplate;
}

export interface SessionHistoryResponse {
  sessions: Array<{
    id: string;
    title: string;
    createdAt: string;
    updatedAt: string;
    messageCount: number;
  }>;
}

export interface SessionMessagesResponse {
  messages: Array<{
    id: string;
    role: string;
    content: string;
    createdAt: string;
  }>;
}

// ── Macro Events ──────────────────────────────────────────────────────────────

export interface MacroEvent {
  id: string;
  date: string;
  time: string;
  country: string;
  flag: string;
  event: string;
  seriesId: string;
  importance: 'high' | 'medium' | 'low';
  actual: number | null;
  forecast: number | null;
  previous: number | null;
  change: number | null;
  trend: 'up' | 'down' | 'flat' | null;
  unit: string;
  affects: string[];
  insight: string;
}

// ── Historical Macro Events (DB-backed, for chart annotations) ────────────────

export interface HistoricalMacroEvent {
  id: string;
  seriesId: string;
  name: string;
  date: string;       // YYYY-MM-DD
  dateMonth: string;  // YYYY-MM  (matches chart x-axis)
  value: number;
  prevValue: number | null;
  changePct: number | null;
  type: 'spike' | 'trend' | 'drop';
  impact: 'high' | 'medium' | 'low';
  affects: string[];
  label: string;      // e.g. "CPI spike +0.5%"
}
