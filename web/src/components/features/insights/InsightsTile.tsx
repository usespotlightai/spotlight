import { DeltaShown } from '@/components/features/insights/DeltaShown';
import { InsightsLink } from '@/components/features/insights/InsightsLink';
import type { Delta, TileDrill } from '@/lib/insights';

type InsightsTileProps = {
  label: string;
  value: string;
  detail?: string;
  delta?: Delta | null;
  drill?: TileDrill;
};

export function InsightsTile({
  label,
  value,
  detail,
  delta,
  drill,
}: InsightsTileProps) {
  return (
    <div
      data-slot="insights-tile"
      className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card p-3"
    >
      <dt className="truncate text-muted-foreground text-xs">{label}</dt>
      <dd className="flex flex-col gap-0.5">
        <span className="font-semibold text-foreground text-xl tabular-nums tracking-tight">
          {drill ? (
            <InsightsLink tab={drill.tab} filter={drill.filter}>
              {value}
            </InsightsLink>
          ) : (
            value
          )}
        </span>
        {detail && (
          <span className="text-muted-foreground text-xs">{detail}</span>
        )}
        {delta && <DeltaShown delta={delta} />}
      </dd>
    </div>
  );
}
