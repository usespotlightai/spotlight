import { useParams } from 'react-router';

import { TeamRuns } from '@/components/features/runs/TeamRuns';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';
import { nonEmpty } from '@/lib/non-empty';

export function Runs() {
  const { slug, teamId } = useParams();

  if (!nonEmpty(slug) || !nonEmpty(teamId)) {
    return null;
  }

  return (
    <TeamSectionPage section="runs">
      <TeamRuns slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
