import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class InboxRequestRead {
  private constructor(
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: { by: UserId; at: Date }): InboxRequestRead {
    return new InboxRequestRead(input.by, input.at);
  }

  equals(other: InboxRequestRead): boolean {
    return this.by.equals(other.by) && this.at.getTime() === other.at.getTime();
  }
}
