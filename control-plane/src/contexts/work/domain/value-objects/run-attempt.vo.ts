import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAttempt {
  private constructor(
    readonly runId: RunId,
    readonly number: number,
  ) {}

  static of(runId: RunId, number: number): RunAttempt {
    if (!Number.isInteger(number) || number < 1) {
      throw new InconsistentStateError('run', 'has no attempt to its name');
    }

    return new RunAttempt(runId, number);
  }

  equals(other: RunAttempt): boolean {
    return this.runId.equals(other.runId) && this.number === other.number;
  }
}
