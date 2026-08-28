import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assemblyLineKeys } from '@/hooks/api/useAssemblyLines';
import { customiseStation } from '@/lib/api';

type CustomiseStationInput = {
  teamId: string;
  lineId: string;
  stationId: string;
  changes: {
    name?: string;
    color?: string;
    description?: string | null;
    pool?: string | null;
    agentPrompt?: string | null;
  };
};

export function useCustomiseStation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      stationId,
      changes,
    }: CustomiseStationInput) => {
      const { data } = await customiseStation({
        path: { teamId, lineId, stationId },
        body: changes,
        throwOnError: true,
      });
      return data;
    },
    onSuccess: (_station, { teamId }) =>
      queryClient.invalidateQueries({
        queryKey: assemblyLineKeys.forTeam(teamId),
      }),
  });
}
