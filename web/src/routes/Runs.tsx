import type { ReactElement } from 'react';
import { useParams } from 'react-router';

import { TeamRuns } from '@/components/features/runs/TeamRuns';
import { TeamSectionPage } from '@/components/features/team/TeamSectionPage';

export function Runs(): ReactElement | null {
  const { slug, teamId } = useParams();

  if (
    slug === undefined ||
    slug === '' ||
    teamId === undefined ||
    teamId === ''
  ) {
    return null;
  }

  return (
    <TeamSectionPage section="runs">
      <TeamRuns slug={slug} teamId={teamId} />
    </TeamSectionPage>
  );
}
