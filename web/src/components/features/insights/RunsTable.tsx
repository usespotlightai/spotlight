import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { WithTooltip } from '@/components/shared/WithTooltip';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { HarnessResponseDto } from '@/lib/api';
import {
  formatDurationOrNone,
  formatHarness,
  formatModel,
  formatPerson,
  formatSpend,
  formatStation,
  type InsightsRun,
  type PersonName,
  type StationNames,
} from '@/lib/insights';
import { SPREAD } from '@/lib/nested-table';
import { runPath } from '@/lib/run';
import { since } from '@/lib/since';
import { endedBadly, formatEnding } from '@/lib/station-insights';
import { cn } from '@/lib/utils';

const HEADINGS = [
  { label: 'Outcome', indent: 'edge' as const, size: SPREAD },
  { label: 'Failure', size: 'minmax(10rem,2fr)' },
  { label: 'Station', size: SPREAD },
  { label: 'Person', size: SPREAD },
  { label: 'Agent config', size: SPREAD },
  { label: 'Duration', numeric: true, size: SPREAD },
  { label: 'Cost', numeric: true, size: SPREAD },
  { label: 'Ended', numeric: true, size: SPREAD },
];

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
  return (
    <NestedTable label="Runs" headings={HEADINGS}>
      {runs.map((run) => (
        <li
          key={run.runId}
          data-slot="insights-run"
          className={cn(
            'relative col-span-full grid grid-cols-2 items-center gap-x-6 gap-y-2 py-2 pr-2 text-xs transition-colors hover:bg-muted/20 @4xl:grid-cols-subgrid',
            ROW_DIVIDER,
          )}
        >
          <span
            className={cn('col-span-full min-w-0 @4xl:col-span-1', EDGE_INDENT)}
          >
            <TrailLink
              to={runPath(slug, teamId, run.runId)}
              className={cn(
                'font-medium outline-none after:absolute after:inset-0',
                endedBadly(run.ending) ? 'text-destructive' : 'text-foreground',
              )}
            >
              {formatEnding(run.ending)}
            </TrailLink>
          </span>
          <NestedCell heading="Failure" numeric={false}>
            {run.failure ? (
              <WithTooltip tooltip={run.failure}>
                <span className="relative block truncate">{run.failure}</span>
              </WithTooltip>
            ) : (
              '–'
            )}
          </NestedCell>
          <NestedCell heading="Station" numeric={false}>
            {formatStation(names, run.stationId)}
          </NestedCell>
          <NestedCell heading="Person" numeric={false}>
            {formatPerson(people, run.openedBy)}
          </NestedCell>
          <NestedCell heading="Agent config" numeric={false}>
            {formatHarness(harnesses, run.harness)} · {formatModel(run.model)}
          </NestedCell>
          <NestedCell heading="Duration">
            {formatDurationOrNone(run.ms)}
          </NestedCell>
          <NestedCell heading="Cost" strong>
            {formatSpend(run.cost)}
          </NestedCell>
          <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}
