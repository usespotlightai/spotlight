import { EntrySide } from '@/components/features/replays/replay/EntrySide';
import { TaskJudgeCell } from '@/components/features/replays/replay/TaskJudgeCell';
import { TaskSpendCells } from '@/components/features/replays/replay/TaskSpendCells';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import {
  type EntryComparison,
  type TaskColumns,
  titleShown,
} from '@/lib/replay';
import { pairShown, REGRESSED_NOTE } from '@/lib/replay-words';
import { cn } from '@/lib/utils';

type TaskRowProps = {
  row: EntryComparison;
  columns: TaskColumns;
  currency: string;
  picked: boolean;
  onPick: () => void;
};

export function TaskRow({
  row,
  columns,
  currency,
  picked,
  onPick,
}: TaskRowProps) {
  const title = titleShown(row.title);
  const { compared, judged, paired, counterpart, counterpartLabel } = columns;

  return (
    <li
      data-slot="task"
      data-picked={picked || undefined}
      className={cn(TABLE_ROW, ROW_DIVIDER, picked && 'bg-selected')}
    >
      <span className={cn(LEAD_CELL, EDGE_INDENT)}>
        <button
          type="button"
          aria-label={`Details of ${title}`}
          aria-pressed={picked}
          onClick={onPick}
          className="truncate text-left font-medium text-foreground outline-none after:absolute after:inset-0 focus-visible:underline"
        >
          {title}
        </button>
        {row.regressed && (
          <NotedWarning
            data-slot="regressed"
            tone="destructive"
            label="Regressed"
            note={REGRESSED_NOTE(counterpart)}
            className="relative z-10"
          />
        )}
      </span>
      <NestedCell heading={compared ? 'This replay' : 'Result'} numeric={false}>
        <EntrySide copies={row.candidate} />
      </NestedCell>
      {compared && (
        <NestedCell heading={counterpartLabel} numeric={false}>
          {row.baseline.length > 0 ? (
            <EntrySide copies={row.baseline} />
          ) : (
            'Not replayed'
          )}
        </NestedCell>
      )}
      {judged && (
        <TaskJudgeCell
          row={row}
          compared={compared}
          counterpart={counterpart}
        />
      )}
      {paired && (
        <NestedCell heading="Closer" numeric={false}>
          <span data-slot="pair" data-pair={row.pair ?? 'none'}>
            {pairShown(row.pair, counterpart)}
          </span>
        </NestedCell>
      )}
      <TaskSpendCells row={row} compared={compared} currency={currency} />
    </li>
  );
}
