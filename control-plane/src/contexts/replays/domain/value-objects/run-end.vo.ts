import type {
  ReplayEnding,
  RunOutcome,
} from '@replays/domain/value-objects/replay-ending';

export class RunEnd {
  private constructor(
    readonly outcome: RunOutcome,
    readonly failure: string | null,
    readonly stopped: boolean,
    readonly asked: boolean,
    readonly next: string | null,
    readonly at: Date,
  ) {}

  static of(input: {
    outcome: RunOutcome;
    failure: string | null;
    stopped: boolean;
    asked: boolean;
    next: string | null;
    at: Date;
  }): RunEnd {
    return new RunEnd(
      input.outcome,
      input.failure,
      input.stopped,
      input.asked,
      input.next,
      input.at,
    );
  }

  get ending(): ReplayEnding {
    if (this.asked) {
      return 'asked';
    }
    if (this.stopped || this.outcome === 'cancelled') {
      return 'stopped';
    }
    return this.outcome === 'completed' ? 'completed' : 'failed';
  }

  get isDigested(): boolean {
    return this.outcome !== 'cancelled';
  }

  equals(other: RunEnd): boolean {
    return (
      this.outcome === other.outcome &&
      this.failure === other.failure &&
      this.stopped === other.stopped &&
      this.asked === other.asked &&
      this.next === other.next &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
