import type { QueryClient, QueryKey } from '@tanstack/react-query';

import { isLive } from '@/lib/live';
import {
  LIVE_SEQUENCES_HEADER,
  liveSequences,
  positionsIn,
} from '@/lib/live-sequences';

export const WRITE_WAIT_MS = 3_000;

const invalidatedAll = (
  queryClient: QueryClient,
  touched: readonly QueryKey[],
) =>
  Promise.all(
    touched.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );

const invalidatedKept = (
  queryClient: QueryClient,
  touched: readonly QueryKey[],
  kept: ReadonlySet<string>,
) =>
  Promise.all(
    touched
      .flatMap((queryKey) => queryClient.getQueryCache().findAll({ queryKey }))
      .filter(
        (query) => kept.has(query.queryHash) && !query.state.isInvalidated,
      )
      .map((query) =>
        queryClient.invalidateQueries({
          queryKey: query.queryKey,
          exact: true,
        }),
      ),
  );

export async function refreshAfterWrite(
  queryClient: QueryClient,
  response: Response | undefined,
  touched: readonly QueryKey[],
): Promise<void> {
  const positions = positionsIn(
    response?.headers.get(LIVE_SEQUENCES_HEADER) ?? null,
  ).filter((position) => liveSequences.watches(position.channel));
  const kept =
    positions.length > 0 && isLive()
      ? await liveSequences.settledAt(positions, WRITE_WAIT_MS)
      : null;

  await (kept === null
    ? invalidatedAll(queryClient, touched)
    : invalidatedKept(queryClient, touched, kept));
}
