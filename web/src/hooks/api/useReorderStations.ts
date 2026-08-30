import { useMutation, useQueryClient } from '@tanstack/react-query';
import { assemblyLineKeys } from '@/hooks/api/useAssemblyLines';
import { type AssemblyLineResponseDto, reorderStations } from '@/lib/api';

type ReorderStationsInput = {
  teamId: string;
  lineId: string;
  stationIds: string[];
};

export function useReorderStations() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      teamId,
      lineId,
      stationIds,
    }: ReorderStationsInput) => {
      const { data } = await reorderStations({
        path: { teamId, lineId },
        body: { stationIds },
        throwOnError: true,
      });
      return data;
    },

    onMutate: ({ teamId, lineId, stationIds }) => {
      const key = assemblyLineKeys.forTeam(teamId);
      const standing = queryClient.getQueryData<AssemblyLineResponseDto[]>(key);

      if (standing) {
        queryClient.setQueryData(
          key,
          standing.map((line) =>
            line.id === lineId
              ? {
                  ...line,
                  stations: stationIds.flatMap((stationId, position) => {
                    const station = line.stations.find(
                      (each) => each.id === stationId,
                    );
                    return station ? [{ ...station, position }] : [];
                  }),
                }
              : line,
          ),
        );
      }

      void queryClient.cancelQueries({ queryKey: key });

      return { standing };
    },

    onError: (_error, { teamId }, context) => {
      if (context?.standing) {
        queryClient.setQueryData(
          assemblyLineKeys.forTeam(teamId),
          context.standing,
        );
      }
    },

    onSettled: (_line, _error, { teamId }) =>
      queryClient.invalidateQueries({
        queryKey: assemblyLineKeys.forTeam(teamId),
      }),
  });
}
