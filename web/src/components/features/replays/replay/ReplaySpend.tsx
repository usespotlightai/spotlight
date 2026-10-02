import { CeilingBar } from '@/components/features/replays/CeilingBar';
import { spendShown } from '@/lib/insights';
import {
  overCeiling,
  type ReplayDetail,
  spendBreakdown,
  spendOfCeiling,
} from '@/lib/replay';
import {
  ELSEWHERE_NOTE,
  OVER_CEILING_NOTE,
  unpricedCallsShown,
  unpricedRunsShown,
} from '@/lib/replay-words';

type ReplaySpendProps = {
  replay: ReplayDetail;
};

export function ReplaySpend({ replay }: ReplaySpendProps) {
  const spent = replay.totals.spent;
  const over = overCeiling(spent, replay.ceiling);
  const parts = spendBreakdown(replay);

  return (
    <div
      data-slot="replay-spend"
      className="flex min-w-0 flex-col gap-1 text-xs"
    >
      <div className="flex items-center gap-2">
        <span className="text-foreground tabular-nums">
          {spendOfCeiling(spent, replay.ceiling)}
        </span>
        <CeilingBar spent={spent} ceiling={replay.ceiling} />
        {over && (
          <span className="text-destructive" title={OVER_CEILING_NOTE}>
            Over the ceiling by {spendShown(over)}
          </span>
        )}
      </div>

      <dl className="flex flex-wrap gap-x-3 text-muted-foreground">
        <div className="flex gap-1">
          <dt>Runs</dt>
          <dd className="text-foreground tabular-nums">
            {spendShown(parts.runs)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Drafting</dt>
          <dd className="text-foreground tabular-nums">
            {spendShown(parts.drafting)}
          </dd>
        </div>
        <div className="flex gap-1">
          <dt>Judging</dt>
          <dd className="text-foreground tabular-nums">
            {spendShown(parts.judging)}
          </dd>
        </div>
        {replay.totals.spentElsewhere.length > 0 && (
          <div className="flex gap-1" title={ELSEWHERE_NOTE}>
            <dt>Also spent</dt>
            <dd className="text-foreground tabular-nums">
              {replay.totals.spentElsewhere.map(spendShown).join(' · ')}
            </dd>
          </div>
        )}
        {(replay.totals.unpriced > 0 || replay.totals.unpricedCalls > 0) && (
          <div className="flex gap-1">
            <dt>Not priced</dt>
            <dd className="text-foreground tabular-nums">
              {[
                replay.totals.unpriced > 0
                  ? unpricedRunsShown(replay.totals.unpriced)
                  : null,
                replay.totals.unpricedCalls > 0
                  ? unpricedCallsShown(replay.totals.unpricedCalls)
                  : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
