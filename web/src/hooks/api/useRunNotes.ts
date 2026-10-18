import { useQuery } from '@tanstack/react-query';
import { readRunNotes } from '@/lib/api';

export const runNotesKeys = {
  all: ['run-notes'] as const,
  forRun: (runId?: string) => ['run-notes', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useRunNotes(teamId?: string, runId?: string) {
  return useQuery({
    queryKey: runNotesKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readRunNotes({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
