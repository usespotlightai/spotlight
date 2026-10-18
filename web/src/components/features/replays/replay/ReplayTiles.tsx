import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { formatSpend } from '@/lib/insights';
import { formatPercent } from '@/lib/judge';
import {
  formatReference,
  overCeiling,
  type ReplayDetail,
  referenceNoun,
  referenceRateOf,
  spendBreakdown,
} from '@/lib/replay';
import {
  capitalised,
  formatGain,
  formatGainRange,
  formatGainSignificance,
  formatInterval,
  formatPairTiles,
  formatRepeats,
  formatSpendNote,
  formatSuccessDetail,
  gainSignificanceNote,
  NO_SCORE_YET,
  PAIRING_SPEND_LABEL,
  pairsJudged,
  pairTallyNote,
} from '@/lib/replay-words';

const NONE = '–';

const formatScoring = (replay: ReplayDetail): string => {
  if (replay.checks && replay.judges) {
    return 'by checks and judge';
  }
  if (replay.checks) {
    return 'by checks';
  }

  return replay.judges ? 'by judge' : 'nothing scores this station';
};

type ReplayTilesProps = {
  replay: ReplayDetail;
};

export function ReplayTiles({ replay }: ReplayTilesProps) {
  const { totals } = replay;
  const against = referenceRateOf(replay, replay.baselineReplayId);
  const gain = replay.gainOverReference;
  const pairs =
    replay.pairwiseReference && pairsJudged(replay.referencePairs)
      ? replay.referencePairs
      : null;
  const over = overCeiling(totals.spent, replay.ceiling);
  const parts = spendBreakdown(replay);

  return (
    <InsightsTiles label="The replay in numbers" className="gap-3">
      <InsightsTile
        label="Success"
        value={
          totals.successRate === null ? NONE : formatPercent(totals.successRate)
        }
        detail={
          totals.successRate === null
            ? NO_SCORE_YET
            : formatSuccessDetail(totals, formatScoring(replay))
        }
        tooltip={
          [
            totals.interval &&
              `Likely range: ${formatInterval(totals.interval)}.`,
            replay.repeats > 1 && `${formatRepeats(replay.repeats)}.`,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />

      {gain && (
        <InsightsTile
          label="Gain"
          value={formatGain(gain)}
          detail={[
            capitalised(formatGainSignificance(gain.significance)),
            against?.successRate != null &&
              `${referenceNoun(against)} ${formatPercent(against.successRate)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          tooltip={`Likely range: ${formatGainRange(gain)} pts. ${gainSignificanceNote(gain)}`}
        />
      )}

      {pairs && replay.pairwiseReference && (
        <InsightsTile
          label={PAIRING_SPEND_LABEL}
          {...formatPairTiles(pairs)}
          tooltip={pairTallyNote(
            formatReference(
              replay.pairwiseReference,
              replay.candidate,
              replay.baselineReplayId,
            ),
          )}
        />
      )}

      <InsightsTile
        label="Spent"
        value={formatSpend(totals.spent)}
        detail={
          over
            ? `Over the ceiling by ${formatSpend(over)}`
            : `of ${formatSpend(replay.ceiling)}`
        }
        tooltip={formatSpendNote({
          runs: formatSpend(parts.runs),
          generation: formatSpend(parts.generation),
          judging: formatSpend(parts.judging),
          pairing: parts.pairing.amount > 0 ? formatSpend(parts.pairing) : null,
          elsewhere: totals.spentElsewhere.map(formatSpend),
          unpricedRuns: totals.unpriced,
          unpricedCalls: totals.unpricedCalls,
          over: over !== null,
        })}
      />
    </InsightsTiles>
  );
}
