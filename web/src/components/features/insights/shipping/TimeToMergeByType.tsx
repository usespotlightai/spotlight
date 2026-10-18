import { useState } from 'react';
import { AUTHOR_SERIES } from '@/components/features/insights/chart-series';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { ChartLegend } from '@/components/features/insights/shipping/ChartLegend';
import { PercentilePicker } from '@/components/features/insights/shipping/PercentilePicker';
import { formatDurationOrNone } from '@/lib/insights';
import { formatType, MERGE_BY_TYPE_NOTE } from '@/lib/insights-pull-requests';
import {
  DEFAULT_PERCENTILE,
  type InsightsShipping,
  type Percentile,
  slowestFirst,
} from '@/lib/insights-shipping';

const widthOf = (ms: number | null, max: number): string =>
  ms === null || max === 0 ? '0%' : `${(ms / max) * 100}%`;

export function TimeToMergeByType({
  merges,
}: {
  merges: Pick<InsightsShipping, 'types' | 'slowestFirst'>;
}) {
  const [percentile, setPercentile] = useState<Percentile>(DEFAULT_PERCENTILE);
  const rows = slowestFirst(merges, percentile);
  const max = Math.max(
    0,
    ...rows.flatMap((row) => [
      row.toMerge.spotlight[percentile] ?? 0,
      row.toMerge.people[percentile] ?? 0,
    ]),
  );

  return (
    <InsightsCard
      title="Time to merge by PR type"
      description={MERGE_BY_TYPE_NOTE}
      actions={<PercentilePicker value={percentile} onChange={setPercentile} />}
    >
      <ul aria-label="Time to merge by type" className="flex flex-col gap-2">
        {rows.map((row) => (
          <li key={row.type} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2 text-xs">
              <span className="text-foreground">
                {formatType(row.type)}{' '}
                <span className="text-[0.7rem] text-muted-foreground">
                  {row.merged} merged
                </span>
              </span>
              <span className="text-foreground tabular-nums">
                {formatDurationOrNone(row.toMerge.spotlight[percentile])}
                <span className="text-[0.7rem] text-muted-foreground">
                  {' '}
                  · {formatDurationOrNone(row.toMerge.people[percentile])}
                </span>
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="h-1.5 rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-chart-primary"
                  style={{
                    width: widthOf(row.toMerge.spotlight[percentile], max),
                  }}
                />
              </span>
              <span className="h-1 rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-chart-2"
                  style={{
                    width: widthOf(row.toMerge.people[percentile], max),
                  }}
                />
              </span>
            </div>
          </li>
        ))}
      </ul>

      <ChartLegend entries={AUTHOR_SERIES} />
    </InsightsCard>
  );
}
