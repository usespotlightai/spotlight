import { type ReactElement, useState } from 'react';

import { OnHoldPill } from '@/components/features/hold/OnHoldPill';
import { ResumeButton } from '@/components/features/hold/ResumeButton';
import { ResumeDialog } from '@/components/features/hold/ResumeDialog';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useCommands } from '@/hooks/useCommands';
import { heldMoveOf, moveOnTargets } from '@/lib/hold';
import { nonEmpty } from '@/lib/non-empty';
import { runPath } from '@/lib/run';

type RunHoldProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
};

export function RunHold({
  slug,
  teamId,
  taskId,
  runId,
}: RunHoldProps): ReactElement | null {
  const { line, station, task } = useTaskStation(teamId, taskId);
  const [resuming, setResuming] = useState(false);
  const hold = task?.hold;
  const ends = hold?.viewerEnds ?? false;
  useCommands(
    ends ? [{ id: 'task.resume' as const, run: () => setResuming(true) }] : [],
  );

  if (!task || !station || !hold) {
    return null;
  }

  if (!ends) {
    return (
      <OnHoldPill
        hold={hold}
        to={
          nonEmpty(hold.runId) && hold.runId !== runId
            ? runPath(slug, teamId, hold.runId)
            : undefined
        }
      />
    );
  }

  return (
    <>
      <ResumeButton onClick={() => setResuming(true)} />
      <ResumeDialog
        open={resuming}
        onOpenChange={setResuming}
        teamId={teamId}
        taskId={task.id}
        station={station}
        moveOn={moveOnTargets(line?.stations ?? [], station)}
        held={heldMoveOf(line, task)}
        working={task.progress !== null}
        turn={hold.runId}
      />
    </>
  );
}
