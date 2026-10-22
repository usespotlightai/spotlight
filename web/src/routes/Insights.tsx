import { useParams, useSearchParams } from 'react-router';
import { InsightsPeriodPicker } from '@/components/features/insights/InsightsPeriodPicker';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { TracesFilters } from '@/components/features/insights/TracesFilters';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { useLines } from '@/hooks/api/useLines';
import { insightsCrumbs, stationNamesOf, viewOf } from '@/lib/insights';

export function Insights() {
  const { slug, teamId } = useParams();
  const [params] = useSearchParams();
  const lines = useLines(teamId).data ?? [];
  const view = viewOf(params);

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage
      section="insights"
      actions={
        <div className="flex flex-wrap items-center justify-end gap-2">
          {view.tab === 'traces' && <TracesFilters teamId={teamId} />}
          <InsightsPeriodPicker />
        </div>
      }
      bordered={false}
      crumbs={insightsCrumbs(slug, teamId, view, stationNamesOf(lines))}
    >
      <TeamInsights slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
