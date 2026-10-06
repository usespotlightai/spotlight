import { useSearchParams } from 'react-router';
import { CostTab } from '@/components/features/insights/CostTab';
import { BeforeAfterHost } from '@/components/features/insights/changes/BeforeAfterHost';
import { InsightsTabs } from '@/components/features/insights/InsightsTabs';
import { OverviewTab } from '@/components/features/insights/OverviewTab';
import { PeopleTab } from '@/components/features/insights/PeopleTab';
import { ProductivityTab } from '@/components/features/insights/ProductivityTab';
import { RunsTab } from '@/components/features/insights/RunsTab';
import { StationsView } from '@/components/features/insights/StationsView';
import { ToolsAndSkillsTab } from '@/components/features/insights/ToolsAndSkillsTab';
import { TraceList } from '@/components/features/trace/list/TraceList';
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

      {view.tab === 'traces' ? (
        <TraceList slug={slug} teamId={teamId} range={view.period} />
      ) : (
        <BeforeAfterHost
          slug={slug}
          teamId={teamId}
          period={view.period}
          names={names}
        >
          <main className="flex w-full flex-col gap-3 px-3 pt-2 pb-2">
            {view.tab === 'overview' && <OverviewTab {...shared} />}
            {view.tab === 'cost' && <CostTab {...shared} />}
            {view.tab === 'people' && (
              <PeopleTab slug={slug} teamId={teamId} period={view.period} />
            )}
            {view.tab === 'productivity' && (
              <ProductivityTab
                slug={slug}
                teamId={teamId}
                view={view}
                names={names}
                onView={onView}
              />
            )}
            {view.tab === 'stations' && (
              <StationsView {...shared} stationId={view.filter.stationId} />
            )}
            {view.tab === 'tools' && <ToolsAndSkillsTab {...shared} />}
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
        </BeforeAfterHost>
      )}
    </div>
  );
}
