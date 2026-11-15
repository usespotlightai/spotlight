import { Square } from 'lucide-react';

import { useStopInFlight, useStopRun } from '@/hooks/api/useStopRun';
import type { MenuAction } from '@/lib/context-menu';

export function useStopRunAction(
  teamId: string | undefined,
  runId: string,
  stoppable: boolean,
): MenuAction | null {
  const stop = useStopRun();
  const stopping = useStopInFlight(runId);

  return teamId && stoppable
    ? {
        label: 'Stop run',
        icon: Square,
        disabled: stopping,
        onSelect: () => stop.mutate({ teamId, runId }),
      }
    : null;
}
