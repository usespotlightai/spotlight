import { WithTooltip } from '@/components/shared/WithTooltip';
import { formatPercent } from '@/lib/judge';
import type { RateInterval } from '@/lib/replay';
import { formatRateNote } from '@/lib/search-words';

type ResultRateProps = {
  rate: number | null;
  interval: RateInterval | null;
  unscored: string;
};

export function ResultRate({ rate, interval, unscored }: ResultRateProps) {
  if (rate === null) {
    return <span className="text-muted-foreground">{unscored}</span>;
  }

  const note = formatRateNote(interval);
  const shown = (
    <span data-slot="result-rate" className="tabular-nums">
      {formatPercent(rate)}
    </span>
  );

  return note ? <WithTooltip tooltip={note}>{shown}</WithTooltip> : shown;
}
