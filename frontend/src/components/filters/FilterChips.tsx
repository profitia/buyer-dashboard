import { useTranslation } from 'react-i18next';
import { useMacroFilterStore } from '../../store/macroFilterStore';

export function FilterChips() {
  const { t } = useTranslation();
  const { filters, removeFilterChip } = useMacroFilterStore();

  const hasAny =
    filters.impacts.length > 0 ||
    filters.countries.length > 0 ||
    filters.importance.length > 0;

  if (!hasAny) return null;

  const importanceDot: Record<string, string> = {
    high: '🔴',
    medium: '🟡',
    low: '🟢',
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 px-1 py-1">
      <span className="text-[11px] text-fg-muted font-medium">{t('filter.active')}:</span>

      {filters.impacts.map((k) => (
        <span
          key={`impact-${k}`}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25"
        >
          {t(`chart.toggle.${k}`, k)}
          <button
            onClick={() => removeFilterChip('impact', k)}
            className="hover:text-white transition-colors leading-none"
            aria-label={`Remove ${k}`}
          >
            ✕
          </button>
        </span>
      ))}

      {filters.countries.map((k) => (
        <span
          key={`country-${k}`}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-400 border border-purple-500/25"
        >
          {k}
          <button
            onClick={() => removeFilterChip('country', k)}
            className="hover:text-white transition-colors leading-none"
            aria-label={`Remove ${k}`}
          >
            ✕
          </button>
        </span>
      ))}

      {filters.importance.map((k) => (
        <span
          key={`imp-${k}`}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25"
        >
          {importanceDot[k]} {t(`filter.${k}`)}
          <button
            onClick={() => removeFilterChip('importance', k)}
            className="hover:text-white transition-colors leading-none"
            aria-label={`Remove ${k}`}
          >
            ✕
          </button>
        </span>
      ))}
    </div>
  );
}
