import { useQuery } from '@tanstack/react-query';
import { listTeamSkills } from '@/lib/api';

export function useTeamSkills(teamId: string | undefined) {
  return useQuery({
    queryKey: ['team-skills', teamId ?? null],
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
