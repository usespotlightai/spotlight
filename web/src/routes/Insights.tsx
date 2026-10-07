import { useParams, useSearchParams } from 'react-router';
import { InsightsPeriodPicker } from '@/components/features/insights/InsightsPeriodPicker';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { useLines } from '@/hooks/api/useLines';
import { insightsCrumbs, stationNamesOf, viewOf } from '@/lib/insights';

export function Insights() {
  const { slug, teamId } = useParams();
  const [params] = useSearchParams();
  const lines = useLines(teamId).data ?? [];

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage
      section="insights"
      actions={<InsightsPeriodPicker />}
      bordered={false}
      crumbs={insightsCrumbs(
        slug,
        teamId,
        viewOf(params),
        stationNamesOf(lines),
      )}
    >
      <TeamInsights slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
