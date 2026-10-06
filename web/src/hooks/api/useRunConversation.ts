import { useQuery } from '@tanstack/react-query';
import { readRunConversation } from '@/lib/api';

export const runConversationKeys = {
  all: ['run-conversation'] as const,
  forRun: (runId?: string) => ['run-conversation', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useRunConversation(teamId?: string, runId?: string) {
  return useQuery({
    queryKey: runConversationKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    refetchInterval: POLL_MS,
    queryFn: async () => {
      const { data } = await readRunConversation({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
