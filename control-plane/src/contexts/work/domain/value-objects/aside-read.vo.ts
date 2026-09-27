import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class AsideRead {
  private constructor(
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: { by: UserId; at: Date }): AsideRead {
    return new AsideRead(input.by, input.at);
  }

  equals(other: AsideRead): boolean {
    return this.by.equals(other.by) && this.at.getTime() === other.at.getTime();
  }
}
