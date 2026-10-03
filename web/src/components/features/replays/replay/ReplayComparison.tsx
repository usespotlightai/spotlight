import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { EntryCopies } from '@/components/features/replays/replay/EntryCopies';
import { PillButton } from '@/components/shared/PillButton';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { lastedOrNone, spendShown } from '@/lib/insights';
import {
  comparisonInOrder,
  costDeltaShown,
  counterpartShown,
  type EntryComparison,
  judgeScoreShown,
  meanCostOf,
  meanMsOf,
  msDeltaShown,
  type ReplayDetail,
  type ReplayEntry,
  scoreDeltaShown,
  titleShown,
} from '@/lib/replay';
import {
  CLOSER_TO_ACCEPTED,
  capitalised,
  pairShown,
  THE_BASELINE,
  uncomparedShown,
  versusShown,
} from '@/lib/replay-words';
import { runPath } from '@/lib/run';

const judgesShown = (copies: readonly ReplayEntry[]): string =>
  copies.map((each) => judgeScoreShown(each.judge)).join(' · ');

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
  const compared = rows.some((each) => each.baseline.length > 0);
  const paired = rows.some((each) => each.pair !== null);
  const counterpart = replay.comparedWithReplayId
    ? counterpartShown(
        replay.comparedWithReplayId,
        replay.candidate,
        replay.baselineReplayId,
      )
    : THE_BASELINE;
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
    cell: (row) => <EntryCopies copies={row.candidate} runTo={runTo} />,
  };

  const baseline: InsightsColumn<EntryComparison> = {
    id: 'baseline',
    header: capitalised(counterpart),
    cell: (row) =>
      row.baseline.length > 0 ? (
        <EntryCopies copies={row.baseline} runTo={runTo} />
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
            {judgesShown(row.candidate)}
            {row.baseline.length > 0 && (
              <span className="text-muted-foreground">
                {' '}
                vs {judgesShown(row.baseline)}
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
        <span className="tabular-nums">{judgesShown(row.candidate)}</span>
      ),
  };

  const pair: InsightsColumn<EntryComparison> = {
    id: 'pair',
    header: CLOSER_TO_ACCEPTED,
    cell: (row) => (
      <span data-slot="pair" data-pair={row.pair ?? 'none'}>
        {pairShown(row.pair, counterpart)}
      </span>
    ),
  };

  const cost: InsightsColumn<EntryComparison> = {
    id: 'cost',
    header: compared ? versusShown('Cost', counterpart) : 'Cost',
    numeric: true,
    cell: (row) =>
      compared
        ? costDeltaShown(row.costDelta, currency)
        : spendShown(meanCostOf(row.candidate)),
  };

  const time: InsightsColumn<EntryComparison> = {
    id: 'time',
    header: compared ? versusShown('Time', counterpart) : 'Time',
    numeric: true,
    cell: (row) =>
      compared
        ? msDeltaShown(row.msDelta)
        : lastedOrNone(meanMsOf(row.candidate)),
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

  const pairs = paired ? [pair] : [];
  const columns = compared
    ? [task, candidate, baseline, judge, ...pairs, cost, time, details]
    : [task, candidate, judge, ...pairs, cost, time, details];

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
