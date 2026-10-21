import { useRunProgress } from '@/hooks/useRunProgress';
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
    (run
      ? {
          id: run.id,
          state: run.state,
          progress: run.progress,
        }
      : null);
  const progress = useRunProgress(latest?.id, latest?.progress ?? null);

  return latest ? { ...latest, progress } : latest;
}
