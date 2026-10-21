import { useStopInFlight } from '@/hooks/api/useStopRun';
import type { Progress } from '@/lib/run';

export function useRunProgress(
  runId: string | null | undefined,
  progress: Progress | null,
): Progress | null {
  const stopInFlight = useStopInFlight(runId);

  return stopInFlight ? 'stopping' : progress;
}
