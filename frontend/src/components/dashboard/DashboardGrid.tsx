import { useState, useEffect, useCallback, useRef } from 'react';
import type React from 'react';
import { useTranslation } from 'react-i18next';
import { ResponsiveGridLayout, useContainerWidth } from 'react-grid-layout';
import type { LayoutItem } from 'react-grid-layout';
import { clsx } from 'clsx';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

import ChartWidget from './widgets/ChartWidget';
import ChatWidget from './widgets/ChatWidget';
import MacroWidget from './widgets/MacroWidget';
import ModelWidget from './widgets/ModelWidget';
import type { CostDataRow } from '../../../../shared/types';

// ── Layout defaults ──────────────────────────────────────────────────────────

const DEFAULT_LAYOUT: LayoutItem[] = [
  { i: 'chart', x: 0, y: 0,  w: 8, h: 7, minW: 4, maxW: 12, minH: 4 },
  { i: 'chat',  x: 8, y: 0,  w: 4, h: 7, minW: 3, maxW: 6,  minH: 4 },
  { i: 'macro', x: 0, y: 7,  w: 6, h: 5, minW: 3, maxW: 12, minH: 3 },
  { i: 'model', x: 6, y: 7,  w: 6, h: 5, minW: 3, maxW: 12, minH: 3 },
];

const STORAGE_KEY = 'bd_dashboard_layout';
const COLLAPSED_KEY = 'bd_collapsed_widgets';
const COLLAPSED_H = 1; // header-only (1 grid row unit)
const TOTAL_COLS = 12;

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSED_KEY);
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
  } catch {
    return {};
  }
}

// Stretch the widest top-row item to fill any gap on the right
function stretchLayout(items: LayoutItem[]): LayoutItem[] {
  const maxRight = Math.max(...items.map((it) => it.x + it.w));
  if (maxRight >= TOTAL_COLS) return items;
  const diff = TOTAL_COLS - maxRight;
  const minY = Math.min(...items.map((it) => it.y));
  const topRow = items.filter((it) => it.y === minY);
  const biggest = [...topRow].sort((a, b) => b.w - a.w)[0];
  if (!biggest) return items;
  return items.map((it) =>
    it.i === biggest.i ? { ...it, w: it.w + diff } : it
  );
}

function loadLayout(): LayoutItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed: LayoutItem[] = JSON.parse(raw) as LayoutItem[];
    // Validate — must have same widget ids
    const ids = new Set(parsed.map((l) => l.i));
    if (!DEFAULT_LAYOUT.every((d) => ids.has(d.i))) return DEFAULT_LAYOUT;
    // Re-apply constraints from DEFAULT_LAYOUT (minW/maxW/minH may have changed)
    return parsed.map((item) => {
      const def = DEFAULT_LAYOUT.find((d) => d.i === item.i)!;
      return { ...item, minW: def.minW, maxW: def.maxW, minH: def.minH };
    });
  } catch {
    return DEFAULT_LAYOUT;
  }
}

// ── Widget titles & icons ────────────────────────────────────────────────────

const WIDGET_META: Record<string, { icon: string; labelKey: string }> = {
  chart: { icon: '📊', labelKey: 'chart.title' },
  chat:  { icon: '💬', labelKey: 'chat.title' },
  macro: { icon: '🌐', labelKey: 'macro.panelTitle' },
  model: { icon: '⚙️', labelKey: 'model.title' },
};

// ── Props ────────────────────────────────────────────────────────────────────

interface MarginStats {
  percent: number;
  absolute: number;
  isOvercharge: boolean;
}

interface Props {
  data: CostDataRow[];
  shouldCostAbs: number | null;
  basePrice: number | null;
  margin: MarginStats | null;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function DashboardGrid({ data, shouldCostAbs, basePrice, margin }: Props) {
  const { t } = useTranslation();
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>(loadCollapsed);
  const [layout, setLayout] = useState<LayoutItem[]>(() => {
    const collapsed = loadCollapsed();
    const base = stretchLayout(loadLayout());
    return base.map(item =>
      collapsed[item.i]
        ? { ...item, h: COLLAPSED_H, minH: COLLAPSED_H }
        : item
    );
  });
  const [editMode, setEditMode] = useState(false);
  // Track pre-collapse heights so we can restore them on expand
  const expandedHeightsRef = useRef<Record<string, number>>(
    Object.fromEntries(DEFAULT_LAYOUT.map(d => [d.i, d.h]))
  );
  const { width, containerRef, mounted } = useContainerWidth();

  // Persist layout on every change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  }, [layout]);

  // Persist collapsed state
  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify(collapsedMap));
  }, [collapsedMap]);

  const handleLayoutChange = useCallback((newLayout: readonly LayoutItem[]) => {
    setLayout(stretchLayout([...newLayout]));
  }, []);

  const resetLayout = useCallback(() => {
    setLayout(DEFAULT_LAYOUT);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsedMap(prev => {
      const wasCollapsed = prev[id] ?? false;
      const next = { ...prev, [id]: !wasCollapsed };
      setLayout(current => current.map(item => {
        if (item.i !== id) return item;
        const def = DEFAULT_LAYOUT.find(d => d.i === id)!;
        if (!wasCollapsed) {
          // Collapsing: save current h, shrink to header row
          expandedHeightsRef.current[id] = item.h > COLLAPSED_H ? item.h : def.h;
          return { ...item, h: COLLAPSED_H, minH: COLLAPSED_H };
        } else {
          // Expanding: restore saved h
          const savedH = expandedHeightsRef.current[id] ?? def.h;
          return { ...item, h: savedH, minH: def.minH };
        }
      }));
      return next;
    });
  }, []);

  const renderWidget = (id: string) => {
    switch (id) {
      case 'chart': return <ChartWidget data={data} />;
      case 'chat':  return <ChatWidget />;
      case 'macro': return <MacroWidget />;
      case 'model': return <ModelWidget shouldCostAbs={shouldCostAbs} basePrice={basePrice} margin={margin} />;
      default:      return null;
    }
  };

  return (
    <div className="flex flex-col min-h-0">

      {/* ── Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center justify-end gap-2 px-4 py-2 border-b border-border/50 flex-shrink-0">
        {editMode && (
          <button
            onClick={resetLayout}
            className="text-xs text-fg-muted hover:text-fg px-2.5 py-1 rounded-lg border border-border hover:border-fg-muted transition-colors"
          >
            ↺ {t('dashboard.resetLayout', 'Reset layout')}
          </button>
        )}
        <button
          onClick={() => setEditMode((v) => !v)}
          className={clsx(
            'text-xs px-3 py-1 rounded-lg border transition-colors font-medium',
            editMode
              ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
              : 'text-fg-muted border-border hover:border-fg-muted hover:text-fg'
          )}
        >
          {editMode ? t('dashboard.doneEditing', 'Zakończ edycję') : t('dashboard.editLayout', 'Edytuj layout')}
        </button>
      </div>

      {/* ── Grid ────────────────────────────────────────────────── */}
      <div ref={containerRef as React.RefObject<HTMLDivElement>} className="w-full overflow-auto flex-1">
        {mounted && (
        <ResponsiveGridLayout
          className="layout"
          layouts={{ lg: layout }}
          breakpoints={{ lg: 1200, md: 996, sm: 768 }}
          cols={{ lg: 12, md: 10, sm: 6 }}
          rowHeight={60}
          width={width}
          margin={[12, 12]}
          containerPadding={[16, 16]}
          dragConfig={{ enabled: editMode, bounded: false, handle: '.widget-drag-handle' }}
          resizeConfig={{ enabled: editMode, handles: ['se', 's', 'e'] }}
          onLayoutChange={(currentLayout) => handleLayoutChange([...currentLayout])}
        >
          {layout.map(({ i }) => {
            const meta = WIDGET_META[i];
            return (
              <div
                key={i}
                className={clsx(
                  'bg-surface rounded-xl border flex flex-col overflow-hidden transition-shadow',
                  editMode
                    ? 'border-blue-500/40 shadow-lg shadow-blue-500/10 ring-1 ring-blue-500/20'
                    : 'border-border shadow-sm'
                )}
              >
                {/* Widget header */}
                <div
                  className={clsx(
                    'widget-drag-handle flex items-center gap-2 px-3 py-2 border-b border-border/60 flex-shrink-0',
                    editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'
                  )}
                >
                  <span className="text-sm">{meta?.icon}</span>
                  <span className="text-xs font-medium text-fg-muted uppercase tracking-wide leading-none">
                    {t(meta?.labelKey ?? i, i)}
                  </span>
                  <div className="ml-auto flex items-center gap-1.5">
                    <button
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={() => toggleCollapse(i)}
                      className="text-fg-muted hover:text-fg transition-colors px-1 py-0.5 rounded hover:bg-white/5 leading-none"
                      title={collapsedMap[i] ? 'Expand' : 'Collapse'}
                    >
                      <span className="text-[11px]">{collapsedMap[i] ? '▶' : '⌄'}</span>
                    </button>
                    {editMode && (
                      <span className="text-[10px] text-blue-400 select-none">⠿ drag</span>
                    )}
                  </div>
                </div>

                {/* Widget body */}
                <div
                  className={clsx(
                    'overflow-hidden transition-all duration-300 ease-in-out',
                    collapsedMap[i]
                      ? 'max-h-0 opacity-0 pointer-events-none'
                      : 'max-h-[2000px] opacity-100 flex-1 min-h-0'
                  )}
                >
                  <div className="h-full p-3">
                    {renderWidget(i)}
                  </div>
                </div>
              </div>
            );
          })}
        </ResponsiveGridLayout>
        )}
      </div>
    </div>
  );
}
