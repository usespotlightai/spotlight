import { useState } from 'react';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { DayChart } from '@/components/features/insights/shipping/DayChart';
import { PercentilePicker } from '@/components/features/insights/shipping/PercentilePicker';
import { Segmented } from '@/components/shared/Segmented';
import { lasted } from '@/lib/insights';
import {
  DEFAULT_PERCENTILE,
  type Percentile,
  type ReviewDay,
  SMOOTHINGS,
  type Smoothing,
} from '@/lib/insights-shipping';

export function TimeToFirstReview({ days }: { days: readonly ReviewDay[] }) {
  const [percentile, setPercentile] = useState<Percentile>(DEFAULT_PERCENTILE);
  const [smoothing, setSmoothing] = useState<Smoothing>('rolling');

  return (
    <InsightsCard
      title="Time to first review"
      description="Time from when a pull request opens to its first human review, at the chosen percentile."
      actions={
        <div className="flex items-center gap-1.5">
          <PercentilePicker value={percentile} onChange={setPercentile} />
          <Segmented
            label="Smoothing"
            segments={SMOOTHINGS}
            value={smoothing}
            onChange={setSmoothing}
          />
        </div>
      }
    >
      <DayChart
        label={`Time to first review at ${percentile}`}
        points={days.map((each) => ({
          day: each.day,
          review: each.toFirstReview[smoothing][percentile],
        }))}
        series={[
          {
            key: 'review',
            label: 'To first review',
            color: 'var(--chart-primary)',
            as: 'line',
          },
        ]}
        format={lasted}
        durations
        legend={false}
      />
    </InsightsCard>
  );
}
