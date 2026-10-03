import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { PairTally } from '@/components/features/replays/PairTally';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import {
  baselineTotalsFor,
  counterpartShown,
  type Replay,
  type ReplayedStation,
  replayPath,
} from '@/lib/replay';
import {
  BASELINE,
  NO_SCORE_YET,
  pairsJudged,
  SUCCEEDED,
  THE_BASELINE,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type SuccessAgainstBaselineProps = {
  replay: Pick<
    Replay,
    | 'id'
    | 'isBaseline'
    | 'totals'
    | 'againstBaseline'
    | 'pairsAgainstBaseline'
    | 'pairedWith'
    | 'candidate'
  >;
  baseline: Pick<Replay, 'id' | 'totals'> | null;
  at?: ReplayedStation;
  className?: string;
};

export function SuccessAgainstBaseline({
  replay,
  baseline,
  at,
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
      {replay.pairedWith && pairsJudged(replay.pairsAgainstBaseline) && (
        <>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <PairTally
            tally={replay.pairsAgainstBaseline}
            against={counterpartShown(
              replay.pairedWith,
              replay.candidate,
              baseline?.id ?? null,
            )}
            to={at ? replayPath(at, replay.pairedWith) : null}
          />
        </>
      )}
    </span>
  );
}
