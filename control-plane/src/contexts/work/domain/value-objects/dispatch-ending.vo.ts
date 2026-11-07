import type { RunFailureCode } from '@shared-kernel/domain/value-objects/run-failure-code';

export type DispatchOutcome =
  | 'completed'
  | 'failed'
  | 'exhausted'
  | 'cancelled';

export interface DispatchEndingParts {
  readonly endedAt: Date;
  readonly outcome: DispatchOutcome;
  readonly failure: RunFailureCode | null;
  readonly stopped: boolean;
  readonly askedAPerson: boolean;
}

export class DispatchEnding implements DispatchEndingParts {
  private constructor(
    readonly endedAt: Date,
    readonly outcome: DispatchOutcome,
    readonly failure: RunFailureCode | null,
    readonly stopped: boolean,
    readonly askedAPerson: boolean,
  ) {}

  static of(parts: DispatchEndingParts): DispatchEnding {
    return new DispatchEnding(
      parts.endedAt,
      parts.outcome,
      parts.failure,
      parts.stopped,
      parts.askedAPerson,
    );
  }

  get failed(): boolean {
    return (
      this.outcome !== 'cancelled' &&
      this.failure !== null &&
      this.failure !== 'cancelled'
    );
  }

  equals(other: DispatchEnding): boolean {
    return (
      this.endedAt.getTime() === other.endedAt.getTime() &&
      this.outcome === other.outcome &&
      this.failure === other.failure &&
      this.stopped === other.stopped &&
      this.askedAPerson === other.askedAPerson
    );
  }
}
