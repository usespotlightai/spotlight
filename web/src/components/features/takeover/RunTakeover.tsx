import { Undo2 } from 'lucide-react';
import { useState } from 'react';

import { HandBackDialog } from '@/components/features/takeover/HandBackDialog';
import { TakenOverPill } from '@/components/features/takeover/TakenOverPill';
import { ShortcutHint } from '@/components/shared/shortcut/ShortcutHint';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useCommands } from '@/hooks/useCommands';
import { useMe } from '@/hooks/useMe';
import { runPath } from '@/lib/run';
import { heldMoveOf, moveOnTargets } from '@/lib/takeover';

type RunTakeoverProps = {
  slug: string;
  teamId: string;
  taskId: string;
  runId: string;
};

export function RunTakeover({ slug, teamId, taskId, runId }: RunTakeoverProps) {
  const { line, station, task } = useTaskStation(teamId, taskId);
  const me = useMe();
  const [giving, setGiving] = useState(false);
  const takeover = task?.takeover;
  const mine = Boolean(takeover && takeover.by.id === me?.id);
  useCommands(
    mine ? [{ id: 'task.hand-back', run: () => setGiving(true) }] : [],
  );

  if (!task || !takeover || !station) {
    return null;
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button variant="ghost" size="sm" onClick={() => setGiving(true)} />
          }
        >
          <Undo2 className="size-3.5" aria-hidden />
          Give it back
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <ShortcutHint id="task.hand-back">
            Give the task back to the line
          </ShortcutHint>
        </TooltipContent>
      </Tooltip>
      <HandBackDialog
        open={giving}
        onOpenChange={setGiving}
        teamId={teamId}
        taskId={task.id}
        station={station}
        moveOn={moveOnTargets(line?.stations ?? [], station)}
        held={heldMoveOf(line, task)}
        verdict={takeover.verdict}
        working={task.progress !== null}
      />
    </>
  );
}
