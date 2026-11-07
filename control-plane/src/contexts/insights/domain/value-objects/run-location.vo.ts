import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export class RunLocation {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly taskId: TaskId,
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId: LineId;
    stationId: StationId;
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
