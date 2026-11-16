import { useState } from 'react';

import { HandBackButton } from '@/components/features/takeover/HandBackButton';
import { HandBackDialog } from '@/components/features/takeover/HandBackDialog';
import { TakenOverPill } from '@/components/features/takeover/TakenOverPill';
import { TakeOverButton } from '@/components/features/takeover/TakeOverButton';
import { TakeOverDialog } from '@/components/features/takeover/TakeOverDialog';
import { useMembers } from '@/hooks/api/useMembers';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useCommands } from '@/hooks/useCommands';
import { useMe } from '@/hooks/useMe';
import { runPath } from '@/lib/run';
import { heldMoveOf, mayTakeOver, moveOnTargets } from '@/lib/takeover';

type RunTakeoverProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
  stationId: string | null;
};

export function RunTakeover({
  slug,
  teamId,
  taskId,
  runId,
  stationId,
}: RunTakeoverProps) {
  const { line, station, task } = useTaskStation(teamId, taskId);
  const me = useMe();
  const { data: members } = useMembers(teamId);
  const member = members?.some((each) => each.id === me?.id) ?? false;
  const [opened, setOpened] = useState<'take-over' | 'hand-back' | null>(null);
  const takeover = task?.takeover;
  const mine = Boolean(takeover && takeover.by.id === me?.id);
  const takeable = Boolean(
    task && station?.id === stationId && mayTakeOver(task, station, member),
  );
  useCommands([
    ...(mine
      ? [{ id: 'task.hand-back' as const, run: () => setOpened('hand-back') }]
      : []),
    ...(takeable
      ? [{ id: 'task.take-over' as const, run: () => setOpened('take-over') }]
      : []),
  ]);
  const closeUnless = (open: boolean) => {
    if (!open) {
      setOpened(null);
    }
  };

  if (!task || !station) {
    return null;
  }

  if (!takeover) {
    return takeable ? (
      <>
        <TakeOverButton onClick={() => setOpened('take-over')} />
        <TakeOverDialog
          open={opened === 'take-over'}
          onOpenChange={closeUnless}
          slug={slug}
          teamId={teamId}
          taskId={task.id}
          station={station.name}
          working={task.progress !== null}
        />
      </>
    ) : null;
  }

  if (!mine) {
    return (
      <TakenOverPill
        takeover={takeover}
        to={
          takeover.runId && takeover.runId !== runId
            ? runPath(slug, teamId, takeover.runId)
            : undefined
        }
      />
    );
  }

  return (
    <>
      <HandBackButton onClick={() => setOpened('hand-back')} />
      <HandBackDialog
        open={opened === 'hand-back'}
        onOpenChange={closeUnless}
        teamId={teamId}
        taskId={task.id}
        station={station}
        moveOn={moveOnTargets(line?.stations ?? [], station)}
        held={heldMoveOf(line, task)}
        verdict={takeover.verdict}
        working={task.progress !== null}
        turn={takeover.runId}
      />
    </>
  );
}
