import { ChartNoAxesColumn, type LucideIcon, Table2 } from 'lucide-react';
import { Segmented } from '@/components/shared/Segmented';

type ChartTableSwitchProps = {
  tabled: boolean;
  chartIcon?: LucideIcon;
  onTabled: (tabled: boolean) => void;
};

export function ChartTableSwitch({
  tabled,
  chartIcon = ChartNoAxesColumn,
  onTabled,
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
