import { Noted } from '@/components/shared/Noted';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  type EntryComparison,
  judgeScoreShown,
  type ReplayEntry,
  scoreDeltaShown,
} from '@/lib/replay';
import { capitalised, uncomparedShown } from '@/lib/replay-words';

const judgesShown = (copies: readonly ReplayEntry[]): string =>
  copies.map((each) => judgeScoreShown(each.judge)).join(' · ');

type TaskJudgeCellProps = {
  row: EntryComparison;
  compared: boolean;
  counterpart: string;
};

export function TaskJudgeCell({
  row,
  compared,
  counterpart,
}: TaskJudgeCellProps) {
  if (!compared) {
    return (
      <NestedCell heading="Judge">{judgesShown(row.candidate)}</NestedCell>
    );
  }

  return (
    <NestedCell heading="Judge">
      <Noted
        note={`This replay ${judgesShown(row.candidate)} · ${capitalised(counterpart)} ${judgesShown(row.baseline)}`}
      >
        <span className="relative z-10">
          {row.scoreUncompared
            ? uncomparedShown(row.scoreUncompared)
            : scoreDeltaShown(row.scoreDelta)}
        </span>
      </Noted>
    </NestedCell>
  );
}
