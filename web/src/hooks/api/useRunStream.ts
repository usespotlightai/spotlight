import { useEffect, useEffectEvent } from 'react';
import type { Work } from '@/lib/run';

const EVERY_MS = 500;

export function useRunStream(
  runId: string | undefined,
  open: boolean,
  work: Work | null,
  onBump: () => void,
) {
  const bump = useEffectEvent(onBump);

  useEffect(() => {
    if (!runId || !open) {
      return;
    }

    const stream = new EventSource(
      `/api/runs/${encodeURIComponent(runId)}/stream`,
      {
        withCredentials: true,
      },
    );

    let pending = false;
    let ticker: ReturnType<typeof setInterval> | undefined;

    const flush = () => {
      pending = false;
      bump();
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

    return () => {
      clearInterval(ticker);
      stream.close();
    };
  }, [runId, open, work]);
}
