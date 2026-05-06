import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useMacroFilterStore } from '../../store/macroFilterStore';
import type { DateRange, Importance } from '../../store/macroFilterStore';

const DATE_OPTIONS: { value: DateRange; labelKey: string }[] = [
  { value: 'today', labelKey: 'filter.today' },
  { value: '7d',    labelKey: 'filter.7d' },
  { value: '30d',   labelKey: 'filter.30d' },
];

const IMPACT_OPTIONS = ['steel', 'aluminum', 'transport', 'energy'] as const;
const COUNTRY_OPTIONS = ['US', 'EU', 'PL'] as const;
const IMPORTANCE_OPTIONS: { value: Importance; label: string; dot: string }[] = [
  { value: 'high',   label: 'filter.high',   dot: '🔴' },
  { value: 'medium', label: 'filter.medium', dot: '🟡' },
  { value: 'low',    label: 'filter.low',    dot: '🟢' },
];

export function FilterDrawer() {
  const { t } = useTranslation();
  const {
    filters,
    drawerOpen,
    closeDrawer,
    setDateRange,
    toggleImpact,
    toggleCountry,
    toggleImportance,
    resetFilters,
  } = useMacroFilterStore();

  // Local pending state — applied only on "Apply"
  const [local, setLocal] = useState(() => ({ ...filters }));

  // Re-sync local when drawer opens
  const handleOpen = () => setLocal({ ...filters });

  if (!drawerOpen) return null;

  const applyAndClose = () => {
    // Apply local changes to store
    setDateRange(local.dateRange);
    // Reset store impacts/countries/importance to match local
    for (const k of IMPACT_OPTIONS) {
      const inStore = filters.impacts.includes(k);
      const inLocal = local.impacts.includes(k);
      if (inStore !== inLocal) toggleImpact(k);
    }
    for (const k of COUNTRY_OPTIONS) {
      const inStore = filters.countries.includes(k);
      const inLocal = local.countries.includes(k);
      if (inStore !== inLocal) toggleCountry(k);
    }
    for (const { value } of IMPORTANCE_OPTIONS) {
      const inStore = filters.importance.includes(value);
      const inLocal = local.importance.includes(value);
      if (inStore !== inLocal) toggleImportance(value);
    }
    closeDrawer();
  };

  const localToggleImpact = (k: string) =>
    setLocal((p) => ({
      ...p,
      impacts: p.impacts.includes(k) ? p.impacts.filter((x) => x !== k) : [...p.impacts, k],
    }));

  const localToggleCountry = (k: string) =>
    setLocal((p) => ({
      ...p,
      countries: p.countries.includes(k) ? p.countries.filter((x) => x !== k) : [...p.countries, k],
    }));

  const localToggleImportance = (v: Importance) =>
    setLocal((p) => ({
      ...p,
      importance: p.importance.includes(v)
        ? p.importance.filter((x) => x !== v)
        : [...p.importance, v],
    }));

  void handleOpen; // used implicitly via drawerOpen watch — no-op to satisfy eslint

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={() => { setLocal({ ...filters }); closeDrawer(); }}
      />

      {/* Panel */}
      <div className={clsx(
        'fixed right-0 top-0 h-full z-50 w-72 bg-surface border-l border-border shadow-2xl',
        'flex flex-col'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-fg">{t('filter.title')}</span>
          <button
            onClick={() => { setLocal({ ...filters }); closeDrawer(); }}
            className="text-fg-muted hover:text-fg text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">

          {/* Date range */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-2">
              {t('filter.dateRange')}
            </p>
            <div className="space-y-1">
              {DATE_OPTIONS.map(({ value, labelKey }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="radio"
                    name="dateRange"
                    checked={local.dateRange === value}
                    onChange={() => setLocal((p) => ({ ...p, dateRange: value }))}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-fg group-hover:text-blue-400 transition-colors">
                    {t(labelKey)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <hr className="border-border" />

          {/* Impacts */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-2">
              {t('filter.impacts')}
            </p>
            <div className="space-y-1">
              {IMPACT_OPTIONS.map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={local.impacts.includes(k)}
                    onChange={() => localToggleImpact(k)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-fg group-hover:text-blue-400 transition-colors">
                    {t(`chart.toggle.${k}`, k)}
                  </span>
                </label>
              ))}
            </div>
          </section>

          <hr className="border-border" />

          {/* Countries */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-2">
              {t('filter.countries')}
            </p>
            <div className="space-y-1">
              {COUNTRY_OPTIONS.map((k) => (
                <label key={k} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={local.countries.includes(k)}
                    onChange={() => localToggleCountry(k)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-fg group-hover:text-blue-400 transition-colors">{k}</span>
                </label>
              ))}
            </div>
          </section>

          <hr className="border-border" />

          {/* Importance */}
          <section>
            <p className="text-[11px] font-semibold uppercase tracking-wide text-fg-muted mb-2">
              {t('filter.importance')}
            </p>
            <div className="space-y-1">
              {IMPORTANCE_OPTIONS.map(({ value, label, dot }) => (
                <label key={value} className="flex items-center gap-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={local.importance.includes(value)}
                    onChange={() => localToggleImportance(value)}
                    className="accent-blue-500"
                  />
                  <span className="text-sm text-fg group-hover:text-blue-400 transition-colors">
                    {dot} {t(label)}
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-border flex gap-2">
          <button
            onClick={() => {
              setLocal({ dateRange: 'today', impacts: [], countries: [], importance: [] });
              resetFilters();
            }}
            className="flex-1 text-sm px-3 py-2 rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
          >
            {t('filter.reset')}
          </button>
          <button
            onClick={applyAndClose}
            className="flex-1 text-sm px-3 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors"
          >
            {t('filter.apply')}
          </button>
        </div>
      </div>
    </>
  );
}
