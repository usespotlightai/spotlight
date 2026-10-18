import { ChartTip } from '@/components/shared/chart/ChartTip';
import type { TipPlacement } from '@/hooks/useCursorTooltip';
import { spentIn } from '@/lib/inbox';
import { formatCount, formatShare } from '@/lib/insights';
import type { ReplayedPoint } from '@/lib/insights-candidates';

type ReplayedPointTipProps = {
  point: ReplayedPoint;
  currency: string;
  placement?: TipPlacement;
};

export function ReplayedPointTip({
  point,
  currency,
  placement,
}: ReplayedPointTipProps) {
  return (
    <ChartTip placement={placement}>
      <p className="text-foreground">
        <span className="mr-1.5 text-muted-foreground">Replayed</span>
        {point.label}
      </p>
      <p className="text-muted-foreground">
        Replay success {formatShare(point.value)} of {formatCount(point.scored)}{' '}
        scored {point.scored === 1 ? 'run' : 'runs'} ·{' '}
        {spentIn(point.cost, currency)} a run
      </p>
      <p className="text-muted-foreground">
        {[
          `over ${point.setName}`,
          point.heldOut ? `held out ${point.heldOut}` : null,
          point.frontier ? 'on the search’s frontier' : null,
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
    </ChartTip>
  );
}
