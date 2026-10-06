import { type UseQueryResult, useQueries } from '@tanstack/react-query';
import { readConfigOrigins } from '@/lib/api';
import {
  type ChangeAskedAbout,
  type ConfigOrigin,
  changeBatches,
} from '@/lib/insights-candidates';
import type { ChangeAt } from '@/lib/insights-changes';

export const configOriginsKeys = {
  forBatch: (teamId: string | undefined, batch: readonly ChangeAskedAbout[]) =>
    ['insights', 'config-origins', teamId ?? null, batch] as const,
};

export type ConfigOrigins = {
  readonly origins: readonly ConfigOrigin[];
  readonly failed: boolean;
  readonly retry: () => void;
};

const merged = (
  results: readonly UseQueryResult<readonly ConfigOrigin[]>[],
): ConfigOrigins => ({
  origins: results.flatMap((each) => each.data ?? []),
  failed: results.some((each) => each.isError),
  retry: () => {
    for (const each of results) {
      if (each.isError) {
        void each.refetch();
      }
    }
  },
});

export function useConfigOrigins(
  teamId: string | undefined,
  changes: readonly ChangeAt[],
): ConfigOrigins {
  return useQueries({
    queries: changeBatches(changes).map((batch) => ({
      queryKey: configOriginsKeys.forBatch(teamId, batch),
      enabled: Boolean(teamId),
      queryFn: async (): Promise<readonly ConfigOrigin[]> => {
        const { data } = await readConfigOrigins({
          path: { teamId: teamId as string },
          body: { changes: batch },
          throwOnError: true,
        });
        return data.origins;
      },
    })),
    combine: merged,
  });
}
