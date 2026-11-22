import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamStanding } from '@work/domain/value-objects/team-standing.vo';

export interface StoppableRun {
  readonly stationId: StationId | null;
  readonly taskId: TaskId | null;
}

export interface StoppedTask {
  readonly id: TaskId;
}

export const RunStopPolicy = {
  allows(
    run: StoppableRun,
    task: StoppedTask | null,
    standing: TeamStanding,
  ): boolean {
    return (
      run.stationId !== null &&
      task !== null &&
      run.taskId?.equals(task.id) === true &&
      standing.actsOnTasks
    );
  },
};
