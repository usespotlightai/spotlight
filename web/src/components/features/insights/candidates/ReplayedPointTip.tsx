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
    <ChartTip
      placement={placement}
      note={{
        title: point.label,
        rows: [
          ['Source', 'Replayed'],
          [
            'Replay success',
            `${formatShare(point.value)} of ${formatCount(point.scored)} scored ${point.scored === 1 ? 'run' : 'runs'}`,
          ],
          ['Cost per run', spentIn(point.cost, currency)],
          ...(point.heldOut
            ? ([['Held out', `${point.heldOut}`]] as [string, string][])
            : []),
          ...(point.frontier
            ? ([['Best for the cost', 'Yes']] as [string, string][])
            : []),
        ],
      }}
    />
  );
}
