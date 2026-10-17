import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import type { RateInterval } from '@/lib/replay';
import { formatHeldOutRuns } from '@/lib/replay-words';

type HeldOutScoreProps = {
  rate: number | null;
  interval: RateInterval | null;
  runs?: number | null;
  unscored: string;
};

export function HeldOutScore({
  rate,
  interval,
  runs = null,
  unscored,
}: HeldOutScoreProps) {
  if (rate === null) {
    return <span className="text-foreground">{unscored}</span>;
  }

  return (
    <span data-slot="held-out-score" className="tabular-nums">
      <RateWithInterval rate={rate} interval={interval} />
      {runs !== null && (
        <span className="text-foreground"> {formatHeldOutRuns(runs)}</span>
      )}
    </span>
  );
}
