import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export class MemoryDecision {
  private constructor(
    readonly by: UserId,
    readonly at: Date,
  ) {}

  static of(input: { by: UserId; at: Date }): MemoryDecision {
    return new MemoryDecision(input.by, input.at);
  }

  equals(other: MemoryDecision): boolean {
    return this.by.equals(other.by) && this.at.getTime() === other.at.getTime();
  }
}
