import { InsightsTile } from '@/components/features/insights/InsightsTile';
import { InsightsTiles } from '@/components/features/insights/InsightsTiles';
import { spendShown } from '@/lib/insights';
import { percentShown } from '@/lib/judge';
import {
  baselineTotalsFor,
  counterpartShown,
  overCeiling,
  type Replay,
  type ReplayDetail,
  spendBreakdown,
} from '@/lib/replay';
import {
  BASELINE,
  capitalised,
  gainRangeShown,
  gainShown,
  gainVerdictNote,
  gainVerdictShown,
  intervalShown,
  NO_SCORE_YET,
  PAIRING_SPEND_LABEL,
  pairsJudged,
  pairTallyNote,
  pairTilesShown,
  repeatsShown,
  spendNoteShown,
  successDetailShown,
} from '@/lib/replay-words';

const NONE = '–';

const scoringShown = (replay: ReplayDetail): string => {
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
  baseline: Pick<Replay, 'id' | 'totals'> | null;
};

export function ReplayTiles({ replay, baseline }: ReplayTilesProps) {
  const { totals } = replay;
  const against = baselineTotalsFor(replay, baseline);
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
          totals.successRate === null ? NONE : percentShown(totals.successRate)
        }
        detail={
          totals.successRate === null
            ? NO_SCORE_YET
            : successDetailShown(totals, scoringShown(replay))
        }
        note={
          [
            totals.interval &&
              `Likely range: ${intervalShown(totals.interval)}.`,
            replay.repeats > 1 && `${repeatsShown(replay.repeats)}.`,
          ]
            .filter(Boolean)
            .join(' ') || undefined
        }
      />

      {gain && (
        <InsightsTile
          label="Gain"
          value={gainShown(gain)}
          detail={[
            capitalised(gainVerdictShown(gain.verdict)),
            against?.successRate != null &&
              `${BASELINE} ${percentShown(against.successRate)}`,
          ]
            .filter(Boolean)
            .join(' · ')}
          note={`Likely range: ${gainRangeShown(gain)} pts. ${gainVerdictNote(gain)}`}
        />
      )}

      {pairs && replay.pairedWith && (
        <InsightsTile
          label={PAIRING_SPEND_LABEL}
          {...pairTilesShown(pairs)}
          note={pairTallyNote(
            counterpartShown(
              replay.pairedWith,
              replay.candidate,
              baseline?.id ?? null,
            ),
          )}
        />
      )}

      <InsightsTile
        label="Spent"
        value={spendShown(totals.spent)}
        detail={
          over
            ? `Over the ceiling by ${spendShown(over)}`
            : `of ${spendShown(replay.ceiling)}`
        }
        note={spendNoteShown({
          runs: spendShown(parts.runs),
          drafting: spendShown(parts.drafting),
          judging: spendShown(parts.judging),
          pairing: parts.pairing.amount > 0 ? spendShown(parts.pairing) : null,
          elsewhere: totals.spentElsewhere.map(spendShown),
          unpricedRuns: totals.unpriced,
          unpricedCalls: totals.unpricedCalls,
          over: over !== null,
        })}
      />
    </InsightsTiles>
  );
}
