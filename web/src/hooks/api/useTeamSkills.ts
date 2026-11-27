import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { listTeamSkills, type TeamSkillsResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

const teamSkillKeys = {
  forTeam: (teamId?: string) => ['team-skills', teamId ?? null] as const,
};

export function useTeamSkills(
  teamId: string | undefined,
): UseQueryResult<TeamSkillsResponseDto> {
  return useQuery({
    queryKey: teamSkillKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTeamSkills({
        path: { teamId: required(teamId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
