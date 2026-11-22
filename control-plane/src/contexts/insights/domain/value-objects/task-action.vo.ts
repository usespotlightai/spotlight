import type { ActionKind } from '@insights/domain/value-objects/person-action.vo';
import type { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TaskAction {
  private constructor(
    readonly kind: ActionKind,
    readonly by: UserId,
    readonly stationId: StationId,
    readonly at: Date,
  ) {}

  static of(input: {
    kind: ActionKind;
    by: UserId;
    stationId: StationId;
    at: Date;
  }): TaskAction {
    return new TaskAction(input.kind, input.by, input.stationId, input.at);
  }

  equals(other: TaskAction): boolean {
    return (
      this.kind === other.kind &&
      this.by.equals(other.by) &&
      this.stationId.equals(other.stationId) &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
