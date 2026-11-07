const CANCELLED = 'cancelled';

export type DispatchOutcome =
  | 'completed'
  | 'failed'
  | 'exhausted'
  | 'cancelled';

export interface DispatchEndingParts {
  readonly endedAt: Date;
  readonly outcome: DispatchOutcome;
  readonly failure: string | null;
  readonly stopped: boolean;
}

export class DispatchEnding implements DispatchEndingParts {
  private constructor(
    readonly endedAt: Date,
    readonly outcome: DispatchOutcome,
    readonly failure: string | null,
    readonly stopped: boolean,
  ) {}

  static of(parts: DispatchEndingParts): DispatchEnding {
    return new DispatchEnding(
      parts.endedAt,
      parts.outcome,
      parts.failure,
      parts.stopped,
    );
  }

  get failed(): boolean {
    return (
      this.outcome !== 'cancelled' &&
      this.failure !== null &&
      this.failure !== CANCELLED
    );
  }
}
