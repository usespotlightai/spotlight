import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatPercent } from '@/lib/judge';
import type { RateInterval } from '@/lib/replay';
import { formatInterval } from '@/lib/replay-words';

type CandidateRateProps = {
  rate: number;
  interval: RateInterval | null;
  more?: string;
};

export function CandidateRate({ rate, interval, more }: CandidateRateProps) {
  const note = [interval && `Likely range: ${formatInterval(interval)}`, more]
    .filter(Boolean)
    .join(' · ');

  return note ? (
    <WithTooltip tooltip={note}>
      <span data-slot="candidate-rate" className="relative z-10">
        {formatPercent(rate)}
      </span>
    </WithTooltip>
  ) : (
    <span data-slot="candidate-rate">{formatPercent(rate)}</span>
  );
}
