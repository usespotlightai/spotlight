import { GainVerdict } from '@/components/features/replays/GainVerdict';
import { PairTally } from '@/components/features/replays/PairTally';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import {
  counterpartNoun,
  counterpartRateOf,
  formatCounterpart,
  type Replay,
  type ReplayedStation,
  replayPath,
} from '@/lib/replay';
import {
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
    | 'comparedWith'
    | 'candidate'
  >;
  baselineId: string | null;
  at?: ReplayedStation;
  className?: string;
};

export function SuccessAgainstBaseline({
  replay,
  baselineId,
  at,
  className,
}: SuccessAgainstBaselineProps) {
  const { successRate, interval } = replay.totals;
  const against = counterpartRateOf(replay, baselineId);
  const againstShown =
    against &&
    (against.successRate === null ? (
      counterpartNoun(against)
    ) : (
      <>
        {counterpartNoun(against)}{' '}
        <RateWithInterval
          rate={against.successRate}
          interval={against.interval}
          className="text-muted-foreground"
        />
      </>
    ));

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
      ) : replay.againstBaseline && againstShown ? (
        <GainVerdict gain={replay.againstBaseline} against={againstShown} />
      ) : (
        againstShown && (
          <span className="text-muted-foreground tabular-nums">
            · {againstShown}
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
            against={formatCounterpart(
              replay.pairedWith,
              replay.candidate,
              baselineId,
            )}
            to={at ? replayPath(at, replay.pairedWith) : null}
          />
        </>
      )}
    </span>
  );
}
