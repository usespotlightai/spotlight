import { GainSignificance } from '@/components/features/replays/GainSignificance';
import { PairTally } from '@/components/features/replays/PairTally';
import { RateWithInterval } from '@/components/features/replays/RateWithInterval';
import {
  formatReference,
  type Replay,
  type ReplayedStation,
  referenceNoun,
  referenceRateOf,
  replayPath,
} from '@/lib/replay';
import {
  NO_SCORE_YET,
  pairsJudged,
  SUCCEEDED,
  THE_BASELINE,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type SuccessOverReferenceProps = {
  replay: Pick<
    Replay,
    | 'id'
    | 'isBaseline'
    | 'totals'
    | 'gainOverReference'
    | 'referencePairs'
    | 'pairwiseReference'
    | 'referenceReplay'
    | 'candidate'
  >;
  baselineId: string | null;
  at?: ReplayedStation;
  className?: string;
};

export function SuccessOverReference({
  replay,
  baselineId,
  at,
  className,
}: SuccessOverReferenceProps) {
  const { successRate, interval } = replay.totals;
  const reference = referenceRateOf(replay, baselineId);
  const referenceShown =
    reference &&
    (reference.successRate === null ? (
      referenceNoun(reference)
    ) : (
      <>
        {referenceNoun(reference)}{' '}
        <RateWithInterval
          rate={reference.successRate}
          interval={reference.interval}
          className="text-muted-foreground"
        />
      </>
    ));

  return (
    <span
      data-slot="success-over-reference"
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
      ) : replay.gainOverReference && referenceShown ? (
        <GainSignificance
          gain={replay.gainOverReference}
          against={referenceShown}
        />
      ) : (
        referenceShown && (
          <span className="text-muted-foreground tabular-nums">
            · {referenceShown}
          </span>
        )
      )}
      {replay.pairwiseReference && pairsJudged(replay.referencePairs) && (
        <>
          <span aria-hidden className="text-muted-foreground">
            ·
          </span>
          <PairTally
            tally={replay.referencePairs}
            against={formatReference(
              replay.pairwiseReference,
              replay.candidate,
              baselineId,
            )}
            to={at ? replayPath(at, replay.pairwiseReference) : null}
          />
        </>
      )}
    </span>
  );
}
