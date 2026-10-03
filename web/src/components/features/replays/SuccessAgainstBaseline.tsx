import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import { baselineTotalsFor, type Replay } from '@/lib/replay';
import {
  BASELINE,
  NO_SCORE_YET,
  SUCCEEDED,
  THE_BASELINE,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type SuccessAgainstBaselineProps = {
  replay: Pick<Replay, 'id' | 'isBaseline' | 'totals' | 'againstBaseline'>;
  baseline: Pick<Replay, 'id' | 'totals'> | null;
  className?: string;
};

export function SuccessAgainstBaseline({
  replay,
  baseline,
  className,
}: SuccessAgainstBaselineProps) {
  const { successRate, interval } = replay.totals;
  const against = baselineTotalsFor(replay, baseline);
  const baselineShown = against && against.successRate !== null && (
    <>
      {BASELINE}{' '}
      <RateWithInterval
        rate={against.successRate}
        interval={against.interval}
        className="text-muted-foreground"
      />
    </>
  );

  return (
    <span
      data-slot="success-against-baseline"
      className={cn(
        'flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs',
        className,
      )}
    >
      {successRate === null ? (
        <span className="text-foreground">{NO_SCORE_YET}</span>
      ) : (
        <span className="text-foreground">
          <RateWithInterval rate={successRate} interval={interval} />{' '}
          {SUCCEEDED}
        </span>
      )}
      {replay.isBaseline ? (
        <span className="text-muted-foreground">· {THE_BASELINE}</span>
      ) : replay.againstBaseline ? (
        <GainVerdict
          gain={replay.againstBaseline}
          against={baselineShown || BASELINE}
        />
      ) : (
        baselineShown && (
          <span className="text-muted-foreground tabular-nums">
            · {baselineShown}
          </span>
        )
      )}
    </span>
  );
}
