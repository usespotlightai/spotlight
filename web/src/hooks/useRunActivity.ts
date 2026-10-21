import { useStopInFlight } from '@/hooks/api/useStopRun';
import type { ReportedActivity } from '@/lib/run';

export function useRunActivity(
  runId: string | null | undefined,
  activity: ReportedActivity | null,
): ReportedActivity | null {
  const stopInFlight = useStopInFlight(runId);

  return stopInFlight ? 'stopping' : activity;
}
