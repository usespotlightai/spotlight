import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAttemptRef {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
  ) {}

  static of(runId: RunId, attempt: number): RunAttemptRef {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new InconsistentStateError(
        'run attempt',
        `names attempt ${attempt} of run ${runId.value}`,
      );
    }

    return new RunAttemptRef(runId, attempt);
  }

  equals(other: RunAttemptRef): boolean {
    return this.runId.equals(other.runId) && this.attempt === other.attempt;
  }
}
