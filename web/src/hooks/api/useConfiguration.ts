import { useQuery } from '@tanstack/react-query';
import { readConfiguration } from '@/lib/api';

export const configurationKeys = {
  forTeam: (teamId?: string) => ['configuration', teamId ?? null] as const,
};

export function useConfiguration(teamId: string | undefined) {
  return useQuery({
    queryKey: configurationKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async () => {
      const { data } = await readConfiguration({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
