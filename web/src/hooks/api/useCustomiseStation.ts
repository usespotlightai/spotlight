import { useMutation } from '@tanstack/react-query';
import { customiseStation } from '@/lib/api';

type CustomiseStationInput = {
  teamId: string;
  lineId: string;
  stationId: string;
  changes: {
    name?: string;
    color?: string;
    description?: string | null;
    harness?: string | null;
    agentPrompt?: string | null;
  };
};

/** Git-first: opens/updates a pull request and returns it; the board is not
 *  changed here, so nothing is invalidated. */
export function useCustomiseStation() {
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
  });
}
