import { TaskRow } from '@/components/features/replays/replay/TaskRow';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  comparisonInOrder,
  type ReplayDetail,
  taskColumnsOf,
  taskHeadingsOf,
} from '@/lib/replay';

type ReplayComparisonProps = {
  replay: ReplayDetail;
  picked: string | null;
  onPick: (originalRunId: string) => void;
};

export function ReplayComparison({
  replay,
  picked,
  onPick,
}: ReplayComparisonProps) {
  const columns = taskColumnsOf(replay);

  return (
    <NestedTable
      label="Each task, regressions first"
      headings={taskHeadingsOf(columns)}
      compact
    >
      {comparisonInOrder(replay.comparison).map((row) => (
        <TaskRow
          key={row.originalRunId}
          row={row}
          columns={columns}
          currency={replay.ceiling.currency}
          picked={picked === row.originalRunId}
          onPick={() => onPick(row.originalRunId)}
        />
      ))}
    </NestedTable>
  );
}
