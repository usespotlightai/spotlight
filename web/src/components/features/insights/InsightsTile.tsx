import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { InfoNote } from '@/components/features/insights/InfoNote';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import { TileSparkline } from '@/components/features/insights/TileSparkline';
import type { Delta, TileDrill } from '@/lib/insights';

type InsightsTileProps = {
  label: string;
  value: string;
  detail?: string;
  note?: string;
  delta?: Delta | null;
  drill?: TileDrill;
  trend?: readonly number[];
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
      <dt className="flex min-h-7 items-center gap-1.5 border-border border-b bg-muted/40 px-2.5 py-1 text-foreground text-xs">
        <span className="truncate">{label}</span>
        {note && <InfoNote note={note} />}
      </dt>
      <dd className="@container flex flex-1 flex-col gap-1 px-2.5 pt-2 pb-2">
        <span className="font-normal text-[1.375rem] text-foreground tabular-nums leading-none tracking-tight">
          {drill ? (
            <InsightsLink tab={drill.tab} filter={drill.filter}>
              {value}
            </InsightsLink>
          ) : (
            value
          )}
        </span>
        {delta && <DeltaShown delta={delta} compact />}
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
