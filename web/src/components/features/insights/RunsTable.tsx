import { Noted } from '@/components/shared/Noted';
import { NestedCell } from '@/components/shared/nested-table/NestedCell';
import { NestedTable } from '@/components/shared/nested-table/NestedTable';
import {
  EDGE_INDENT,
  ROW_DIVIDER,
} from '@/components/shared/nested-table/nested-rows';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import type { HarnessResponseDto } from '@/lib/api';
import {
  formatHarness,
  formatModel,
  formatPerson,
  formatSpend,
  formatStation,
  INSIGHTS_RUN_HEADINGS,
  type InsightsRun,
  lastedOrNone,
  type PersonName,
  type StationNames,
} from '@/lib/insights';
import { runPath } from '@/lib/run';
import { since } from '@/lib/since';
import { endedBadly, formatEnding } from '@/lib/station-outcomes';
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
  return (
    <NestedTable label="Runs" headings={INSIGHTS_RUN_HEADINGS}>
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
              <Noted note={run.failure}>
                <span className="relative block truncate">{run.failure}</span>
              </Noted>
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
          <NestedCell heading="Setup" numeric={false}>
            {formatHarness(harnesses, run.harness)} · {formatModel(run.model)}
          </NestedCell>
          <NestedCell heading="Took">{lastedOrNone(run.ms)}</NestedCell>
          <NestedCell heading="Cost" strong>
            {formatSpend(run.cost)}
          </NestedCell>
          <NestedCell heading="Ended">{since(run.endedAt)}</NestedCell>
        </li>
      ))}
    </NestedTable>
  );
}
