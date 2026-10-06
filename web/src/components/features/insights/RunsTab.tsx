import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsPager } from '@/components/features/insights/InsightsPager';
import { NoRunsInPeriod } from '@/components/features/insights/NoRunsInPeriod';
import { RunsFilters } from '@/components/features/insights/RunsFilters';
import { RunsSkeleton } from '@/components/features/insights/RunsSkeleton';
import { RunsTable } from '@/components/features/insights/RunsTable';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsRuns } from '@/hooks/api/useInsightsRuns';
import type { LineResponseDto } from '@/lib/api';
import {
  type InsightsView,
  lastPageOf,
  narrowedBy,
  runsShownOf,
  type StationNames,
} from '@/lib/insights';
import { failed, loading } from '@/lib/query';

type RunsTabProps = {
  slug: string;
  teamId: string;
  view: InsightsView;
  names: StationNames;
  lines: readonly LineResponseDto[];
  onView: (view: InsightsView) => void;
};

export function RunsTab({
  slug,
  teamId,
  view,
  names,
  lines,
  onView,
}: RunsTabProps) {
  const runs = useInsightsRuns(teamId, view.period, view.filter, view.page);
  const harnesses = useHarnesses().data;
  const narrowed = narrowedBy(view.filter).length > 0;

  return (
    <div className="flex flex-col gap-3">
      <RunsFilters
        filter={view.filter}
        names={names}
        lines={lines}
        people={runs.data?.people ?? []}
        onChange={(filter) => onView({ ...view, filter, page: 1 })}
      />

      {loading(runs) ? (
        <RunsSkeleton />
      ) : failed(runs) || !runs.data ? (
        <InsightsFailed what="The runs" query={runs} />
      ) : runs.data.total === 0 && !narrowed ? (
        <NoRunsInPeriod slug={slug} teamId={teamId}>
          Runs that end in this period show here, newest first.
        </NoRunsInPeriod>
      ) : runs.data.total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border py-10">
          <p className="text-muted-foreground text-sm">No runs match.</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full bg-card"
            onClick={() => onView({ ...view, filter: {}, page: 1 })}
          >
            Show every run
          </Button>
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-1">
            <RunsTable
              slug={slug}
              teamId={teamId}
              runs={runs.data.runs}
              people={runs.data.people}
              names={names}
              harnesses={harnesses}
            />
          </div>
          <InsightsPager
            label="Pages of runs"
            shown={runsShownOf(runs.data)}
            page={runs.data.page}
            lastPage={lastPageOf(runs.data)}
            onPage={(page) => onView({ ...view, page })}
          />
        </>
      )}
    </div>
  );
}
