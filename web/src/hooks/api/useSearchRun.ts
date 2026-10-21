import { useQuery } from '@tanstack/react-query';
import { readSearchRun } from '@/lib/api';
import { active } from '@/lib/run';
import type { SearchRun } from '@/lib/search';

const searchRunKeys = {
  forRun: (runId?: string) => ['search-run', runId ?? null] as const,
};

const POLL_MS = 5_000;

export function useSearchRun(
  teamId: string | undefined,
  runId: string | undefined,
) {
  return useQuery({
    queryKey: searchRunKeys.forRun(runId),
    enabled: Boolean(teamId && runId),
    retry: false,
    refetchInterval: (query) =>
      query.state.data && active(query.state.data) ? POLL_MS : false,
    queryFn: async (): Promise<SearchRun> => {
      const { data } = await readSearchRun({
        path: { teamId: teamId as string, runId: runId as string },
        throwOnError: true,
      });
      return data;
    },
  });
}
