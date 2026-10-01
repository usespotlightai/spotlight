import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TaskOpening {
  private constructor(
    readonly teamId: TeamId,
    readonly lineId: string,
    readonly stationId: string,
    readonly by: UserId | null,
    readonly at: Date,
  ) {}

  static of(input: {
    teamId: TeamId;
    lineId: string;
    stationId: string;
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
