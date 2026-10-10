import { useQuery } from '@tanstack/react-query';
import { readStationAlert } from '@/lib/api';
import type { StationAlertCrossing } from '@/lib/station-alert';

const stationAlertKeys = {
  of: (teamId: string | undefined, alertId: string | undefined) =>
    ['station-alert', teamId ?? null, alertId ?? null] as const,
};

export function useStationAlert(
  teamId: string | undefined,
  alertId: string | undefined,
) {
  return useQuery({
    queryKey: stationAlertKeys.of(teamId, alertId),
    enabled: Boolean(teamId && alertId),
    queryFn: async (): Promise<StationAlertCrossing> => {
      const { data } = await readStationAlert({
        path: { teamId: teamId as string, alertId: alertId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
