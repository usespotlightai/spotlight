import { queryOptions, useQuery } from '@tanstack/react-query';
import { listTeamLines } from '@/lib/api';

export const lineKeys = {
  forTeam: (teamId?: string) => ['lines', teamId ?? null] as const,
};

export const linesQuery = (teamId: string | undefined) =>
  queryOptions({
    queryKey: lineKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listTeamLines({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });

export function useLines(teamId: string | undefined, enabled = true) {
  return useQuery({
    ...linesQuery(teamId),
    enabled: enabled && Boolean(teamId),
  });
}
