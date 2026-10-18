import type { ReactNode } from 'react';
import { DeltaMark } from '@/components/features/insights/DeltaMark';
import { InfoNote } from '@/components/features/insights/InfoNote';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TileSparkline } from '@/components/features/insights/TileSparkline';
import type { ShownDelta, TileDrill } from '@/lib/insights';

const AGAINST = 'Against the previous period';

type InsightsTileProps = {
  label: string;
  value: string;
  detail?: ReactNode;
  note?: string;
  delta?: ShownDelta | null;
  drill?: TileDrill;
  trend?: readonly (number | null)[];
};

export function InsightsTile({
  label,
  value,
  detail,
  note,
  delta,
  drill,
  trend,
}: InsightsTileProps) {
  return (
    <div
      data-slot="insights-tile"
      className="flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card"
    >
      <dt className="flex min-h-6 items-center gap-1.5 px-3 pt-3 pb-2 text-foreground text-xs">
        <span className="truncate">{label}</span>
        {note && <InfoNote note={note} />}
      </dt>
      <dd className="@container flex flex-1 flex-col gap-1 px-3 pb-3">
        <span className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <span className="font-normal text-[1.375rem] text-foreground tabular-nums leading-none tracking-tight">
            {drill ? (
              <InsightsLink tab={drill.tab} filter={drill.filter}>
                {value}
              </InsightsLink>
            ) : (
              value
            )}
          </span>
          {delta && (
            <span className="text-xs">
              <DeltaMark delta={delta} note={AGAINST} />
            </span>
          )}
        </span>
        {detail && (
          <span className="text-[0.7rem] text-muted-foreground">{detail}</span>
        )}
        {trend && trend.length > 1 && (
          <span className="mt-auto pt-1">
            <TileSparkline label={`${label}, day by day`} values={trend} />
          </span>
        )}
      </dd>
    </div>
  );
}
