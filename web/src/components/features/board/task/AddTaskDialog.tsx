import { NewTaskDialog } from '@/components/features/board/task/NewTaskDialog';
import { useAddTask } from '@/hooks/api/useAddTask';
import type { LineResponseDto } from '@/lib/api';

type AddTaskDialogProps = {
  slug: string;
  teamId: string;
  line: LineResponseDto;
  stationId: string | null;
  onClose: () => void;
};

export function AddTaskDialog({
  slug,
  teamId,
  line,
  stationId,
  onClose,
}: AddTaskDialogProps) {
  const addTask = useAddTask();

  return (
    <NewTaskDialog
      slug={slug}
      open={stationId !== null}
      onOpenChange={(next) => !next && onClose()}
      lineName={line.name}
      stationName={
        line.stations.find((each) => each.id === stationId)?.name ?? ''
      }
      onCreate={(task) =>
        stationId &&
        addTask.mutate({ teamId, lineId: line.id, stationId, task })
      }
    />
  );
}
