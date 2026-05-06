import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import type { MacroEvent } from '../../../../shared/types';
import { useMacroEventsStore } from '../../store/macroEventsStore';
import { useChatStore } from '../../store/chatStore';
import { useCostModelStore } from '../../store/costModelStore';
import { useCategoryStore } from '../../store/categoryStore';

interface Props {
  event: MacroEvent;
}

const COMPONENT_COLORS: Record<string, string> = {
  steel:     'text-blue-400',
  aluminum:  'text-purple-400',
  transport: 'text-amber-400',
  energy:    'text-red-400',
};

function ImportanceDots({ level }: { level: 'high' | 'medium' | 'low' }) {
  const count = level === 'high' ? 3 : level === 'medium' ? 2 : 1;
  const color = level === 'high' ? 'bg-red-500' : level === 'medium' ? 'bg-amber-500' : 'bg-slate-500';
  return (
    <span className="flex items-center gap-0.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <span
          key={i}
          className={clsx('w-1.5 h-1.5 rounded-full', i < count ? color : 'bg-border')}
        />
      ))}
    </span>
  );
}

function TrendBadge({ actual, forecast, change, inLineLabel }: { actual: number | null; forecast: number | null; change: number | null; inLineLabel: string }) {
  if (actual === null) return null;

  const vsExpected = forecast !== null ? actual - forecast : null;
  const isAbove = vsExpected !== null && vsExpected > 0;
  const isBelow = vsExpected !== null && vsExpected < 0;
  const isInLine = vsExpected !== null && vsExpected === 0;

  if (isAbove) return <span className="text-xs font-bold text-red-400">🔴 +{vsExpected.toFixed(2)}</span>;
  if (isBelow) return <span className="text-xs font-bold text-emerald-400">🟢 {vsExpected.toFixed(2)}</span>;
  if (isInLine) return <span className="text-xs text-fg-muted">{inLineLabel}</span>;
  if (change !== null && change > 0) return <span className="text-xs text-red-400">↑ +{change.toFixed(2)}</span>;
  if (change !== null && change < 0) return <span className="text-xs text-emerald-400">↓ {change.toFixed(2)}</span>;
  return null;
}

export function MacroEventCard({ event }: Props) {
  const { t } = useTranslation();
  const { setHighlightDate } = useMacroEventsStore();
  const { sendMessage, addMessage } = useChatStore();
  const costModel = useCostModelStore();
  const { activeCategory } = useCategoryStore();
  const category = activeCategory();

  // Convert event date to YYYY-MM for chart highlight
  const chartDate = event.date.slice(0, 7);

  function handleShowOnChart() {
    setHighlightDate(chartDate);
    // Scroll to top of main content
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleAskAI() {
    if (!category) {
      addMessage('insight', t('macro.noCategory'));
      return;
    }
    const affectsList = event.affects.map((k) => t(`chart.toggle.${k}`, k)).join(', ');
    const valueStr = event.actual !== null
      ? t('macro.aiValue', { actual: event.actual, unit: event.unit })
      : t('macro.aiNoData');
    const message = t('macro.aiPrompt', {
      event: event.event,
      value: valueStr,
      affects: affectsList,
      insight: event.insight,
    });

    sendMessage(message, {
      weights: costModel.weights,
      basePrice: costModel.basePrice,
      supplierPrices: costModel.supplierPrices,
      latestSupplierPrice: costModel.supplierPrices.length > 0
        ? [...costModel.supplierPrices].sort((a, b) => b.date.localeCompare(a.date))[0].price
        : null,
      dateRange: costModel.timeRange,
      categoryName: category.name,
    }, category.id);
  }

  return (
    <div className={clsx(
      'rounded-xl border bg-surface-2 p-3.5 space-y-3 transition-all',
      event.importance === 'high' ? 'border-red-500/20' : 'border-border'
    )}>
      {/* Header row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">{event.flag}</span>
          <span className="text-sm font-semibold text-fg truncate">{event.event}</span>
          <ImportanceDots level={event.importance} />
        </div>
        <span className="text-[11px] text-fg-muted flex-shrink-0 tabular-nums">{event.time}</span>
      </div>

      {/* Values */}
      {(event.actual !== null || event.forecast !== null || event.previous !== null) && (
        <div className="flex items-center gap-4 text-xs">
          {event.forecast !== null && (
            <div>
              <p className="text-fg-muted">{t('macro.forecast')}</p>
              <p className="font-medium text-fg tabular-nums">{event.forecast} {event.unit}</p>
            </div>
          )}
          {event.previous !== null && (
            <div>
              <p className="text-fg-muted">{t('macro.previous')}</p>
              <p className="font-medium text-fg tabular-nums">{event.previous} {event.unit}</p>
            </div>
          )}
          {event.actual !== null && (
            <div>
              <p className="text-fg-muted">{t('macro.actual')}</p>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-fg tabular-nums">{event.actual} {event.unit}</p>
                <TrendBadge actual={event.actual} forecast={event.forecast} change={event.change} inLineLabel={t('macro.inLine')} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Affects */}
      {event.affects.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] text-fg-muted">{t('macro.affects')}</span>
          {event.affects.map((k) => (
            <span key={k} className={clsx('text-[11px] font-semibold', COMPONENT_COLORS[k] ?? 'text-fg-muted')}>
              ● {t(`chart.toggle.${k}`, k)}
            </span>
          ))}
        </div>
      )}

      {/* Insight */}
      <p className="text-[11px] text-fg-muted italic leading-relaxed border-l-2 border-border pl-2">
        {event.insight}
      </p>

      {/* Actions */}
      <div className="flex gap-2 pt-0.5">
        <button
          onClick={handleShowOnChart}
          className="flex-1 text-[11px] py-1.5 px-2.5 rounded-lg border border-border text-fg-muted
                     hover:text-fg hover:border-fg-muted/50 transition-colors"
        >
          {t('macro.showOnChart')}
        </button>
        <button
          onClick={handleAskAI}
          className="flex-1 text-[11px] py-1.5 px-2.5 rounded-lg bg-blue-600/10 border border-blue-500/30
                     text-blue-400 hover:bg-blue-600/20 transition-colors"
        >
          {t('macro.askAI')}
        </button>
      </div>
    </div>
  );
}
