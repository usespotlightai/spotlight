import { useEffect, useRef } from 'react';

/**
 * How often a run that is talking without pause is read. Twice the runner's own
 * ~200ms flush, so a busy run refetches steadily rather than only once it falls
 * quiet — the whole point being to watch the steps land as they arrive.
 */
const EVERY_MS = 500;

/**
 * Watches a run's event stream and calls `onBump` as it stirs. The control
 * plane replays what was missed, so a page opened mid-run catches up; each
 * event only nudges a refetch, since the journal it drives is read whole
 * rather than assembled from the events here.
 */
export function useRunStream(
  runId: string | undefined,
  live: boolean,
  onBump: () => void,
) {
  // Held in a ref so a changing callback does not tear the stream down.
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

    // Throttled, not debounced: a debounce that resets on every event never
    // fires while the run keeps talking, so the steps would only appear once it
    // finished. This reads the first event at once and then at most every
    // EVERY_MS for as long as they keep coming, with a final read after.
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

    // Left open on error: EventSource reconnects on its own, resending the
    // last id it saw, which the control plane honours to catch the reader up.

    return () => {
      clearInterval(ticker);
      stream.close();
    };
  }, [runId, live]);
}
