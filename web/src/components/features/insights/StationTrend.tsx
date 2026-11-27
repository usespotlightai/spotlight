import { DailyRunBars } from '@/components/features/insights/DailyRunBars';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { type StationReport, shownDeltaOf, trendOf } from '@/lib/insights';

export function StationTrend({ report }: { report: StationReport }) {
  const delta = shownDeltaOf(report.changes.runs);

  return (
    <div className="col-span-full flex items-center gap-3 @4xl:col-span-1 @lg:group-data-compact/nested:col-span-1">
      <DailyRunBars trend={trendOf(report.trend)} />
      {delta && (
        <WithTooltip tooltip="Runs compared with the previous period">
          <span
            data-slot="delta"
            className="min-w-10 text-right text-muted-foreground tabular-nums"
          >
            {delta.shown}
          </span>
        </WithTooltip>
      )}
    </div>
  );
}
