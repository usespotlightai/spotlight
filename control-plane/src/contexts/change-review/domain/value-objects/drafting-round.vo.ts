import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';

/**
 * One session that drafts a change stack: the stack, the check a redraft answers, and the attempt of the stack's
 * job. A retried job drafts in a new round; a job that waits for its session keeps its round.
 */
export class DraftingRound {
  private constructor(
    readonly stackId: ChangeStackId,
    /** The check whose failed layers the redraft fixes; null for the first draft. */
    readonly redraftOf: StackCheckId | null,
    readonly attempt: number,
  ) {}

  static draft(stackId: ChangeStackId, attempt: number): DraftingRound {
    return new DraftingRound(stackId, null, DraftingRound.attemptOf(attempt));
  }

  static redraft(check: StackCheckId, attempt: number): DraftingRound {
    return new DraftingRound(
      check.stackId,
      check,
      DraftingRound.attemptOf(attempt),
    );
  }

  private static attemptOf(attempt: number): number {
    if (!Number.isInteger(attempt) || attempt < 0) {
      throw InvalidChangeStackError.because(
        `cannot be drafted in attempt ${attempt}`,
      );
    }

    return attempt;
  }

  get redrafting(): boolean {
    return this.redraftOf !== null;
  }

  equals(other: DraftingRound): boolean {
    return (
      this.stackId.equals(other.stackId) &&
      this.attempt === other.attempt &&
      (this.redraftOf === null
        ? other.redraftOf === null
        : other.redraftOf !== null && this.redraftOf.equals(other.redraftOf))
    );
  }
}
