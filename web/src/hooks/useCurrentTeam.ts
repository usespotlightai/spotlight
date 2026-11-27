import { useState } from 'react';
import { useMatch } from 'react-router';

import type { Team } from '@/lib/team';

export function useCurrentTeam(teams: readonly Team[]): Team | null {
  const inTeam = useMatch('/w/:slug/team/:teamId/*')?.params.teamId;
  const inSettings = useMatch('/w/:slug/settings/team/:teamId/*')?.params
    .teamId;
  const here = inTeam ?? inSettings ?? null;
  const [last, setLast] = useState<string | null>(null);

  if (here !== null && here !== '' && here !== last) {
    setLast(here);
  }

  const wanted = here ?? last;

  return teams.find((team) => team.id === wanted) ?? teams.at(0) ?? null;
}
