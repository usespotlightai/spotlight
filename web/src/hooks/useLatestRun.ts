import { useStopInFlight } from '@/hooks/api/useStopRun';
import type { TeamRun } from '@/lib/run';
import type { LatestRun, RunNotes } from '@/lib/run-notes';

export function useLatestRun(
  run: TeamRun,
  conversation: RunNotes | undefined,
): LatestRun;
export function useLatestRun(
  run: TeamRun | undefined,
  conversation: RunNotes | undefined,
): LatestRun | null;
export function useLatestRun(
  run: TeamRun | undefined,
  conversation: RunNotes | undefined,
): LatestRun | null {
  const latest =
    conversation?.latestRun ??
    (run ? { id: run.id, state: run.state, stopping: false } : null);
  const asked = useStopInFlight(latest?.id);

  return latest && asked ? { ...latest, stopping: true } : latest;
}
