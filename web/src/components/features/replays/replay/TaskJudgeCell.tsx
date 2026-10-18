import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { WithTooltip } from '@/components/shared/WithTooltip';
import {
  type EntryComparison,
  formatJudgeScore,
  formatScoreDelta,
  type ReplayEntry,
} from '@/lib/replay';
import { capitalised, formatUncompared } from '@/lib/replay-words';

const formatJudges = (repeats: readonly ReplayEntry[]): string =>
  repeats.map((each) => formatJudgeScore(each.judge)).join(' · ');

type TaskJudgeCellProps = {
  row: EntryComparison;
  compared: boolean;
  reference: string;
};

export function TaskJudgeCell({
  row,
  compared,
  reference,
}: TaskJudgeCellProps) {
  if (!compared) {
    return (
      <NestedCell heading="Judge">{formatJudges(row.candidate)}</NestedCell>
    );
  }

  return (
    <NestedCell heading="Judge">
      <WithTooltip
        tooltip={`This replay ${formatJudges(row.candidate)} · ${capitalised(reference)} ${formatJudges(row.baseline)}`}
      >
        <span className="relative z-10">
          {row.scoreUncompared
            ? formatUncompared(row.scoreUncompared)
            : formatScoreDelta(row.scoreDelta)}
        </span>
      </WithTooltip>
    </NestedCell>
  );
}
