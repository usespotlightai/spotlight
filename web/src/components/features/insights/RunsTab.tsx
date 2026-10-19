import { InsightsCard } from '@/components/features/insights/InsightsCard';
import { InsightsFailed } from '@/components/features/insights/InsightsFailed';
import { InsightsPager } from '@/components/features/insights/InsightsPager';
import { NoRuns } from '@/components/features/insights/NoRuns';
import { RunsFilters } from '@/components/features/insights/RunsFilters';
import { RunsSkeleton } from '@/components/features/insights/RunsSkeleton';
import { RunsTable } from '@/components/features/insights/RunsTable';
import { Button } from '@/components/ui/button';
import { useHarnesses } from '@/hooks/api/useHarnesses';
import { useInsightsRuns } from '@/hooks/api/useInsightsRuns';
import type { LineResponseDto } from '@/lib/api';
import {
  INSIGHTS_RUNS_NOTE,
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
  const harnesses = useHarnesses();
  const narrowed = narrowedBy(view.filter).length > 0;

  const filters = (
    <RunsFilters
      filter={view.filter}
      names={names}
      lines={lines}
      people={runs.data?.people ?? []}
      onChange={(filter) => onView({ ...view, filter, page: 1 })}
    />
  );

  if (loading(runs) || loading(harnesses)) {
    return <RunsSkeleton filters={filters} />;
  }

  if (failed(runs) || !runs.data) {
    return <InsightsFailed what="The runs" query={runs} />;
  }

  if (runs.data.total === 0 && !narrowed) {
    return (
      <NoRuns slug={slug} teamId={teamId} period={view.period}>
        Runs show here, newest first, when they end.
      </NoRuns>
    );
  }

  return (
    <InsightsCard
      tableOnly
      title="Runs"
      description={INSIGHTS_RUNS_NOTE}
      actions={filters}
    >
      {runs.data.total === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10">
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
        <div className="flex flex-col gap-3">
          <RunsTable
            slug={slug}
            teamId={teamId}
            runs={runs.data.runs}
            people={runs.data.people}
            names={names}
            harnesses={harnesses.data}
          />
          <InsightsPager
            label="Pages of runs"
            shown={runsShownOf(runs.data)}
            page={runs.data.page}
            lastPage={lastPageOf(runs.data)}
            onPage={(page) => onView({ ...view, page })}
          />
        </div>
      )}
    </InsightsCard>
  );
}
