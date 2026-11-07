import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TaskOpening {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: LineId,
    readonly stationId: StationId,
    readonly by: UserId | null,
    readonly at: Date,
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId: LineId;
    stationId: StationId;
    by: UserId | null;
    at: Date;
  }): TaskOpening {
    return new TaskOpening(
      input.teamId,
      input.lineId,
      input.stationId,
      input.by,
      input.at,
    );
  }
}
