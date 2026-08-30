import { useEffect, useState } from 'react';

/** The control plane replays what was missed, so a page opened mid-run catches up. */
export function useRunStream(runId: string | undefined, live: boolean) {
  const [heard, setHeard] = useState(0);

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

    stream.onmessage = () => setHeard((was) => was + 1);
    stream.onerror = () => stream.close();

    return () => stream.close();
  }, [runId, live]);

  return heard;
}
