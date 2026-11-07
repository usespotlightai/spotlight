import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';

export const RunStopPolicy = {
  allows(
    run: Pick<Run, 'stationId' | 'taskId'>,
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
