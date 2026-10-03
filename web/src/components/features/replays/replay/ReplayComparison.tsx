import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { EntryResult } from '@/components/features/replays/replay/EntryResult';
import { PillButton } from '@/components/shared/PillButton';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { lastedOrNone, spendShown } from '@/lib/insights';
import {
  comparisonInOrder,
  costDeltaShown,
  type EntryComparison,
  judgeScoreShown,
  msDeltaShown,
  type ReplayDetail,
  scoreDeltaShown,
  titleShown,
} from '@/lib/replay';
import { uncomparedShown } from '@/lib/replay-words';
import { runPath } from '@/lib/run';

type ReplayComparisonProps = {
  slug: string;
  teamId: string;
  replay: ReplayDetail;
  picked: string | null;
  onPick: (originalRunId: string) => void;
};

export function ReplayComparison({
  slug,
  teamId,
  replay,
  picked,
  onPick,
}: ReplayComparisonProps) {
  const rows = comparisonInOrder(replay.comparison);
  const compared = rows.some((each) => each.baseline !== null);
  const currency = replay.ceiling.currency;
  const runTo = (runId: string | null) =>
    runId ? runPath(slug, teamId, runId) : null;

  const task: InsightsColumn<EntryComparison> = {
    id: 'task',
    header: 'Task',
    cell: (row) => (
      <span className="flex min-w-0 flex-col">
        <TrailLink
          to={runPath(slug, teamId, row.originalRunId)}
          title="The original run"
          className="block max-w-64 truncate text-foreground underline-offset-2 hover:underline"
        >
          {titleShown(row.title)}
        </TrailLink>
        {row.regressed && (
          <span data-slot="regressed" className="text-destructive">
            Regressed
          </span>
        )}
      </span>
    ),
  };

  const candidate: InsightsColumn<EntryComparison> = {
    id: 'candidate',
    header: compared ? 'This replay' : 'Result',
    cell: (row) => (
      <EntryResult entry={row.candidate} runTo={runTo(row.candidate.runId)} />
    ),
  };

  const baseline: InsightsColumn<EntryComparison> = {
    id: 'baseline',
    header: 'Baseline',
    cell: (row) =>
      row.baseline ? (
        <EntryResult entry={row.baseline} runTo={runTo(row.baseline.runId)} />
      ) : (
        <span className="text-muted-foreground">Not replayed</span>
      ),
  };

  const judge: InsightsColumn<EntryComparison> = {
    id: 'judge',
    header: 'Judge',
    cell: (row) =>
      compared ? (
        <span className="flex flex-col">
          <span className="tabular-nums">
            {judgeScoreShown(row.candidate.judge)}
            {row.baseline && (
              <span className="text-muted-foreground">
                {' '}
                vs {judgeScoreShown(row.baseline.judge)}
              </span>
            )}
          </span>
          <span className="text-muted-foreground">
            {row.scoreUncompared
              ? uncomparedShown(row.scoreUncompared)
              : scoreDeltaShown(row.scoreDelta)}
          </span>
        </span>
      ) : (
        <span className="tabular-nums">
          {judgeScoreShown(row.candidate.judge)}
        </span>
      ),
  };

  const cost: InsightsColumn<EntryComparison> = {
    id: 'cost',
    header: compared ? 'Cost vs baseline' : 'Cost',
    numeric: true,
    cell: (row) =>
      compared
        ? costDeltaShown(row.costDelta, currency)
        : spendShown(row.candidate.cost),
  };

  const time: InsightsColumn<EntryComparison> = {
    id: 'time',
    header: compared ? 'Time vs baseline' : 'Time',
    numeric: true,
    cell: (row) =>
      compared ? msDeltaShown(row.msDelta) : lastedOrNone(row.candidate.ms),
  };

  const details: InsightsColumn<EntryComparison> = {
    id: 'details',
    header: '',
    cell: (row) => (
      <PillButton
        aria-label={`Details of ${titleShown(row.title)}`}
        aria-pressed={picked === row.originalRunId}
        onClick={() => onPick(row.originalRunId)}
      >
        Details
      </PillButton>
    ),
  };

  const columns = compared
    ? [task, candidate, baseline, judge, cost, time, details]
    : [task, candidate, judge, cost, time, details];

  return (
    <InsightsTable
      label="Each task, regressions first"
      columns={columns}
      rows={rows}
      rowKey={(row) => row.originalRunId}
      picked={picked}
    />
  );
}
