import { useEffect, useRef } from 'react';

/** Refetch cadence while a run keeps talking: twice the runner's ~200ms flush. */
const EVERY_MS = 500;

export function useRunStream(
  runId: string | undefined,
  live: boolean,
  onBump: () => void,
) {
  const bump = useRef(onBump);
  bump.current = onBump;

  useEffect(() => {
    if (!runId || !live) {
      return;
    }

    const stream = new EventSource(
      `/api/runs/${encodeURIComponent(runId)}/stream`,
      {
        withCredentials: true,
      },
    );

    // Throttled, not debounced: a debounce never fires while events keep coming.
    let pending = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    const flush = () => {
      pending = false;
      bump.current();
    };

    stream.onmessage = () => {
      pending = true;

      if (ticker !== undefined) {
        return;
      }

      flush();
      ticker = setInterval(() => {
        if (pending) {
          flush();
        } else {
          clearInterval(ticker);
          ticker = undefined;
        }
      }, EVERY_MS);
    };

    // Left open on error: EventSource reconnects itself and resends the last event id.

    return () => {
      clearInterval(ticker);
      stream.close();
    };
  }, [runId, live]);
}
