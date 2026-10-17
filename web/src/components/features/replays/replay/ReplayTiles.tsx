import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { formatSpend } from '@/lib/insights';
import { formatPercent } from '@/lib/judge';
import {
  counterpartNoun,
  counterpartRateOf,
  formatCounterpart,
  overCeiling,
  type ReplayDetail,
  spendBreakdown,
} from '@/lib/replay';
import {
  capitalised,
  formatGain,
  formatGainRange,
  formatGainVerdict,
  formatInterval,
  formatPairTiles,
  formatRepeats,
  formatSpendNote,
  formatSuccessDetail,
  gainVerdictNote,
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
  const against = counterpartRateOf(replay, replay.baselineReplayId);
  const gain = replay.againstBaseline;
  const pairs =
    replay.pairedWith && pairsJudged(replay.pairsAgainstBaseline)
      ? replay.pairsAgainstBaseline
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
        note={
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
            capitalised(formatGainVerdict(gain.verdict)),
            against?.successRate != null &&
              `${counterpartNoun(against)} ${formatPercent(against.successRate)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          note={`Likely range: ${formatGainRange(gain)} pts. ${gainVerdictNote(gain)}`}
        />
      )}

      {pairs && replay.pairedWith && (
        <InsightsTile
          label={PAIRING_SPEND_LABEL}
          {...formatPairTiles(pairs)}
          note={pairTallyNote(
            formatCounterpart(
              replay.pairedWith,
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
        note={formatSpendNote({
          runs: formatSpend(parts.runs),
          drafting: formatSpend(parts.drafting),
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
