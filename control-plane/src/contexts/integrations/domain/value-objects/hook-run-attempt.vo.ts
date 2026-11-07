import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class HookRunAttempt {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
  ) {}

  static of(runId: RunId, attempt: number): HookRunAttempt {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new InconsistentStateError(
        'hook run attempt',
        `names attempt ${attempt} of run ${runId.value}`,
      );
    }

    return new HookRunAttempt(runId, attempt);
  }

  equals(other: HookRunAttempt): boolean {
    return this.runId.equals(other.runId) && this.attempt === other.attempt;
  }
}
