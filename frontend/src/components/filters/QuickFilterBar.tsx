import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useMacroFilterStore } from '../../store/macroFilterStore';
import type { DateRange } from '../../store/macroFilterStore';

const DATE_TABS: { value: DateRange; labelKey: string }[] = [
  { value: 'all',   labelKey: 'filter.all' },
  { value: 'today', labelKey: 'filter.today' },
  { value: '7d',    labelKey: 'filter.7d' },
  { value: '30d',   labelKey: 'filter.30d' },
];

export function QuickFilterBar() {
  const { t } = useTranslation();
  const {
    filters,
    savedViews,
    activeViewId,
    setDateRange,
    openDrawer,
    openSaveModal,
    fetchViews,
    applyView,
    clearView,
  } = useMacroFilterStore();

  useEffect(() => {
    void fetchViews();
  }, [fetchViews]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Date range tabs */}
      <div className="flex items-center gap-1 bg-surface-2 rounded-lg p-0.5">
        {DATE_TABS.map(({ value, labelKey }) => (
          <button
            key={value}
            onClick={() => setDateRange(value)}
            className={clsx(
              'text-xs px-2.5 py-1 rounded-md transition-colors font-medium',
              filters.dateRange === value
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-fg-muted hover:text-fg'
            )}
          >
            {t(labelKey)}
          </button>
        ))}
      </div>

      {/* Filters button */}
      <button
        onClick={openDrawer}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
      >
        🔍 {t('filter.filters')}
      </button>

      {/* Saved view selector */}
      {savedViews.length > 0 && (
        <div className="relative">
          <select
            value={activeViewId ?? ''}
            onChange={(e) => {
              if (!e.target.value) { clearView(); return; }
              const view = savedViews.find((v) => v.id === e.target.value);
              if (view) applyView(view);
            }}
            className="text-xs px-2.5 py-1.5 pr-6 rounded-lg border border-border bg-surface text-fg-muted hover:text-fg appearance-none cursor-pointer transition-colors"
          >
            <option value="">{t('filter.viewAll')}</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-fg-muted text-[10px]">▼</span>
        </div>
      )}

      {/* Save view button */}
      <button
        onClick={openSaveModal}
        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-fg-muted hover:text-fg hover:border-fg-muted transition-colors"
      >
        💾 {t('filter.saveView')}
      </button>
    </div>
  );
}
