import { useTranslation } from 'react-i18next';
import { CostChart } from '../../charts/CostChart';
import type { CostDataRow } from '../../../../../shared/types';

interface Props {
  data: CostDataRow[];
}

export default function ChartWidget({ data }: Props) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col h-full">
      <p className="text-xs font-medium text-fg-muted uppercase tracking-wide px-1 pb-2 flex-shrink-0">
        {t('chart.title')}
      </p>
      <div className="flex-1 min-h-0">
        <CostChart data={data} />
      </div>
    </div>
  );
}
