import type { HumanActionKind } from '@insights/domain/value-objects/human-action.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class TaskHumanAction {
  private constructor(
    readonly kind: HumanActionKind,
    readonly by: UserId,
    readonly stationId: string,
    readonly at: Date,
  ) {}

  static of(input: {
    kind: HumanActionKind;
    by: UserId;
    stationId: string;
    at: Date;
  }): TaskHumanAction {
    return new TaskHumanAction(input.kind, input.by, input.stationId, input.at);
  }

  get dismisses(): boolean {
    return this.kind === 'dismissed';
  }

  equals(other: TaskHumanAction): boolean {
    return (
      this.kind === other.kind &&
      this.by.equals(other.by) &&
      this.stationId === other.stationId &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
