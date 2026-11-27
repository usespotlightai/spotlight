import { useQuery, type UseQueryResult } from '@tanstack/react-query';

import { readRunNotes, type RunNotesResponseDto } from '@/lib/api';
import { required } from '@/lib/required';

export const runNotesKeys = {
  all: ['run-notes'] as const,
  forRun: (runId?: string) => ['run-notes', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useRunNotes(
  teamId?: string,
  runId?: string,
): UseQueryResult<RunNotesResponseDto> {
  return useQuery({
    queryKey: runNotesKeys.forRun(runId),
    enabled: Boolean(teamId) && Boolean(runId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readRunNotes({
        path: { teamId: required(teamId), runId: required(runId) },
        throwOnError: true,
      });
      return data;
    },
  });
}
