import { useQuery } from '@tanstack/react-query';
import { listLabels } from '@/lib/api';

export const labelKeys = {
  forTeam: (teamId?: string) => ['labels', teamId ?? null] as const,
};

export function useLabels(teamId: string | undefined) {
  return useQuery({
    queryKey: labelKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await listLabels({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
