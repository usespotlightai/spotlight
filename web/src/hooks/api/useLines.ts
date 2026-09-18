import { useQuery } from '@tanstack/react-query';
import { listLines } from '@/lib/api';

export const lineKeys = {
  forTeam: (teamId?: string) => ['lines', teamId ?? null] as const,
};

export function useLines(teamId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: lineKeys.forTeam(teamId),
    enabled: enabled && Boolean(teamId),
    queryFn: async () => {
      const { data } = await listLines({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
