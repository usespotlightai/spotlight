import { RunComposer } from '@/components/features/runs/RunComposer';
import { TrailLink } from '@/components/shell/layout/TrailLink';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { newestRunAt, runPath, stoppable, waitsOnPerson } from '@/lib/run';
import type { LatestRun } from '@/lib/run-notes';

type MovedOnFooterProps = {
  slug: string;
  teamId: string;
  taskId: string | undefined;
  runId: string;
  latest: LatestRun;
  current: { id: string; name: string };
  onSent?: () => void;
};

export function MovedOnFooter({
  slug,
  teamId,
  taskId,
  runId,
  latest,
  current,
  onSent,
}: MovedOnFooterProps) {
  const { data: runs } = useTaskRuns(teamId, taskId);

  if (!runs) {
    return null;
  }

  const there = newestRunAt(runs, current.id);

  if (there) {
    return (
      <RunComposer
        slug={slug}
        teamId={teamId}
        runId={there.id}
        taskId={taskId}
        station={current.name}
        stationId={current.id}
        running={stoppable(there)}
        answering={waitsOnPerson(there)}
        onSent={onSent}
      />
    );
  }

  return (
    <p className="pb-5 text-center text-muted-foreground text-xs">
      The task has moved to{' '}
      {latest.id === runId ? (
        <strong>{current.name}</strong>
      ) : (
        <TrailLink
          to={runPath(slug, teamId, latest.id)}
          className="font-semibold underline-offset-4 hover:text-foreground hover:underline"
        >
          {current.name}
        </TrailLink>
      )}
      . Messages here reach no one.
    </p>
  );
}
