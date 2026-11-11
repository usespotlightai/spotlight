import { ChartNoAxesColumn, type LucideIcon, Table2 } from 'lucide-react';

import { Segmented } from '@/components/shared/Segmented';

type ChartTableSwitchProps = {
  tabled: boolean;
  onTabled: (tabled: boolean) => void;
  chartIcon?: LucideIcon;
};

export function ChartTableSwitch({
  tabled,
  onTabled,
  chartIcon = ChartNoAxesColumn,
}: ChartTableSwitchProps) {
  return (
    <Segmented
      label="Show as"
      segments={[
        { id: 'chart', label: 'Chart', icon: chartIcon },
        { id: 'table', label: 'Table', icon: Table2 },
      ]}
      value={tabled ? 'table' : 'chart'}
      onChange={(shown) => onTabled(shown === 'table')}
    />
  );
}
