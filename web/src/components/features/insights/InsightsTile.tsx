import type { ReactNode } from 'react';
import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import { EmptyDetail } from '@/components/features/insights/EmptyDetail';
import { InfoTooltip } from '@/components/features/insights/InfoTooltip';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TileSparkline } from '@/components/features/insights/TileSparkline';
import type { ShownDelta, TileDrill } from '@/lib/insights';
import { cn } from '@/lib/utils';

const AGAINST = 'Against the previous period';

type InsightsTileProps = {
  label: string;
  value: string;
  detail?: ReactNode;
  tooltip?: string;
  delta?: ShownDelta | null;
  drill?: TileDrill;
  trend?: readonly (number | null)[];
};

export function InsightsTile({
  label,
  value,
  detail,
  tooltip,
  delta,
  drill,
  trend,
}: InsightsTileProps) {
  const sparkline = trend !== undefined && trend.length > 1;

  return (
    <div
      data-slot="insights-tile"
      className="flex min-h-30 min-w-0 flex-col gap-1.5 overflow-hidden group-data-top-aligned/tiles:gap-8.5 rounded-lg border border-border bg-card p-3"
    >
      <dt className="flex min-h-4 items-center gap-1.5 text-foreground text-xs leading-4">
        <span className="truncate">{label}</span>
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </dt>
      <dd
        className={cn(
          '@container flex flex-1 flex-col gap-1.5',
          !sparkline &&
            'justify-center group-data-top-aligned/tiles:justify-start',
        )}
      >
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
              <DeltaGlyph delta={delta} tooltip={AGAINST} />
            </span>
          )}
        </span>
        {detail ? (
          <span className="text-muted-foreground text-xs">{detail}</span>
        ) : (
          !sparkline && <EmptyDetail />
        )}
        {sparkline && (
          <span className="mt-auto pt-2">
            <TileSparkline label={`${label}, day by day`} values={trend} />
          </span>
        )}
      </dd>
    </div>
  );
}
