import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RunLocation {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: string,
    readonly stationId: string,
    readonly taskId: TaskId,
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId: string;
    stationId: string;
    taskId: TaskId;
  }): RunLocation {
    return new RunLocation(
      input.teamId,
      input.lineId,
      input.stationId,
      input.taskId,
    );
  }
}
