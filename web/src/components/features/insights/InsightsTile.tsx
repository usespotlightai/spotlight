import type { ReactNode } from 'react';
import { DeltaGlyph } from '@/components/features/insights/DeltaGlyph';
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
  className?: string;
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
  className,
}: InsightsTileProps) {
  const sparkline = trend !== undefined && trend.length > 1;

  return (
    <div
      data-slot="insights-tile"
      className={cn(
        'flex min-h-[7.625rem] min-w-0 flex-col gap-1 overflow-hidden rounded-lg border border-border px-4 py-3 max-sm:odd:last:col-span-2',
        className,
      )}
    >
      <dt className="flex min-h-5 items-center gap-1.5 text-muted-foreground text-sm leading-5">
        <span className="line-clamp-1" title={label}>
          {label}
        </span>
        {tooltip && <InfoTooltip tooltip={tooltip} />}
      </dt>
      <dd className="@container flex flex-1 flex-col">
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
            <span className="text-sm leading-5">
              <DeltaGlyph delta={delta} tooltip={AGAINST} />
            </span>
          )}
          {detail && (
            <span className="text-muted-foreground text-sm leading-5">
              {detail}
            </span>
          )}
        </span>
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
