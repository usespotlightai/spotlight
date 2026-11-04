import type { ReactNode } from 'react';
import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
import { EmptyDetail } from '@/components/features/insights/EmptyDetail';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TileSparkline } from '@/components/features/insights/TileSparkline';
import { InfoTooltip } from '@/components/shared/InfoTooltip';
import type { ShownDelta, TileDrill } from '@/lib/insights';
import type { TooltipText } from '@/lib/tooltip-note';
import { cn } from '@/lib/utils';

const AGAINST = 'Against the previous period';

type InsightsTileProps = {
  label: string;
  value: string;
  detail?: ReactNode;
  tooltip?: TooltipText;
  delta?: ShownDelta | null;
  drill?: TileDrill;
  trend?: readonly (number | null)[];
  visual?: ReactNode;
};

export function InsightsTile({
  label,
  value,
  detail,
  tooltip,
  delta,
  drill,
  trend,
  visual,
}: InsightsTileProps) {
  const sparkline = trend !== undefined && trend.length > 1;
  const pictured = sparkline || Boolean(visual);

  return (
    <div
      data-slot="insights-tile"
      className="flex min-h-28 min-w-0 flex-col gap-1 overflow-hidden group-data-top-aligned/tiles:gap-1 group-data-stacked/tiles:gap-1 rounded-lg border border-border px-4 py-3"
    >
      <dt className="flex min-h-5 items-center gap-1.5 text-muted-foreground text-sm leading-5">
        <span className="line-clamp-1" title={label}>
          {label}
        </span>
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </dt>
      <dd
        className={cn(
          '@container flex flex-1 flex-col gap-1.5',
          !pictured &&
            'justify-center group-data-top-aligned/tiles:justify-start group-data-stacked/tiles:justify-start',
        )}
      >
        <span className="flex flex-col items-start gap-0.5">
          <span className="font-medium text-foreground text-xl tabular-nums leading-7">
            {drill ? (
              <InsightsLink tab={drill.tab} filter={drill.filter}>
                {value}
              </InsightsLink>
            ) : (
              value
            )}
          </span>
          {delta && (
            <span className="text-sm">
              <DeltaGlyph delta={delta} tooltip={AGAINST} />
            </span>
          )}
        </span>
        {detail ? (
          <span className="text-muted-foreground text-sm">{detail}</span>
        ) : (
          !pictured && <EmptyDetail />
        )}
        {(sparkline || visual) && (
          <span className="mt-auto pt-2">
            {visual ??
              (sparkline && (
                <TileSparkline label={`${label}, day by day`} values={trend} />
              ))}
          </span>
        )}
      </dd>
    </div>
  );
}
