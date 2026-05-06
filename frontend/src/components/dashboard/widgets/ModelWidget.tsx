import { useTranslation } from 'react-i18next';
import { CostModelBuilder } from '../../costScan/CostModelBuilder';
import { SupplierPriceInput } from '../../costScan/SupplierPriceInput';
import { clsx } from 'clsx';

interface MarginStats {
  percent: number;
  absolute: number;
  isOvercharge: boolean;
}

interface Props {
  shouldCostAbs: number | null;
  basePrice: number | null;
  margin: MarginStats | null;
}

export default function ModelWidget({ shouldCostAbs, basePrice, margin }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full overflow-y-auto space-y-4">
      <div>
        <p className="text-xs font-medium text-fg-muted uppercase tracking-wide px-1 pb-2">
          {t('model.title')}
        </p>
        <CostModelBuilder />
      </div>

      <div>
        <p className="text-xs font-medium text-fg-muted uppercase tracking-wide px-1 pb-2">
          {t('supplier.title')}
        </p>
        <SupplierPriceInput />

        {margin && shouldCostAbs !== null && (
          <div className={clsx(
            'mx-4 mb-4 rounded-xl p-3.5 border',
            margin.isOvercharge ? 'bg-red-500/8 border-red-500/20' : 'bg-emerald-500/8 border-emerald-500/20'
          )}>
            <div className="flex items-start gap-3">
              <span className="text-xl mt-0.5">{margin.isOvercharge ? '🔴' : '🟢'}</span>
              <div>
                <p className={clsx('font-semibold text-sm', margin.isOvercharge ? 'text-red-500' : 'text-emerald-500')}>
                  {margin.isOvercharge ? t('supplier.overcharge') : t('supplier.goodDeal')}
                </p>
                <p className="text-fg-muted text-xs mt-0.5">
                  {margin.isOvercharge ? '+' : ''}€{margin.absolute.toFixed(0)} ·{' '}
                  {margin.percent > 0 ? '+' : ''}{margin.percent.toFixed(1)}%{' '}
                  vs Should Cost €{shouldCostAbs.toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
