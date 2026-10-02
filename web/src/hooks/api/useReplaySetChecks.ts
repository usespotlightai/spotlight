import { useInfiniteQuery } from '@tanstack/react-query';
import { listReplaySetChecks } from '@/lib/api';
import { CHECKS_PAGE, type ReplayCheckSummary } from '@/lib/search';

export const replayCheckKeys = {
  forSet: (setId?: string) => ['replay-checks', 'set', setId ?? null] as const,
};

const POLL_MS = 10_000;

export function useReplaySetChecks(
  teamId: string | undefined,
  setId: string | undefined,
) {
  return useInfiniteQuery({
    queryKey: replayCheckKeys.forSet(setId),
    enabled: Boolean(teamId && setId),
    refetchInterval: (query) =>
      query.state.data?.pages.some((page) =>
        page.some((check) => check.verdict === 'running'),
      )
        ? POLL_MS
        : false,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last: ReplayCheckSummary[]) =>
      last.length === CHECKS_PAGE ? last[last.length - 1]?.id : undefined,
    queryFn: async ({ pageParam }): Promise<ReplayCheckSummary[]> => {
      const { data } = await listReplaySetChecks({
        path: { teamId: teamId as string, setId: setId as string },
        query: {
          limit: CHECKS_PAGE,
          ...(pageParam ? { before: pageParam } : {}),
        },
        throwOnError: true,
      });
      return data;
    },
  });
}
