import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { lineKeys } from '@/hooks/api/useLines';
import { readConfiguration, rereadConfiguration } from '@/lib/api';

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

export function useRereadConfiguration(teamId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data } = await rereadConfiguration({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(configurationKeys.forTeam(teamId), data);
      queryClient.invalidateQueries({
        queryKey: lineKeys.forTeam(teamId),
      });
    },
  });
}
