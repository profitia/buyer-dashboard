import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { getCostData, aggregateMonthly } from './data/providers/csvProvider';
import { CategoryTabs } from './components/category/CategoryTabs';
import { LanguageSwitcher } from './components/ui/LanguageSwitcher';
import { ThemeToggle } from './components/ui/ThemeToggle';
import DashboardGrid from './components/dashboard/DashboardGrid';
import { useCategoryStore } from './store/categoryStore';
import { useChatStore } from './store/chatStore';
import { useThemeStore } from './store/themeStore';
import { generateInsights } from './services/insights/generateInsights';
import { calculateWeightedComponents, calculateShouldCostFromWeighted } from './domain/costScan/calculateWeightedComponents';
import { calculateMargin } from './domain/costScan/calculateMargin';
import { useCostModelStore } from './store/costModelStore';
import type { CostDataRow, Language } from '../../shared/types';
import { useState } from 'react';

export default function App() {
  const { t, i18n } = useTranslation();
  const { theme } = useThemeStore();
  const { activeCategory, activeCategoryId, updateActiveCategory } = useCategoryStore();
  const { addMessage, language } = useChatStore();
  const { setWeights, setBasePrice, setSupplierPrices, setTimeRange } = useCostModelStore();
  const [data, setData] = useState<CostDataRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Track which category generated initial insights (per session, not across renders)
  const insightedCategories = useRef<Set<string>>(new Set());

  const category = activeCategory();

  // Load CSV data on mount
  useEffect(() => {
    getCostData()
      .then((rows) => { setData(rows); setLoading(false); })
      .catch((err) => { console.error('Failed to load CSV:', err); setLoading(false); });
  }, []);

  // Sync costModelStore with active category (for CostModelBuilder + SupplierPriceInput components)
  useEffect(() => {
    if (!category) return;
    setWeights(category.weights);
    setBasePrice(category.basePrice);
    setSupplierPrices(category.supplierPrices);
    setTimeRange(category.timeRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCategoryId]);

  // Generate auto-insights when data loads or category changes
  useEffect(() => {
    if (data.length === 0 || !category) return;
    if (insightedCategories.current.has(activeCategoryId)) return;
    insightedCategories.current.add(activeCategoryId);

    const isFirstLoad = insightedCategories.current.size === 1;
    if (isFirstLoad) {
      addMessage('insight', t('insight.welcome'));
    } else {
      addMessage('insight', language === 'pl'
        ? `Przełączono na kategorię **${category.name}** 🔄 Analizuję dane…`
        : `Switched to **${category.name}** 🔄 Analysing data…`
      );
    }

    const insights = generateInsights(data, category.weights, language as Language, category.basePrice);
    insights.forEach((insight) => {
      setTimeout(() => addMessage('insight', t(insight.messageKey, insight.params)), insight.delay);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, activeCategoryId]);

  // Init i18n from store language (already initialised from localStorage/browser in chatStore)
  // Run once on mount — syncs i18n with stored language
  useEffect(() => {
    void i18n.changeLanguage(language);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync subsequent language changes → i18n (silent, no chat message)
  const prevLang = useRef(language);
  useEffect(() => {
    if (prevLang.current === language) return;
    prevLang.current = language;
    void i18n.changeLanguage(language);
  }, [language, i18n]);

  // Latest supplier price from active category
  const latestSupplierPrice = useMemo(() => {
    if (!category || category.supplierPrices.length === 0) return null;
    return [...category.supplierPrices].sort((a, b) => b.date.localeCompare(a.date))[0].price;
  }, [category]);

  // Should cost stats from latest data point
  const stats = useMemo(() => {
    if (data.length === 0 || !category) return null;
    const monthly = aggregateMonthly(data);
    if (monthly.length === 0) return null;
    const baseline = monthly[0];
    const latest   = monthly[monthly.length - 1];
    const wc       = calculateWeightedComponents(latest, baseline, category.weights, category.basePrice);
    const shouldCostAbs = calculateShouldCostFromWeighted(wc);
    const margin = latestSupplierPrice !== null ? calculateMargin(latestSupplierPrice, shouldCostAbs) : null;
    return { shouldCostAbs, margin };
  }, [data, category, latestSupplierPrice]);

  // Sync costModel changes back to category store (from CostModelBuilder/SupplierPriceInput)
  const costModel = useCostModelStore();
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!category) return;
    // Debounce to avoid rapid updates
    if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    syncTimeoutRef.current = setTimeout(() => {
      updateActiveCategory({
        weights: costModel.weights,
        basePrice: costModel.basePrice,
        supplierPrices: costModel.supplierPrices,
        timeRange: costModel.timeRange,
      });
    }, 300);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [costModel.weights, costModel.basePrice, costModel.supplierPrices, costModel.timeRange]);

  return (
    <div className={clsx('flex flex-col h-screen overflow-hidden bg-background text-fg', theme)}>

      {/* ── Header ───────────────────────────────────────────────── */}
      <header className="flex-shrink-0 border-b border-border bg-surface/90 backdrop-blur-sm z-10">

        {/* Top row: logo + KPIs + controls */}
        <div className="h-14 flex items-center justify-between px-5">

          {/* Left: logo + inline KPIs */}
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center
                              text-white font-bold text-xs flex-shrink-0">
                S
              </div>
              <span className="font-semibold text-sm text-fg leading-tight">Buyer Dashboard</span>
            </div>

            <div className="h-5 w-px bg-border" />

            {stats && (
              <div className="hidden sm:flex items-center gap-5">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-fg-muted font-medium leading-tight">Should Cost</div>
                  <div className="text-sm font-semibold text-fg tabular-nums">
                    €{stats.shouldCostAbs.toFixed(0)}
                    <span className="text-[10px] text-fg-muted font-normal ml-1">/ ref €{category?.basePrice}</span>
                  </div>
                </div>
                {stats.margin && (
                  <>
                    <div className="h-5 w-px bg-border" />
                    <div>
                      <div className="text-[10px] uppercase tracking-wide text-fg-muted font-medium leading-tight">{t('supplier.margin')}</div>
                      <div className="flex items-center gap-1.5">
                        <span className={clsx('text-sm font-semibold tabular-nums', stats.margin.isOvercharge ? 'text-red-500' : 'text-emerald-500')}>
                          {stats.margin.percent > 0 ? '+' : ''}{stats.margin.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageSwitcher />
          </div>
        </div>

        {/* Second row: category tabs */}
        <div className="h-10 flex items-center px-4 border-t border-border/50">
          <CategoryTabs />
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden flex flex-col">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-3">
              <div className="w-9 h-9 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-fg-muted text-sm">{t('chart.loading')}</p>
            </div>
          </div>
        ) : (
          <DashboardGrid
            data={data}
            shouldCostAbs={stats?.shouldCostAbs ?? null}
            basePrice={category?.basePrice ?? null}
            margin={stats?.margin ?? null}
          />
        )}
      </main>
    </div>
  );
}


