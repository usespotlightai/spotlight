import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readStationAlert } from '@/lib/api';
import { required } from '@/lib/required';
import type { StationAlertFiring } from '@/lib/station-alert';

const stationAlertKeys = {
  of: (teamId: string | undefined, alertId: string | undefined) =>
    ['station-alert', teamId ?? null, alertId ?? null] as const,
};

export function useStationAlert(
  teamId: string | undefined,
  alertId: string | undefined,
): UseQueryResult<StationAlertFiring> {
  return useQuery({
    queryKey: stationAlertKeys.of(teamId, alertId),
    enabled: Boolean(teamId) && Boolean(alertId),
    queryFn: async (): Promise<StationAlertFiring> => {
      const { data } = await readStationAlert({
        path: { teamId: required(teamId), alertId: required(alertId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
