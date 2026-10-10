import { useQuery } from '@tanstack/react-query';
import { readTeam } from '@/lib/api';

const teamResourceKeys = {
  detail: (teamId?: string) => ['team-resource', teamId ?? null] as const,
};

export function useTeamResource(teamId: string | undefined) {
  return useQuery({
    queryKey: teamResourceKeys.detail(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await readTeam({
        path: { id: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
