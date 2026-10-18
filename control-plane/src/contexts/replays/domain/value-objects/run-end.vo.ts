import type {
  ReplayEnding,
  RunResult,
} from '@replays/domain/value-objects/replay-ending';

export class RunEnd {
  private constructor(
    readonly result: RunResult,
    readonly failure: string | null,
    readonly stopped: boolean,
    readonly asked: boolean,
    readonly next: string | null,
    readonly at: Date,
  ) {}

  static of(input: {
    result: RunResult;
    failure: string | null;
    stopped: boolean;
    asked: boolean;
    next: string | null;
    at: Date;
  }): RunEnd {
    return new RunEnd(
      input.result,
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
    if (this.stopped || this.result === 'cancelled') {
      return 'stopped';
    }
    return this.result === 'completed' ? 'completed' : 'failed';
  }

  get isUsageRecorded(): boolean {
    return this.result !== 'cancelled';
  }

  equals(other: RunEnd): boolean {
    return (
      this.result === other.result &&
      this.failure === other.failure &&
      this.stopped === other.stopped &&
      this.asked === other.asked &&
      this.next === other.next &&
      this.at.getTime() === other.at.getTime()
    );
  }
}
