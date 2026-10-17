import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import type { RateInterval } from '@/lib/replay';
import { formatRunsScored, NOT_SCORED_YET } from '@/lib/replay-words';

type ScoredRateProps = {
  rate: number | null;
  interval: RateInterval | null;
  scored: number;
};

export function ScoredRate({ rate, interval, scored }: ScoredRateProps) {
  if (scored === 0) {
    return <span className="text-muted-foreground">{NOT_SCORED_YET}</span>;
  }

  return (
    <span data-slot="scored-rate" className="tabular-nums">
      <RateWithInterval rate={rate} interval={interval} />
      <span className="text-muted-foreground"> {formatRunsScored(scored)}</span>
    </span>
  );
}
