import { use } from 'react';

import { DecisionButton } from '@/components/shared/DecisionButton';
import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionControls } from '@/components/shared/DecisionControls';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { PillButton } from '@/components/shared/PillButton';
import { useCloseTask } from '@/hooks/api/useCloseTask';
import type { ClosableTask } from '@/hooks/useClosableTask';
import { DockedContext } from '@/lib/decision-tray';

type CloseTaskSuggestionProps = {
  slug: string;
  teamId: string;
  station: string;
  closable: ClosableTask;
};

export function CloseTaskSuggestion({
  slug,
  teamId,
  station,
  closable: { line, task, completed },
}: CloseTaskSuggestionProps) {
  const close = useCloseTask();
  const docked = use(DockedContext) !== null;
  const Action = docked ? DecisionButton : PillButton;
  const action = (
    <Action
      variant="default"
      disabled={close.isPending}
      aria-label="Close the task"
      onClick={() =>
        close.mutate({
          slug,
          teamId,
          lineId: line.id,
          taskId: task.id,
          revision: task.revision,
          completedStationId: completed.id,
        })
      }
    >
      {close.isPending ? 'Closing…' : 'Close'}
    </Action>
  );

  return (
    <DecisionCard aria-label="Close the task" className="pb-2">
      <DecisionHeader
        className="mb-0"
        title={
          <DecisionTitle status="pending">
            {`${station} suggests closing the task`}
          </DecisionTitle>
        }
        trailing={docked ? null : action}
      />
      {docked && <DecisionControls>{action}</DecisionControls>}
    </DecisionCard>
  );
}
