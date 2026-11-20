import { ClosedTaskComposer } from '@/components/features/runs/ClosedTaskComposer';
import {
  RunComposer,
  WRITE_A_MESSAGE,
} from '@/components/features/runs/RunComposer';
import { useTaskRuns } from '@/hooks/api/useTaskRuns';
import { newestRunAt, stoppable, waitsOnPerson } from '@/lib/run';

type MovedOnFooterProps = {
  slug: string;
  teamId: string;
  taskId: string | undefined;
  current: { id: string; name: string };
  station: string;
  onSent?: () => void;
};

export function MovedOnFooter({
  slug,
  teamId,
  taskId,
  current,
  station,
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
    <ClosedTaskComposer
      slug={slug}
      teamId={teamId}
      taskId={taskId}
      station={station}
      label={`Message ${station}`}
      placeholder={WRITE_A_MESSAGE}
      because={`The task has moved to ${current.name}. Messages here reach no one.`}
    />
  );
}
