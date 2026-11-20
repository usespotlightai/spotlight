import { MovedOnFooter } from '@/components/features/runs/MovedOnFooter';
import { RunComposer } from '@/components/features/runs/RunComposer';
import { RunNotStartedNotice } from '@/components/features/runs/RunNotStartedNotice';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useMe } from '@/hooks/useMe';
import { heldByOther } from '@/lib/hold';
import { stoppable, type TeamRun, waitsOnPerson } from '@/lib/run';
import type { LatestRun, RunNotes } from '@/lib/run-notes';

type RunFooterProps = {
  slug: string;
  teamId: string;
  run: TeamRun;
  latest: LatestRun;
  conversation: RunNotes | undefined;
  deciding: boolean;
  onSent?: () => void;
};

export function RunFooter({
  slug,
  teamId,
  run,
  latest,
  conversation,
  deciding,
  onSent,
}: RunFooterProps) {
  const { station: current, task } = useTaskStation(
    teamId,
    conversation?.taskId,
  );
  const me = useMe();
  const heldByTeammate = heldByOther(task?.hold, me?.id);

  if (heldByTeammate) {
    return (
      <p className="pb-5 text-center text-muted-foreground text-xs">
        {heldByTeammate.by.name} put the task on hold. The agent reads new
        messages after they resume the line.
      </p>
    );
  }

  if (current && task?.runNotStarted) {
    return (
      <>
        <RunNotStartedNotice
          teamId={teamId}
          taskId={task.id}
          station={current.name}
          harness={task.runNotStarted.harness}
        />
        <RunComposer
          slug={slug}
          teamId={teamId}
          runId={null}
          taskId={task.id}
          station={current.name}
          stationId={current.id}
          running={false}
          answering={false}
          onSent={onSent}
        />
      </>
    );
  }

  if (current && run.station && current.id !== run.station.id) {
    return (
      <MovedOnFooter
        slug={slug}
        teamId={teamId}
        taskId={conversation?.taskId}
        runId={run.id}
        latest={latest}
        current={current}
        onSent={onSent}
      />
    );
  }

  return (
    <RunComposer
      slug={slug}
      teamId={teamId}
      runId={latest.id}
      taskId={conversation?.taskId}
      station={run.station?.name ?? 'the agent'}
      stationId={run.station?.id}
      running={stoppable(latest)}
      answering={waitsOnPerson(latest) && !deciding}
      onSent={onSent}
    />
  );
}
