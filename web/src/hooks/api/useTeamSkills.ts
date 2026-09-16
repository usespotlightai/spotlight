import { useQuery } from '@tanstack/react-query';
import { listTeamSkills } from '@/lib/api';

export const teamSkillKeys = {
  forTeam: (teamId?: string) => ['team-skills', teamId ?? null] as const,
};

export function useTeamSkills(teamId: string | undefined) {
  return useQuery({
    queryKey: teamSkillKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTeamSkills({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
