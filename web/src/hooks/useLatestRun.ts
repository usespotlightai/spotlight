import { useRunActivity } from '@/hooks/useRunActivity';
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
    (run ? { id: run.id, state: run.state, activity: run.activity } : null);
  const activity = useRunActivity(latest?.id, latest?.activity ?? null);

  return latest ? { ...latest, activity } : latest;
}
