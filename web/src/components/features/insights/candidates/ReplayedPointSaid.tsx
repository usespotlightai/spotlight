import { spentIn } from '@/lib/inbox';
import { countShown, shareShown } from '@/lib/insights';
import type { ReplayedPoint } from '@/lib/insights-candidates';

type ReplayedPointSaidProps = {
  point: ReplayedPoint;
  currency: string;
};

export function ReplayedPointSaid({ point, currency }: ReplayedPointSaidProps) {
  return (
    <div className="whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-overlay">
      <p className="text-foreground">
        <span className="mr-1.5 text-muted-foreground">Replayed</span>
        {point.label}
      </p>
      <p className="text-muted-foreground">
        Replay success {shareShown(point.value)} of {countShown(point.scored)}{' '}
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
    </div>
  );
}
