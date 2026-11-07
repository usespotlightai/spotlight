import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';

export const CHECK_ROUNDS = ['first', 'recheck'] as const;

export type CheckRound = (typeof CHECK_ROUNDS)[number];

export class StackCheckId {
  private constructor(
    readonly stackId: ChangeStackId,
    readonly round: CheckRound,
  ) {}

  static first(stackId: ChangeStackId): StackCheckId {
    return new StackCheckId(stackId, 'first');
  }

  static recheckOf(stackId: ChangeStackId): StackCheckId {
    return new StackCheckId(stackId, 'recheck');
  }

  static of(stackId: ChangeStackId, recheck: boolean): StackCheckId {
    return recheck
      ? StackCheckId.recheckOf(stackId)
      : StackCheckId.first(stackId);
  }

  get recheck(): boolean {
    return this.round === 'recheck';
  }

  equals(other: StackCheckId): boolean {
    return this.stackId.equals(other.stackId) && this.round === other.round;
  }

  toString(): string {
    return `${this.stackId.value} (${this.round} check)`;
  }
}
