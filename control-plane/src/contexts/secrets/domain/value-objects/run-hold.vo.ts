import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunHold {
  private constructor(
    readonly runId: RunId,
    readonly attempt: number,
  ) {}

  static of(runId: RunId, attempt: number): RunHold {
    if (!Number.isInteger(attempt) || attempt < 1) {
      throw new InconsistentStateError(
        'run hold',
        `names an impossible attempt (${attempt})`,
      );
    }

    return new RunHold(runId, attempt);
  }

  equals(other: RunHold): boolean {
    return this.runId.equals(other.runId) && this.attempt === other.attempt;
  }

  isOfRun(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  precedes(other: RunHold): boolean {
    return this.attempt < other.attempt;
  }
}
