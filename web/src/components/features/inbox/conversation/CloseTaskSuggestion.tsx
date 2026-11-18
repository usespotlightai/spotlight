import { DecisionCard } from '@/components/shared/DecisionCard';
import { DecisionHeader } from '@/components/shared/DecisionHeader';
import { DecisionTitle } from '@/components/shared/DecisionTitle';
import { PillButton } from '@/components/shared/PillButton';
import { useCloseTask } from '@/hooks/api/useCloseTask';
import { useTaskStation } from '@/hooks/api/useTaskStation';
import { useMe } from '@/hooks/useMe';
import { mayLand } from '@/lib/task';

type CloseTaskSuggestionProps = {
  slug: string;
  teamId: string;
  taskId: string;
  station: string;
};

export function CloseTaskSuggestion({
  slug,
  teamId,
  taskId,
  station,
}: CloseTaskSuggestionProps) {
  const me = useMe();
  const close = useCloseTask();
  const { line, task } = useTaskStation(teamId, taskId);
  const completed = line?.stations.find((each) => each.kind === 'completed');

  if (
    !line ||
    !task ||
    !completed ||
    !mayLand(line.stations, task, completed.id, me?.id)
  ) {
    return null;
  }

  return (
    <DecisionCard aria-label="Close the task" className="mt-4.5 pb-2">
      <DecisionHeader
        className="mb-0"
        title={
          <DecisionTitle status="pending">
            {`${station} suggests closing the task`}
          </DecisionTitle>
        }
        trailing={
          <PillButton
            variant="default"
            disabled={close.isPending}
            aria-label="Close the task"
            onClick={() =>
              close.mutate({
                slug,
                teamId,
                lineId: line.id,
                taskId,
                revision: task.revision,
                completedStationId: completed.id,
              })
            }
          >
            {close.isPending ? 'Closing…' : 'Close'}
          </PillButton>
        }
      />
    </DecisionCard>
  );
}
