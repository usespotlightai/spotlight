import { useQuery } from '@tanstack/react-query';
import { listReplaySets, listTeamReplaySets } from '@/lib/api';
import type { ReplaySet } from '@/lib/replay';

export const replaySetKeys = {
  all: ['replay-sets'] as const,
  forStation: (stationId?: string) =>
    ['replay-sets', 'station', stationId ?? null] as const,
  forTeam: (teamId?: string) =>
    ['replay-sets', 'team', teamId ?? null] as const,
};

export function useReplaySets(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: replaySetKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<ReplaySet[]> => {
      const { data } = await listReplaySets({
        path: {
          teamId: teamId as string,
          lineId: lineId as string,
          stationId: stationId as string,
        },
        throwOnError: true,
      });
      return data;
    },
  });
}

export function useTeamReplaySets(teamId: string | undefined) {
  return useQuery({
    queryKey: replaySetKeys.forTeam(teamId),
    enabled: Boolean(teamId),
    queryFn: async (): Promise<ReplaySet[]> => {
      const { data } = await listTeamReplaySets({
        path: { teamId: teamId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
