import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useMacroEventsStore } from '../../store/macroEventsStore';
import { useMacroFilterStore } from '../../store/macroFilterStore';
import { MacroEventCard } from './MacroEventCard';
import { QuickFilterBar } from '../filters/QuickFilterBar';
import { FilterChips } from '../filters/FilterChips';
import { FilterDrawer } from '../filters/FilterDrawer';
import { SaveViewModal } from '../filters/SaveViewModal';
import type { MacroEvent } from '../../../../shared/types';

function groupByDay(
  events: MacroEvent[],
  todayLabel: string,
  yesterdayLabel: string,
): { label: string; events: MacroEvent[] }[] {
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const map = new Map<string, MacroEvent[]>();
  for (const e of events) {
    const list = map.get(e.date) ?? [];
    list.push(e);
    map.set(e.date, list);
  }

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 15)
    .map(([date, evts]) => ({
      label: date === today ? todayLabel : date === yesterday ? yesterdayLabel : `📅 ${date}`,
      events: evts,
    }));
}

export function MacroEventsPanel() {
  const { t, i18n } = useTranslation();
  const { events, isLoading, error, fetchEvents } = useMacroEventsStore();
  const { filters, getDateCutoff } = useMacroFilterStore();

  useEffect(() => {
    fetchEvents(i18n.language);
  }, [fetchEvents, i18n.language]);

  // Apply filters
  const filtered = events.filter((e) => {
    // Date range
    const cutoff = getDateCutoff();
    if (cutoff !== null && e.date < cutoff) return false;

    // Impacts
    if (filters.impacts.length > 0 && !e.affects.some((a) => filters.impacts.includes(a)))
      return false;

    // Countries
    if (filters.countries.length > 0 && !filters.countries.includes(e.country))
      return false;

    // Importance
    if (filters.importance.length > 0 && !filters.importance.includes(e.importance))
      return false;

    return true;
  });

  const groups = groupByDay(filtered, t('macro.today'), t('macro.yesterday'));
  const highCount = events.filter(
    (e) => e.date === new Date().toISOString().split('T')[0] && e.importance === 'high'
  ).length;

  return (
    <div className="space-y-3">
      {/* Panel header */}
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-semibold text-fg-muted uppercase tracking-wide">
          Makro &amp; Rynki
        </h3>
        {highCount > 0 && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
            🔴 {highCount} dziś
          </span>
        )}
        <button
          onClick={() => fetchEvents(i18n.language)}
          className="ml-auto text-[11px] text-fg-muted hover:text-fg transition-colors"
          title={t('macro.refresh')}
        >
          ↺
        </button>
      </div>

      {/* Quick filter bar */}
      <QuickFilterBar />

      {/* Active filter chips */}
      <FilterChips />

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-fg-muted">{t('macro.loading')}</span>
        </div>
      )}

      {/* Error */}
      {error && !isLoading && (
        <p className="text-xs text-red-400">⚠ {error}</p>
      )}

      {/* Groups */}
      {!isLoading && groups.map((group) => (
        <div key={group.label} className="space-y-2">
          <p className={clsx('text-xs font-semibold text-fg-soft')}>{group.label}</p>
          {group.events.map((e) => (
            <MacroEventCard key={e.id} event={e} />
          ))}
        </div>
      ))}

      {/* Empty */}
      {!isLoading && !error && groups.length === 0 && (
        <p className="text-xs text-fg-muted text-center py-4">
          {t('macro.noData')}
        </p>
      )}

      {/* Drawer & modal — rendered in-tree, portal-like via fixed positioning */}
      <FilterDrawer />
      <SaveViewModal />
    </div>
  );
}
