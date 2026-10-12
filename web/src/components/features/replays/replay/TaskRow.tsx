import { EntrySide } from '@/components/features/replays/replay/EntrySide';
import { Noted } from '@/components/shared/Noted';
import { NotedWarning } from '@/components/shared/NotedWarning';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import {
  EDGE_INDENT,
  LEAD_CELL,
  ROW_DIVIDER,
  TABLE_ROW,
} from '@/components/shared/nested-table/nested-rows';
import { lastedOrNone, spendShown } from '@/lib/insights';
import {
  costDeltaShown,
  type EntryComparison,
  judgeScoreShown,
  meanCostOf,
  meanMsOf,
  msDeltaShown,
  type ReplayEntry,
  scoreDeltaShown,
  type TaskColumns,
  titleShown,
} from '@/lib/replay';
import {
  capitalised,
  pairShown,
  REGRESSED_NOTE,
  uncomparedShown,
} from '@/lib/replay-words';
import { cn } from '@/lib/utils';

const judgesShown = (copies: readonly ReplayEntry[]): string =>
  copies.map((each) => judgeScoreShown(each.judge)).join(' · ');

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
  const { compared, judged, paired, counterpart } = columns;

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
        <NestedCell heading={capitalised(counterpart)} numeric={false}>
          {row.baseline.length > 0 ? (
            <EntrySide copies={row.baseline} />
          ) : (
            'Not replayed'
          )}
        </NestedCell>
      )}
      {judged && (
        <NestedCell heading="Judge">
          {compared ? (
            <Noted
              note={`This replay ${judgesShown(row.candidate)} · ${capitalised(counterpart)} ${judgesShown(row.baseline)}`}
            >
              <span className="relative z-10">
                {row.scoreUncompared
                  ? uncomparedShown(row.scoreUncompared)
                  : scoreDeltaShown(row.scoreDelta)}
              </span>
            </Noted>
          ) : (
            judgesShown(row.candidate)
          )}
        </NestedCell>
      )}
      {paired && (
        <NestedCell heading="Closer" numeric={false}>
          <span data-slot="pair" data-pair={row.pair ?? 'none'}>
            {pairShown(row.pair, counterpart)}
          </span>
        </NestedCell>
      )}
      <NestedCell heading={compared ? 'Cost change' : 'Cost'}>
        {compared
          ? costDeltaShown(row.costDelta, currency)
          : spendShown(meanCostOf(row.candidate))}
      </NestedCell>
      <NestedCell heading={compared ? 'Time change' : 'Time'}>
        {compared
          ? msDeltaShown(row.msDelta)
          : lastedOrNone(meanMsOf(row.candidate))}
      </NestedCell>
    </li>
  );
}
