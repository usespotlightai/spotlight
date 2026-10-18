import { useState } from 'react';
import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { DayChart } from '@/components/features/insights/shipping/DayChart';
import { PercentilePicker } from '@/components/features/insights/shipping/PercentilePicker';
import { Segmented } from '@/components/shared/Segmented';
import {
  formatDuration,
  formatDurationOrNone,
  shownDeltaOf,
} from '@/lib/insights';
import { SPOTLIGHT_COMPARED_WITH_PEOPLE } from '@/lib/insights-pull-requests';
import {
  type ByAuthor,
  type ByAuthorChanges,
  DEFAULT_PERCENTILE,
  type MergeDay,
  mergePoints,
  type Percentile,
  SMOOTHINGS,
  type Smoothing,
} from '@/lib/insights-shipping';

const AUTHORS = [
  { key: 'spotlight', label: 'Spotlight’s', color: 'var(--chart-primary)' },
  { key: 'people', label: 'People’s alone', color: 'var(--chart-2)' },
] as const;

type TimeToMergeProps = {
  now: ByAuthor;
  changes: ByAuthorChanges;
  days: readonly MergeDay[];
};

export function TimeToMerge({ now, changes, days }: TimeToMergeProps) {
  const [percentile, setPercentile] = useState<Percentile>(DEFAULT_PERCENTILE);
  const [smoothing, setSmoothing] = useState<Smoothing>('rolling');

  return (
    <InsightsCard
      title="Time to merge"
      description={`Time from when a pull request opens to its merge, at the chosen percentile. ${SPOTLIGHT_COMPARED_WITH_PEOPLE}`}
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
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {AUTHORS.map((author) => {
          const delta = shownDeltaOf(changes[author.key][percentile]);

          return (
            <div key={author.key} className="flex flex-col gap-1">
              <dt className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span
                  aria-hidden
                  className="size-2 rounded-sm"
                  style={{ background: author.color }}
                />
                {author.label}
              </dt>
              <dd className="flex items-baseline gap-2">
                <span className="text-[1.375rem] text-foreground tabular-nums leading-none tracking-tight">
                  {formatDurationOrNone(now[author.key][percentile])}
                </span>
                {delta && (
                  <span className="text-xs">
                    <DeltaGlyph
                      delta={delta}
                      tooltip="Against the previous period"
                    />
                  </span>
                )}
              </dd>
            </div>
          );
        })}
      </dl>

      <DayChart
        label={`Time to merge at ${percentile}, ${smoothing === 'rolling' ? 'over the 7 days before each day' : 'day by day'}`}
        points={mergePoints(days, smoothing, percentile)}
        series={AUTHORS.map((author) => ({ ...author, as: 'line' as const }))}
        format={formatDuration}
        durations
      />
    </InsightsCard>
  );
}
