import {
  type InsightsColumn,
  InsightsTable,
} from '@/components/features/insights/InsightsTable';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { HarnessResponseDto } from '@/lib/api';
import {
  harnessShown,
  type InsightsRun,
  lastedOrNone,
  modelShown,
  type PersonName,
  personShown,
  type StationNames,
  spendShown,
  stationShown,
} from '@/lib/insights';
import { runPath } from '@/lib/run';
import { since } from '@/lib/runner';
import { endedBadly, endingShown } from '@/lib/station-outcomes';
import { cn } from '@/lib/utils';

type RunsTableProps = {
  slug: string;
  teamId: string;
  runs: readonly InsightsRun[];
  people: readonly PersonName[];
  names: StationNames;
  harnesses: readonly HarnessResponseDto[] | undefined;
};

export function RunsTable({
  slug,
  teamId,
  runs,
  people,
  names,
  harnesses,
}: RunsTableProps) {
  const columns: InsightsColumn<InsightsRun>[] = [
    {
      id: 'outcome',
      header: 'Outcome',
      cell: (run) => (
        <TrailLink
          to={runPath(slug, teamId, run.runId)}
          className={cn(
            'hover:underline',
            endedBadly(run.ending) ? 'text-destructive' : 'text-foreground',
          )}
        >
          {endingShown(run.ending)}
        </TrailLink>
      ),
    },
    {
      id: 'failure',
      header: 'Failure',
      cell: (run) => (
        <span
          className="block max-w-56 truncate text-muted-foreground"
          title={run.failure ?? undefined}
        >
          {run.failure ?? '–'}
        </span>
      ),
    },
    {
      id: 'station',
      header: 'Station',
      cell: (run) => stationShown(names, run.stationId),
    },
    {
      id: 'person',
      header: 'Person',
      cell: (run) => personShown(people, run.openedBy),
    },
    {
      id: 'harness',
      header: 'Harness',
      cell: (run) => harnessShown(harnesses, run.harness),
    },
    {
      id: 'model',
      header: 'Model',
      cell: (run) => modelShown(run.model),
    },
    {
      id: 'took',
      header: 'Took',
      numeric: true,
      cell: (run) => lastedOrNone(run.ms),
    },
    {
      id: 'cost',
      header: 'Cost',
      numeric: true,
      cell: (run) => spendShown(run.cost),
    },
    {
      id: 'ended',
      header: 'Ended',
      numeric: true,
      cell: (run) => since(run.endedAt),
    },
  ];

  return (
    <InsightsTable
      label="Runs"
      columns={columns}
      rows={runs}
      rowKey={(run) => run.runId}
    />
  );
}
