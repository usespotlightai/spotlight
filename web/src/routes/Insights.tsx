import { useParams } from 'react-router';
import { InsightsPeriodPicker } from '@/components/features/insights/InsightsPeriodPicker';
import { TeamInsights } from '@/components/features/insights/TeamInsights';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';

export function Insights() {
  const { slug, teamId } = useParams();

  if (!slug || !teamId) {
    return null;
  }

  return (
    <TeamSectionPage
      section="insights"
      actions={<InsightsPeriodPicker />}
      bordered={false}
    >
      <TeamInsights slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
