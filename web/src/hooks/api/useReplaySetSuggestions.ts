import { useQuery } from '@tanstack/react-query';
import { replaySetKeys } from '@/hooks/api/useReplaySets';
import { listReplaySetSuggestions } from '@/lib/api';
import type { SuggestedRun } from '@/lib/replay';

const replaySetSuggestionKeys = {
  forSet: (setId?: string) =>
    [...replaySetKeys.all, 'suggestions', setId ?? null] as const,
};

export function useReplaySetSuggestions(
  teamId: string | undefined,
  setId: string | undefined,
  enabled = true,
) {
  return useQuery({
    queryKey: replaySetSuggestionKeys.forSet(setId),
    enabled: enabled && Boolean(teamId && setId),
    queryFn: async (): Promise<SuggestedRun[]> => {
      const { data } = await listReplaySetSuggestions({
        path: { teamId: teamId as string, setId: setId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
