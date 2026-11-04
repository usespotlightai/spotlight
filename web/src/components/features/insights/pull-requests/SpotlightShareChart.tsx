import { SPOTLIGHT_SHARE_SERIES } from '@/components/features/insights/chart-series';
import { StackedRows } from '@/components/features/insights/StackedRows';
import { formatShare } from '@/lib/insights';
import type { WeekShare } from '@/lib/insights-pull-requests';
import { formatDay } from '@/lib/judge';

export function SpotlightShareChart({
  weeks,
}: {
  weeks: readonly WeekShare[];
}) {
  const most = Math.max(1, ...weeks.map((week) => week.merged));

  return (
    <figure data-slot="spotlightShare-chart" className="flex flex-col gap-2">
      <figcaption className="flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
        {SPOTLIGHT_SHARE_SERIES.map((series) => (
          <span key={series.key} className="flex items-center gap-1">
            <span
              aria-hidden
              className="size-2 rounded-sm"
              style={{ background: series.fill }}
            />
            {series.label}
          </span>
        ))}
      </figcaption>

      <StackedRows
        label="Pull requests merged each week, by who made them"
        rows={weeks.map((week) => ({
          key: week.week,
          label: formatDay(week.week),
          segments: SPOTLIGHT_SHARE_SERIES.map((series) => ({
            key: series.key,
            value: week[series.key],
            color: series.fill,
          })),
          length: week.merged / most,
          figure: (
            <>
              <span className="text-foreground">{week.merged}</span>{' '}
              <span className="text-muted-foreground">merged</span>
            </>
          ),
          tooltip: {
            title: `Week of ${formatDay(week.week)}`,
            rows: [
              ...SPOTLIGHT_SHARE_SERIES.map((series): [string, string] => [
                series.label,
                `${week[series.key]}`,
              ]),
              ['Spotlight’s share', formatShare(week.rate)],
            ],
          },
        }))}
      />
    </figure>
  );
}
