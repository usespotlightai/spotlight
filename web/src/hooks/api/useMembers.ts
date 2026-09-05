import { useQuery } from '@tanstack/react-query';
import { listMembers } from '@/lib/api';

export const memberKeys = {
  forTeam: (teamId?: string) => ['members', teamId ?? null] as const,
};

export function useMembers(teamId: string | undefined) {
  return useQuery({
    queryKey: memberKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listMembers({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
