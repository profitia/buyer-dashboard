import { useTranslation } from 'react-i18next';
import { clsx } from 'clsx';
import { useCostModelStore } from '../../store/costModelStore';
import { useCategoryStore } from '../../store/categoryStore';
import { Tooltip, InfoIcon } from '../ui/Tooltip';
import type { ComponentWeights } from '../../../../shared/types';

const COMPONENT_COLORS: Record<keyof ComponentWeights, string> = {
  steel: '#3b82f6',
  aluminum: '#8b5cf6',
  transport: '#f59e0b',
  energy: '#ef4444',
};

interface SliderRowProps {
  label: string;
  tooltip: string;
  value: number;
  color: string;
  onChange: (v: number) => void;
}

function SliderRow({ label, tooltip, value, color, onChange }: SliderRowProps) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: color }}
          />
          <span className="text-sm text-slate-300 font-medium">{label}</span>
          <Tooltip content={tooltip} side="right">
            <InfoIcon />
          </Tooltip>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={0}
            max={100}
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(100, Number(e.target.value))))}
            className="w-14 text-right text-sm bg-slate-800 border border-slate-700 
                       rounded-md px-2 py-0.5 text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <span className="text-slate-500 text-sm w-3">%</span>
        </div>
      </div>
      <div className="relative h-2 bg-slate-800 rounded-full overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all duration-200"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
        <input
          type="range"
          min={0}
          max={100}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
    </div>
  );
}

export function CostModelBuilder() {
  const { t } = useTranslation();
  const { weights, setWeights } = useCostModelStore();
  const { categories, activeCategoryId, setActiveCategory } = useCategoryStore();
  const total = Object.values(weights).reduce((s, v) => s + v, 0);
  const isValid = Math.round(total) === 100;

  const handleWeight = (key: keyof ComponentWeights, val: number) => {
    setWeights({ [key]: val });
  };

  return (
    <div className="space-y-4 p-4">
      {/* Category switcher */}
      {categories.length > 0 && (
        <div>
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wider">
            {t('category.switchLabel', 'Moje inne kategorie')}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={clsx(
                  'text-xs px-2.5 py-1 rounded-md border transition-all duration-150',
                  cat.id === activeCategoryId
                    ? 'border-blue-500 text-blue-400 bg-blue-500/10'
                    : 'border-slate-700 text-slate-400 hover:border-blue-500 hover:text-blue-400'
                )}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Sliders */}
      <div className="space-y-3">
        {(Object.keys(weights) as (keyof ComponentWeights)[]).map((key) => (
          <SliderRow
            key={key}
            label={t(`model.${key}`)}
            tooltip={t(`tooltip.${key}`)}
            value={weights[key]}
            color={COMPONENT_COLORS[key]}
            onChange={(v) => handleWeight(key, v)}
          />
        ))}
      </div>

      {/* Sum validation */}
      <div
        className={clsx(
          'text-xs px-3 py-2 rounded-lg font-medium',
          isValid
            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
            : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
        )}
      >
        {isValid
          ? t('model.sumOk')
          : t('model.sumWarning', { sum: total })}
      </div>
    </div>
  );
}
