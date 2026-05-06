import { useMemo, useEffect, useState } from 'react';
import type React from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import * as XLSX from 'xlsx';
import {
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Area,
  ReferenceLine,
  ReferenceDot,
} from 'recharts';
import { clsx } from 'clsx';
import type { CostDataRow, SupplierPriceEntry, HistoricalMacroEvent } from '../../../../shared/types';
import { useCostModelStore } from '../../store/costModelStore';
import { useMacroEventsStore } from '../../store/macroEventsStore';
import { useChatStore } from '../../store/chatStore';
import { calculateWeightedComponents } from '../../domain/costScan/calculateWeightedComponents';
import { calculateShouldCostFromWeighted } from '../../domain/costScan/calculateWeightedComponents';
import { aggregateMonthly, filterByTimeRange } from '../../data/providers/csvProvider';
import type { TimeRange } from '../../../../shared/types';
import { Tooltip, InfoIcon } from '../ui/Tooltip';

const COLORS = {
  steel:       '#3b82f6',
  aluminum:    '#8b5cf6',
  transport:   '#f59e0b',
  energy:      '#ef4444',
  shouldCost:  '#10b981',
  supplier:    '#ec4899',
};

const TIME_RANGES: TimeRange[] = ['1M', '3M', '6M', '1Y', '3Y', 'all'];

interface ChartDataPoint {
  date: string;
  steel: number;
  aluminum: number;
  transport: number;
  energy: number;
  shouldCost: number;
  supplierPrice: number | null;
  // for area shading
  marginTop: number | null;
  marginBottom: number | null;
}

/**
 * Linearly interpolate supplier price for months between known data points.
 * Returns null for months outside the known range.
 */
function interpolateSupplierPrices(
  dates: string[],
  entries: SupplierPriceEntry[]
): (number | null)[] {
  if (entries.length === 0) return dates.map(() => null);

  return dates.map((date) => {
    // Exact match
    const exact = entries.find((e) => e.date === date);
    if (exact) return exact.price;

    // Find surrounding entries
    const before = [...entries].filter((e) => e.date <= date).pop();
    const after = entries.find((e) => e.date >= date);

    if (!before && !after) return null;
    if (!before) return after!.price;
    if (!after) return before.price;
    if (before.date === after.date) return before.price;

    // Linear interpolation
    const t0 = new Date(before.date + '-01').getTime();
    const t1 = new Date(after.date + '-01').getTime();
    const tc = new Date(date + '-01').getTime();
    const ratio = (tc - t0) / (t1 - t0);
    return before.price + (after.price - before.price) * ratio;
  });
}

interface TooltipPayloadItem {
  dataKey: string;
  value: number;
  color: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  label?: string;
  weights: { steel: number; aluminum: number; transport: number; energy: number };
  t: (key: string) => string;
}

function CustomTooltip({ active, payload, label, weights, t }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;

  const get = (key: string) => payload.find((p) => p.dataKey === key);
  const steelEntry     = get('steel');
  const aluminumEntry  = get('aluminum');
  const transportEntry = get('transport');
  const energyEntry    = get('energy');
  const scEntry        = get('shouldCost');
  const supplierEntry  = get('supplierPrice');

  const shouldCost = scEntry?.value ?? null;
  const supplierPrice = supplierEntry?.value ?? null;
  const marginAbs = shouldCost !== null && supplierPrice !== null
    ? supplierPrice - shouldCost : null;

  const componentRows = [
    { key: 'steel',     label: t('chart.toggle.steel'),     entry: steelEntry,     weight: weights.steel },
    { key: 'aluminum',  label: t('chart.toggle.aluminum'),  entry: aluminumEntry,  weight: weights.aluminum },
    { key: 'transport', label: t('chart.toggle.transport'), entry: transportEntry, weight: weights.transport },
    { key: 'energy',    label: t('chart.toggle.energy'),    entry: energyEntry,    weight: weights.energy },
  ].filter((r) => r.entry !== undefined);

  return (
    <div className="bg-slate-800 dark:bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-2xl min-w-[220px]">
      <p className="text-slate-400 text-xs font-medium mb-2">{label}</p>

      {componentRows.map((r) => (
        <div key={r.key} className="flex items-center justify-between gap-4 text-xs py-0.5">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[r.key as keyof typeof COLORS] }} />
            <span className="text-slate-300">{r.label} ({r.weight}%)</span>
          </div>
          <span className="text-slate-100 font-medium tabular-nums">
            €{r.entry!.value.toFixed(1)}
          </span>
        </div>
      ))}

      {shouldCost !== null && (
        <div className="mt-2 pt-2 border-t border-slate-700 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-emerald-400 font-semibold">{t('chart.tooltip.shouldCost')}</span>
            <span className="text-emerald-400 font-bold tabular-nums">€{shouldCost.toFixed(1)}</span>
          </div>
          {supplierPrice !== null && (
            <div className="flex justify-between text-xs">
              <span className="text-pink-400">{t('chart.tooltip.supplier')}</span>
              <span className="text-pink-400 font-medium tabular-nums">€{supplierPrice.toFixed(1)}</span>
            </div>
          )}
          {marginAbs !== null && (
            <div className="flex justify-between text-xs pt-1 border-t border-slate-700">
              <span className="text-slate-400">{t('chart.tooltip.margin')}</span>
              <span className={clsx('font-medium tabular-nums', marginAbs > 0 ? 'text-red-400' : 'text-emerald-400')}>
                {marginAbs > 0 ? '+' : ''}€{marginAbs.toFixed(1)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface CostChartProps {
  data: CostDataRow[];
}

export function CostChart({ data }: CostChartProps) {
  const { t } = useTranslation();
  const {
    weights, basePrice, supplierPrices, timeRange,
    setTimeRange, visibleComponents, toggleComponent, setBasePrice,
  } = useCostModelStore();
  const { highlightDate, events, setHighlightDate, chartEvents, fetchChartEvents } = useMacroEventsStore();
  const { sendMessage } = useChatStore();
  const chatContext = useCostModelStore((s) => ({
    weights: s.weights,
    basePrice: s.basePrice,
    supplierPrices: s.supplierPrices,
    latestSupplierPrice: s.supplierPrices.length > 0
      ? s.supplierPrices[s.supplierPrices.length - 1].price
      : null,
    dateRange: s.timeRange,
  }));

  // Fetch historical events for chart annotations on mount
  useEffect(() => {
    void fetchChartEvents();
  }, [fetchChartEvents]);

  // Event visibility controls
  const [showEvents, setShowEvents] = useState(true);
  const [impactFilter, setImpactFilter] = useState<('high' | 'medium' | 'low')[]>(['high', 'medium']);
  const [eventTooltip, setEventTooltip] = useState<{ event: HistoricalMacroEvent; x: number; y: number } | null>(null);

  function toggleImpactFilter(level: 'high' | 'medium' | 'low') {
    setImpactFilter((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  }

  const chartData = useMemo((): ChartDataPoint[] => {
    if (data.length === 0) return [];

    const monthly = aggregateMonthly(data);
    const filtered = filterByTimeRange(monthly, timeRange);
    if (filtered.length === 0) return [];

    const baseline = monthly[0]; // Always Jan 2021 baseline

    const dates = filtered.map((r) => r.date);
    const interpolated = interpolateSupplierPrices(dates, supplierPrices);

    return filtered.map((row, i) => {
      const wc = calculateWeightedComponents(row, baseline, weights, basePrice);
      const sc = calculateShouldCostFromWeighted(wc);
      const sp = interpolated[i];

      return {
        date: row.date,
        steel:     wc.steel,
        aluminum:  wc.aluminum,
        transport: wc.transport,
        energy:    wc.energy,
        shouldCost: sc,
        supplierPrice: sp,
        marginTop:    sp !== null ? Math.max(sc, sp) : null,
        marginBottom: sp !== null ? Math.min(sc, sp) : null,
      };
    });
  }, [data, timeRange, weights, basePrice, supplierPrices]);

  const visibleEvents = useMemo(() =>
    chartEvents.filter((e) =>
      showEvents &&
      impactFilter.includes(e.impact as 'high' | 'medium' | 'low') &&
      chartData.some((d) => d.date === e.dateMonth)
    ),
    [chartEvents, showEvents, impactFilter, chartData]
  );

  const componentToggles = [
    { key: 'steel' as const,        label: t('chart.toggle.steel'),        color: COLORS.steel },
    { key: 'aluminum' as const,     label: t('chart.toggle.aluminum'),     color: COLORS.aluminum },
    { key: 'transport' as const,    label: t('chart.toggle.transport'),    color: COLORS.transport },
    { key: 'energy' as const,       label: t('chart.toggle.energy'),       color: COLORS.energy },
    { key: 'shouldCost' as const,   label: t('chart.toggle.shouldCost'),   color: COLORS.shouldCost },
    { key: 'supplierPrice' as const,label: t('chart.toggle.supplierPrice'),color: COLORS.supplier },
  ];

  if (data.length === 0) {
    return (
      <div className="h-[340px] flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500 text-sm">{t('chart.loading')}</p>
        </div>
      </div>
    );
  }

  function handleExport() {
    const rows = chartData.map((d) => ({
      Date: d.date,
      [t('chart.toggle.steel')]:     d.steel.toFixed(2),
      [t('chart.toggle.aluminum')]:  d.aluminum.toFixed(2),
      [t('chart.toggle.transport')]: d.transport.toFixed(2),
      [t('chart.toggle.energy')]:    d.energy.toFixed(2),
      'Should Cost':                 d.shouldCost.toFixed(2),
      [t('chart.toggle.supplierPrice')]: d.supplierPrice !== null ? d.supplierPrice.toFixed(2) : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cost Analysis');
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `cost-analysis-${date}.xlsx`);
  }

  return (
    <div className="space-y-3 p-4">
      {/* Reference price + export */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs text-fg-muted font-medium whitespace-nowrap">{t('model.basePrice')}</span>
          <Tooltip content={t('tooltip.basePrice')} side="right">
            <InfoIcon />
          </Tooltip>
          <div className="relative flex items-center">
            <span className="absolute left-2 text-fg-muted text-xs pointer-events-none">€</span>
            <input
              type="number"
              min={1}
              value={basePrice}
              onChange={(e) => setBasePrice(Math.max(1, Number(e.target.value)))}
              className="input-base pl-6 pr-2 py-1 text-sm w-24 h-8"
            />
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={chartData.length === 0}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-border
                     text-fg-muted hover:text-fg hover:border-fg-soft transition-colors disabled:opacity-40"
          title={t('chart.export')}
        >
          📥 {t('chart.export')}
        </button>
      </div>

      {/* Time range + axis label */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              className={clsx(
                'px-3 py-1 text-xs rounded-md font-medium transition-all duration-150',
                timeRange === r
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              )}
            >
              {t(`timeRange.${r}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-500">{t('chart.axisLabel')}</span>
          <Tooltip content={t('tooltip.costModel')} side="left">
            <InfoIcon />
          </Tooltip>
        </div>
      </div>

      {/* Toggle pills */}
      <div className="flex flex-wrap gap-1.5">
        {componentToggles.map((comp) => (
          <button
            key={comp.key}
            onClick={() => toggleComponent(comp.key)}
            className={clsx(
              'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
              visibleComponents[comp.key]
                ? 'border-transparent'
                : 'border-slate-700 text-slate-500 bg-transparent'
            )}
            style={
              visibleComponents[comp.key]
                ? { backgroundColor: comp.color + '22', borderColor: comp.color + '77', color: comp.color }
                : undefined
            }
          >
            <span
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: visibleComponents[comp.key] ? comp.color : '#475569' }}
            />
            {comp.label}
          </button>
        ))}
      </div>

      {/* Macro events controls */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-border/30">
        <button
          onClick={() => setShowEvents((v) => !v)}
          className={clsx(
            'flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all duration-150',
            showEvents
              ? 'bg-violet-500/15 border-violet-500/50 text-violet-400'
              : 'border-slate-700 text-slate-500'
          )}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: showEvents ? '#8b5cf6' : '#475569' }} />
          Makro eventy
        </button>
        {showEvents && (
          <>
            {(['high', 'medium', 'low'] as const).map((level) => {
              const color = level === 'high' ? '#ef4444' : level === 'medium' ? '#f59e0b' : '#22c55e';
              const active = impactFilter.includes(level);
              return (
                <button
                  key={level}
                  onClick={() => toggleImpactFilter(level)}
                  className={clsx(
                    'px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all duration-150',
                    active ? 'border-transparent' : 'border-slate-700 text-slate-500'
                  )}
                  style={active ? { backgroundColor: color + '22', borderColor: color + '77', color } : undefined}
                >
                  {level === 'high' ? '🔴 wysoki' : level === 'medium' ? '🟡 średni' : '🟢 niski'}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Macro event hover tooltip (fixed overlay) */}
      {eventTooltip && createPortal((() => {
        const TOOLTIP_H = 130;
        const TOOLTIP_W = 224;
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const x = eventTooltip.x + 14;
        const y = eventTooltip.y - 12;
        const top  = y + TOOLTIP_H > vh ? y - TOOLTIP_H - 8 : y;
        const left = x + TOOLTIP_W > vw ? eventTooltip.x - TOOLTIP_W - 10 : x;
        return (
          <div
            style={{ position: 'fixed', left, top, zIndex: 9999, pointerEvents: 'none' }}
            className="bg-slate-800 border border-slate-600 rounded-xl p-3 shadow-2xl text-xs max-w-[220px]"
          >
            <p className="font-semibold text-slate-100 mb-1">{eventTooltip.event.name}</p>
            <p className="text-slate-300 mb-1">{eventTooltip.event.label}</p>
            <p className="text-slate-400">
              Wpływ: {(eventTooltip.event.affects).join(', ')}
            </p>
            <p className="text-slate-500 mt-1">{eventTooltip.event.date}</p>
            <p className="text-[10px] text-slate-500 mt-1 italic">Kliknij, aby zapytać AI</p>
          </div>
        );
      })(), document.body)}

      {/* Chart */}
      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={chartData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: 'hsl(var(--border))' }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fill: '#64748b', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `€${v.toFixed(0)}`}
            domain={['auto', 'auto']}
            width={52}
          />
          <RechartsTooltip
            content={<CustomTooltip weights={weights} t={t} />}
          />

          {/* Shading between should cost and supplier price */}
          {visibleComponents.supplierPrice && supplierPrices.length > 0 && (
            <>
              <Area
                dataKey="marginTop"
                stroke="none"
                fill="#ec4899"
                fillOpacity={0.1}
                legendType="none"
                activeDot={false}
                isAnimationActive={false}
              />
              <Area
                dataKey="marginBottom"
                stroke="none"
                fill="#10b981"
                fillOpacity={0.1}
                legendType="none"
                activeDot={false}
                isAnimationActive={false}
              />
            </>
          )}

          {/* Component weighted lines */}
          {visibleComponents.steel && (
            <Line
              dataKey="steel"
              stroke={COLORS.steel}
              dot={false}
              strokeWidth={1.5}
              name={`${t('chart.toggle.steel')} (${weights.steel}%)`}
              isAnimationActive={false}
            />
          )}
          {visibleComponents.aluminum && (
            <Line
              dataKey="aluminum"
              stroke={COLORS.aluminum}
              dot={false}
              strokeWidth={1.5}
              name={`${t('chart.toggle.aluminum')} (${weights.aluminum}%)`}
              isAnimationActive={false}
            />
          )}
          {visibleComponents.transport && (
            <Line
              dataKey="transport"
              stroke={COLORS.transport}
              dot={false}
              strokeWidth={1.5}
              name={`${t('chart.toggle.transport')} (${weights.transport}%)`}
              isAnimationActive={false}
            />
          )}
          {visibleComponents.energy && (
            <Line
              dataKey="energy"
              stroke={COLORS.energy}
              dot={false}
              strokeWidth={1.5}
              name={`${t('chart.toggle.energy')} (${weights.energy}%)`}
              isAnimationActive={false}
            />
          )}

          {/* Should Cost — primary line, thick */}
          {visibleComponents.shouldCost && (
            <Line
              dataKey="shouldCost"
              stroke={COLORS.shouldCost}
              dot={false}
              strokeWidth={3}
              name={t('chart.tooltip.shouldCost')}
              isAnimationActive={false}
            />
          )}

          {/* Supplier price time series */}
          {visibleComponents.supplierPrice && supplierPrices.length > 0 && (
            <Line
              dataKey="supplierPrice"
              stroke={COLORS.supplier}
              dot={supplierPrices.length <= 12}
              strokeWidth={2}
              strokeDasharray="6 3"
              name={t('chart.tooltip.supplier')}
              connectNulls={false}
              isAnimationActive={false}
            />
          )}

          {/* Historical macro event dots */}
          {visibleEvents.map((e) => {
            const impactColor =
              e.impact === 'high'   ? '#ef4444' :
              e.impact === 'medium' ? '#f59e0b' : '#22c55e';
            const yVal = chartData.find((d) => d.date === e.dateMonth)?.shouldCost;
            if (yVal === undefined) return null;
            return (
              <ReferenceDot
                key={e.id}
                x={e.dateMonth}
                y={yVal}
                r={6}
                fill={impactColor}
                stroke="#1e293b"
                strokeWidth={2}
                style={{ cursor: 'pointer' }}
                onMouseEnter={(_: unknown, ev: React.MouseEvent) =>
                  setEventTooltip({ event: e, x: ev.clientX, y: ev.clientY })
                }
                onMouseMove={(_: unknown, ev: React.MouseEvent) =>
                  setEventTooltip((t) => t ? { ...t, x: ev.clientX, y: ev.clientY } : null)
                }
                onMouseLeave={() => setEventTooltip(null)}
                onClick={(_: unknown, ev: React.MouseEvent) => {
                  ev.stopPropagation();
                  setEventTooltip(null);
                  setHighlightDate(e.dateMonth);
                  void sendMessage(
                    `Explain what caused the ${e.label} on ${e.date} and its impact on my procurement cost model. ` +
                    `Affected categories: ${e.affects.join(', ')}.`,
                    chatContext
                  );
                }}
              />
            );
          })}

          {/* Macro event highlight line */}
          {highlightDate && chartData.some((d) => d.date === highlightDate) && (
            <ReferenceLine
              x={highlightDate}
              stroke="#f59e0b"
              strokeWidth={2}
              strokeDasharray="4 3"
              label={{
                value: events.find((e) => e.date.slice(0, 7) === highlightDate)?.event ?? 'Wydarzenie',
                position: 'top',
                fontSize: 10,
                fill: '#f59e0b',
              }}
              onClick={() => setHighlightDate(null)}
              style={{ cursor: 'pointer' }}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
