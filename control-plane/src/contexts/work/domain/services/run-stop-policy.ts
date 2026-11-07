import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Task } from '@work/domain/aggregates/task.aggregate';

export interface StoppableRun {
  readonly stationId: StationId | null;
  readonly taskId: TaskId | null;
}

export const RunStopPolicy = {
  allows(
    run: StoppableRun,
    task: Pick<Task, 'id' | 'assignedToThem'> | null,
    by: UserId,
  ): boolean {
    return (
      run.stationId !== null &&
      task !== null &&
      run.taskId?.equals(task.id) === true &&
      task.assignedToThem(by)
    );
  },
};
