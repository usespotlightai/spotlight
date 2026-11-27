import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { DAY_CHART_HEIGHT } from '@/components/features/insights/shipping/DayChart';
import { ChartSkeleton } from '@/components/shared/skeleton/ChartSkeleton';

type DayChartSkeletonProps = {
  legend?: readonly { readonly label: string; readonly color: string }[];
};

export function DayChartSkeleton({ legend }: DayChartSkeletonProps) {
  return (
    <figure className="flex flex-col gap-2">
      <ChartSkeleton height={DAY_CHART_HEIGHT} />
      {legend && <ChartLegend entries={legend} />}
    </figure>
  );
}
