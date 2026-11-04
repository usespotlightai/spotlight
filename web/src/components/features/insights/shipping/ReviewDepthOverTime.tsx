import { ROUND_FILLS } from '@/components/features/insights/chart-series';
import { InsightsCard } from '@/components/features/insights/InsightsCard';
import {
  type StackedRow,
  StackedRows,
} from '@/components/features/insights/StackedRows';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatShare } from '@/lib/insights';
import {
  DEPTH_OVER_TIME_NOTE,
  type DepthWeek,
  formatRounds,
  ROUNDS,
  type RoundsCount,
} from '@/lib/insights-shipping';
import { formatDay } from '@/lib/judge';

const rowOf = (week: DepthWeek): StackedRow => ({
  key: week.week,
  label: formatDay(week.week),
  segments: ROUNDS.map((rounds) => ({
    key: rounds,
    value: week[rounds] ?? 0,
    color: ROUND_FILLS[rounds],
  })),
  length: week.merged > 0 ? 1 : 0,
  figure: (
    <>
      <span className="text-foreground">{week.merged}</span>{' '}
      <span className="text-muted-foreground">merged</span>
    </>
  ),
  tooltip: {
    title: `Week of ${formatDay(week.week)}`,
    rows: [
      ['Merged', `${week.merged}`],
      ...ROUNDS.map((rounds): [string, string] => [
        formatRounds(rounds),
        formatShare(week[rounds]),
      ]),
    ],
  },
});

export function ReviewDepthOverTime({
  weeks,
  totals,
}: {
  weeks: readonly DepthWeek[];
  totals: readonly RoundsCount[];
}) {
  return (
    <InsightsCard
      flat
      title="Review depth by week"
      description={DEPTH_OVER_TIME_NOTE}
    >
      <figure
        aria-label="Review depth week by week"
        className="flex flex-col gap-2"
      >
        <figcaption>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            {totals.map((total) => (
              <WithTooltip
                key={total.rounds}
                tooltip={`${total.merged} merged in the period`}
              >
                <div className="flex cursor-default items-center gap-1.5">
                  <span
                    aria-hidden
                    className="size-2 shrink-0 rounded-sm"
                    style={{ background: ROUND_FILLS[total.rounds] }}
                  />
                  <dt className="text-muted-foreground">
                    {formatRounds(total.rounds)}
                  </dt>
                  <dd className="text-foreground tabular-nums">
                    {formatShare(total.rate)}
                  </dd>
                </div>
              </WithTooltip>
            ))}
          </dl>
        </figcaption>
        <StackedRows
          label="Merged pull requests by review rounds"
          rows={weeks.map(rowOf)}
        />
      </figure>
    </InsightsCard>
  );
}
