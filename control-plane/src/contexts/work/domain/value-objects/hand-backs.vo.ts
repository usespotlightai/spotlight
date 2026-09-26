import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';

const UNANSWERED = RunFailure.of('hooks-unanswered').retry;

export class HandBacks {
  private constructor(
    readonly count: number,
    readonly claimableFrom: Date | null,
  ) {}

  static none(): HandBacks {
    return new HandBacks(0, null);
  }

  static rehydrate(count: number, claimableFrom: Date | null): HandBacks {
    if (!Number.isInteger(count) || count < 0) {
      throw new InconsistentStateError(
        'run',
        `has been handed back an impossible number of times (${count})`,
      );
    }

    return new HandBacks(count, claimableFrom);
  }

  claimableAt(now: Date): boolean {
    return (
      this.claimableFrom === null ||
      this.claimableFrom.getTime() <= now.getTime()
    );
  }

  handedBackAt(now: Date): HandBacks {
    const count = this.count + 1;

    return new HandBacks(count, UNANSWERED.after(count, now) ?? now);
  }

  get exhausted(): boolean {
    return UNANSWERED.exhaustedAfter(this.count);
  }

  equals(other: HandBacks): boolean {
    return (
      this.count === other.count &&
      (this.claimableFrom?.getTime() ?? null) ===
        (other.claimableFrom?.getTime() ?? null)
    );
  }
}
