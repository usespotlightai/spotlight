import { useSearchParams } from 'react-router';
import { CostTab } from '@/components/features/insights/CostTab';
import { FlowTab } from '@/components/features/insights/FlowTab';
import { InsightsTabs } from '@/components/features/insights/InsightsTabs';
import { OverviewTab } from '@/components/features/insights/OverviewTab';
import { PeopleTab } from '@/components/features/insights/PeopleTab';
import { PullRequestsTab } from '@/components/features/insights/pull-requests/PullRequestsTab';
import { RunsTab } from '@/components/features/insights/RunsTab';
import { StationsTab } from '@/components/features/insights/StationsTab';
import { ToolsTab } from '@/components/features/insights/tools/ToolsTab';
import { useLines } from '@/hooks/api/useLines';
import {
  type InsightsView,
  paramsOf,
  stationNamesOf,
  viewOf,
} from '@/lib/insights';

type TeamInsightsProps = {
  slug: string;
  teamId: string;
};

export function TeamInsights({ slug, teamId }: TeamInsightsProps) {
  const [params, setParams] = useSearchParams();
  const view = viewOf(params);
  const lines = useLines(teamId).data ?? [];
  const names = stationNamesOf(lines);
  const shared = { slug, teamId, period: view.period, names };
  const onView = (next: InsightsView) =>
    setParams(paramsOf(next), { replace: true });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <InsightsTabs slug={slug} teamId={teamId} view={view} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 pt-2 pb-8 md:px-6">
          {view.tab === 'overview' && <OverviewTab {...shared} />}
          {view.tab === 'flow' && <FlowTab {...shared} />}
          {view.tab === 'pull-requests' && (
            <PullRequestsTab
              slug={slug}
              teamId={teamId}
              view={view}
              onView={onView}
            />
          )}
          {view.tab === 'stations' && <StationsTab {...shared} />}
          {view.tab === 'people' && (
            <PeopleTab slug={slug} teamId={teamId} period={view.period} />
          )}
          {view.tab === 'cost' && <CostTab {...shared} />}
          {view.tab === 'tools' && <ToolsTab {...shared} />}
          {view.tab === 'runs' && (
            <RunsTab
              slug={slug}
              teamId={teamId}
              view={view}
              names={names}
              lines={lines}
              onView={onView}
            />
          )}
        </main>
      </div>
    </div>
  );
}
