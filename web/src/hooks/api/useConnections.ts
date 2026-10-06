import { useQuery } from '@tanstack/react-query';
import { listConnections } from '@/lib/api';

export const connectionKeys = {
  forTeam: (teamId?: string) => ['connections', teamId ?? null] as const,
};

export function useConnections(teamId: string | undefined) {
  return useQuery({
    queryKey: connectionKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listConnections({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
