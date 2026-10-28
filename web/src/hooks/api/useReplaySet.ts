import { useQuery } from '@tanstack/react-query';
import { listTeamReplaySets, readReplaySet } from '@/lib/api';
import { noReplaySetYet, type ReplaySet } from '@/lib/replay';

export const replaySetKeys = {
  all: ['replay-sets'] as const,
  forStation: (stationId?: string) =>
    ['replay-sets', 'station', stationId ?? null] as const,
  forTeam: (teamId?: string) =>
    ['replay-sets', 'team', teamId ?? null] as const,
};

export function useReplaySet(
  teamId: string | undefined,
  lineId: string | undefined,
  stationId: string | undefined,
) {
  return useQuery({
    queryKey: replaySetKeys.forStation(stationId),
    enabled: Boolean(teamId && lineId && stationId),
    queryFn: async (): Promise<ReplaySet | null> => {
      const { data, error } = await readReplaySet({
        path: {
          teamId: teamId as string,
          lineId: lineId as string,
          stationId: stationId as string,
        },
      });

      if (noReplaySetYet(error)) {
        return null;
      }
      if (error || !data) {
        throw error;
      }
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
