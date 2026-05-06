import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { clsx } from 'clsx';
import { useTranslation } from 'react-i18next';
import { useCategoryStore, TEMPLATES } from '../../store/categoryStore';
import type { CategoryTemplate, ComponentWeights } from '../../../../shared/types';

interface Props {
  onClose: () => void;
}

// ─── constants ────────────────────────────────────────────────────────────────

const COMPONENT_KEYS = ['steel', 'aluminum', 'transport', 'energy'] as const;
type ComponentKey = typeof COMPONENT_KEYS[number];

const TEMPLATE_LIST: Array<{
  key: Exclude<CategoryTemplate, 'custom'>;
  emoji: string;
  nameKey: string;
  descKey: string;
}> = [
  { key: 'steel',     emoji: '⚙️', nameKey: 'template.steel',    descKey: 'template.steel.desc' },
  { key: 'aluminum',  emoji: '🔩', nameKey: 'template.aluminum',  descKey: 'template.aluminum.desc' },
  { key: 'logistics', emoji: '🚚', nameKey: 'template.logistics', descKey: 'template.logistics.desc' },
  { key: 'energy',    emoji: '⚡', nameKey: 'template.energy',    descKey: 'template.energy.desc' },
  { key: 'balanced',  emoji: '⚖️', nameKey: 'template.balanced',  descKey: 'template.balanced.desc' },
];

// ─── ModeSwitcher ─────────────────────────────────────────────────────────────

function ModeSwitcher({ mode, onChange }: { mode: 'template' | 'custom'; onChange: (m: 'template' | 'custom') => void }) {
  const { t } = useTranslation();
  return (
    <div className="flex rounded-lg border border-border bg-surface-2 p-0.5 gap-0.5">
      {(['template', 'custom'] as const).map((m) => (
        <button
          key={m}
          onClick={() => onChange(m)}
          className={clsx(
            'flex-1 text-xs font-medium px-3 py-1.5 rounded-md transition-all duration-150',
            mode === m ? 'bg-blue-600 text-white shadow-sm' : 'text-fg-muted hover:text-fg'
          )}
        >
          {m === 'template' ? t('category.modeTemplate') : t('category.modeCustom')}
        </button>
      ))}
    </div>
  );
}

// ─── ComponentRow (autocomplete + % input) ────────────────────────────────────

interface RowProps {
  component: ComponentKey | '';
  weight: string;
  usedKeys: ComponentKey[];
  onComponentChange: (k: ComponentKey) => void;
  onWeightChange: (v: string) => void;
  onRemove: () => void;
  canRemove: boolean;
}

function ComponentRow({ component, weight, usedKeys, onComponentChange, onWeightChange, onRemove, canRemove }: RowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const available = COMPONENT_KEYS.filter((k) => k === component || !usedKeys.includes(k));
  const filtered = available.filter(
    (k) =>
      t(`chart.toggle.${k}`).toLowerCase().includes(query.toLowerCase()) ||
      k.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  return (
    <div className="flex items-center gap-2">
      {/* Autocomplete */}
      <div ref={ref} className="relative flex-1">
        <button
          type="button"
          onClick={() => { setOpen((o) => !o); setQuery(''); }}
          className={clsx(
            'w-full flex items-center justify-between px-3 py-2 rounded-lg border text-sm text-left transition-colors',
            open ? 'border-blue-500 ring-1 ring-blue-500/30 bg-surface' : 'border-border bg-surface-2 hover:border-fg-muted/50',
            !component && 'text-fg-muted'
          )}
        >
          <span>{component ? t(`chart.toggle.${component}`) : t('category.selectComponent')}</span>
          <svg className="w-3.5 h-3.5 text-fg-muted flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 z-20 bg-surface border border-border rounded-lg shadow-xl overflow-hidden">
            <div className="p-1.5">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('category.searchComponent')}
                className="w-full px-2.5 py-1.5 text-xs bg-surface-2 border border-border rounded-md
                           text-fg placeholder:text-fg-muted focus:outline-none focus:border-blue-500"
              />
            </div>
            <div className="max-h-36 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="text-xs text-fg-muted px-3 py-2">{t('category.noComponents')}</p>
              ) : (
                filtered.map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => { onComponentChange(k); setOpen(false); setQuery(''); }}
                    className={clsx(
                      'w-full text-left px-3 py-2 text-sm transition-colors flex items-center gap-2',
                      k === component ? 'bg-blue-600/15 text-blue-400' : 'hover:bg-surface-2 text-fg'
                    )}
                  >
                    {k === component && <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                    {t(`chart.toggle.${k}`)}
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* % input */}
      <div className="relative w-20 flex-shrink-0">
        <input
          type="number"
          min={0}
          max={100}
          value={weight}
          onChange={(e) => onWeightChange(e.target.value)}
          placeholder="0"
          className="w-full input-base py-2 pr-6 text-sm text-right tabular-nums"
        />
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-muted text-xs pointer-events-none">%</span>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        className="w-7 h-7 flex items-center justify-center rounded-md text-fg-muted
                   hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-20 flex-shrink-0"
      >
        ✕
      </button>
    </div>
  );
}

// ─── main modal ───────────────────────────────────────────────────────────────

export function CreateCategoryModal({ onClose }: Props) {
  const { t } = useTranslation();
  const { addCategory, updateActiveCategory } = useCategoryStore();

  const [mode, setMode] = useState<'template' | 'custom'>('template');

  // ── template mode ──
  const [selectedTpl, setSelectedTpl] = useState<Exclude<CategoryTemplate, 'custom'> | null>(null);
  const [tplName, setTplName] = useState('');

  // ── custom mode ──
  const [rows, setRows] = useState<Array<{ component: ComponentKey | ''; weight: string }>>([
    { component: 'steel', weight: '' },
  ]);
  const [customName, setCustomName] = useState('');
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const usedKeys = rows.map((r) => r.component).filter(Boolean) as ComponentKey[];
  const customTotal = rows.reduce((s, r) => s + (Number(r.weight) || 0), 0);
  const customOver = customTotal > 100;
  const customValid = customTotal === 100 && rows.every((r) => r.component !== '') && rows.length > 0;

  // ── template actions ──
  function handleUseTpl() {
    if (!selectedTpl) return;
    addCategory(tplName.trim() || t(`template.${selectedTpl}`), selectedTpl);
    onClose();
  }

  function handleCopyTpl() {
    if (!selectedTpl) return;
    const w = TEMPLATES[selectedTpl];
    setRows((Object.entries(w) as [ComponentKey, number][]).map(([k, v]) => ({ component: k, weight: String(v) })));
    setCustomName(`${tplName.trim() || t(`template.${selectedTpl}`)} (kopia)`);
    setMode('custom');
    setSelectedTpl(null);
  }

  // ── custom actions ──
  function addRow() {
    const remaining = COMPONENT_KEYS.filter((k) => !usedKeys.includes(k));
    // Always add a row — if no remaining, add empty so user sees dropdown with 'no results'
    setRows((prev) => [...prev, { component: remaining[0] ?? '', weight: '' }]);
  }

  function updateRow(i: number, patch: Partial<{ component: ComponentKey | ''; weight: string }>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  function handleCreateCustom() {
    setSubmitAttempted(true);
    if (!customValid) return;
    const weights: ComponentWeights = { steel: 0, aluminum: 0, transport: 0, energy: 0 };
    rows.forEach((r) => { if (r.component) weights[r.component] = Number(r.weight); });
    const name = customName.trim() || t('template.custom');
    addCategory(name, 'custom');
    updateActiveCategory({ weights, name });
    onClose();
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border rounded-2xl shadow-2xl w-full max-w-lg
                   flex flex-col max-h-[calc(100dvh-2rem)] overflow-y-auto animate-slide-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 flex-shrink-0">
          <h2 className="text-base font-semibold text-fg">{t('category.addTitle')}</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode switcher */}
        <div className="px-6 pb-4 flex-shrink-0">
          <ModeSwitcher
            mode={mode}
            onChange={(m) => { setMode(m); setSelectedTpl(null); }}
          />
        </div>

        {/* ── TEMPLATE MODE ── */}
        {mode === 'template' && (
          <div className="px-6 pb-6 space-y-3">
            {selectedTpl === null ? (
              // list
              <div className="space-y-2">
                {TEMPLATE_LIST.map((tpl) => (
                  <button
                    key={tpl.key}
                    onClick={() => { setSelectedTpl(tpl.key); setTplName(t(tpl.nameKey)); }}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-border
                               bg-surface-2 hover:border-blue-500/40 hover:bg-blue-500/5 transition-all text-left"
                  >
                    <span className="text-xl flex-shrink-0">{tpl.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-fg">{t(tpl.nameKey)}</p>
                      <p className="text-[11px] text-fg-muted mt-0.5 truncate">{t(tpl.descKey)}</p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      {(Object.entries(TEMPLATES[tpl.key]) as [ComponentKey, number][])
                        .sort(([, a], [, b]) => b - a)
                        .slice(0, 2)
                        .map(([k, v]) => (
                          <p key={k} className="text-[11px] text-fg-muted tabular-nums">
                            {t(`chart.toggle.${k}`)}: <span className="font-semibold text-fg">{v}%</span>
                          </p>
                        ))}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              // preview + actions
              <div className="space-y-4 animate-fade-in">
                <button
                  onClick={() => setSelectedTpl(null)}
                  className="text-xs text-fg-muted hover:text-fg flex items-center gap-1"
                >
                  ← {t('common.back')}
                </button>

                {/* weight bars */}
                <div className="bg-surface-2 rounded-xl border border-border p-4 space-y-2.5">
                  <p className="text-xs text-fg-muted uppercase tracking-wide font-medium mb-3">
                    {t('category.weightsPreview')}
                  </p>
                  {(Object.entries(TEMPLATES[selectedTpl]) as [ComponentKey, number][])
                    .sort(([, a], [, b]) => b - a)
                    .map(([k, v]) => (
                      <div key={k} className="flex items-center gap-3">
                        <span className="text-xs text-fg-soft w-20 flex-shrink-0">{t(`chart.toggle.${k}`)}</span>
                        <div className="flex-1 bg-surface rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${v}%` }} />
                        </div>
                        <span className="text-xs font-semibold text-fg tabular-nums w-8 text-right">{v}%</span>
                      </div>
                    ))}
                </div>

                {/* name */}
                <div>
                  <label className="text-xs text-fg-muted uppercase tracking-wide font-medium block mb-1.5">
                    {t('category.name')}
                  </label>
                  <input
                    value={tplName}
                    onChange={(e) => setTplName(e.target.value)}
                    placeholder={t(`template.${selectedTpl}`)}
                    className="input-base w-full"
                    autoFocus
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button onClick={handleUseTpl} className="btn-primary flex-1 text-sm">
                    {t('category.useTemplate')}
                  </button>
                  <button onClick={handleCopyTpl} className="btn-ghost flex-1 text-sm">
                    {t('category.copyAndEdit')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── CUSTOM MODE ── */}
        {mode === 'custom' && (
          <div className="px-6 pb-6 space-y-4">
            {/* name */}
            <div>
              <label className="text-xs text-fg-muted uppercase tracking-wide font-medium block mb-1.5">
                {t('category.name')}
              </label>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={t('category.namePlaceholder')}
                className="input-base w-full"
                autoFocus
              />
            </div>

            {/* components header */}
            <div className="flex items-center justify-between">
              <span className="text-xs text-fg-muted uppercase tracking-wide font-medium">
                {t('category.components')}
              </span>
              <span className={clsx(
                'text-xs font-semibold tabular-nums',
                customTotal === 100 ? 'text-emerald-500' : customOver ? 'text-red-400' : customTotal > 0 ? 'text-amber-500' : 'text-fg-muted'
              )}>
                {customTotal === 0 ? '' :
                  customTotal === 100 ? '100% ✓' :
                  customOver ? `${customTotal}% — za dużo ${customTotal - 100}%` :
                  `${customTotal}% — brakuje ${100 - customTotal}%`
                }
              </span>
            </div>

            {/* rows */}
            <div className="space-y-2">
              {rows.map((row, i) => (
                <ComponentRow
                  key={i}
                  component={row.component}
                  weight={row.weight}
                  usedKeys={usedKeys.filter((k) => k !== row.component)}
                  onComponentChange={(k) => updateRow(i, { component: k })}
                  onWeightChange={(v) => updateRow(i, { weight: v })}
                  onRemove={() => removeRow(i)}
                  canRemove={rows.length > 1}
                />
              ))}
            </div>

            {/* add row */}
            <button
              type="button"
              onClick={addRow}
              className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border
                         border-dashed border-border text-fg-muted hover:text-fg hover:border-fg-muted/50
                         text-xs transition-colors"
            >
              + {t('category.addComponent')}
            </button>

            {/* validation — only after first submit attempt */}
            {submitAttempted && !customValid && (
              <p className={clsx('text-xs', customOver ? 'text-red-400' : 'text-amber-500')}>
                ⚠ {t('category.sumWarning', { sum: customTotal })}
              </p>
            )}

            <button onClick={handleCreateCustom} className="btn-primary w-full">
              {t('category.create')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
