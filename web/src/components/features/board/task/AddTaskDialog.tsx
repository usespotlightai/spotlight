import type { ReactElement } from 'react';

import { NewTaskDialog } from '@/components/features/board/task/NewTaskDialog';
import { useAddTask } from '@/hooks/api/useAddTask';
import type { LineResponseDto } from '@/lib/api';
import { nonEmpty } from '@/lib/non-empty';

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
}: AddTaskDialogProps): ReactElement {
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
        nonEmpty(stationId) &&
        addTask.mutate({ teamId, lineId: line.id, stationId, task })
      }
    />
  );
}
