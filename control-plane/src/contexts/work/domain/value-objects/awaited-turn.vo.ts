import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { InvalidTaskTransitionError } from '@work/domain/exceptions/invalid-task-transition.error';

export class AwaitedTurn {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
  ) {}

  static of(runId: RunId, attempt: number): AwaitedTurn {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new InvalidTaskTransitionError(
        `Run ${runId.value} has no attempt ${attempt} to await.`,
      );
    }

    return new AwaitedTurn(runId, attempt);
  }

  equals(other: AwaitedTurn): boolean {
    return this.runId.equals(other.runId) && this.attempt === other.attempt;
  }
}
