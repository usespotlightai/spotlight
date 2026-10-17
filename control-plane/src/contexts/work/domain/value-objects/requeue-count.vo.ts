import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunFailure } from '@work/domain/value-objects/run-failure.vo';

const UNANSWERED = RunFailure.of('hooks-unanswered').retry;

export class RequeueCount {
  private constructor(
    readonly count: number,
    readonly claimableFrom: Date | null,
  ) {}

  static none(): RequeueCount {
    return new RequeueCount(0, null);
  }

  static rehydrate(count: number, claimableFrom: Date | null): RequeueCount {
    if (!Number.isInteger(count) || count < 0) {
      throw new InconsistentStateError(
        'run',
        `has been requeued an impossible number of times (${count})`,
      );
    }

    return new RequeueCount(count, claimableFrom);
  }

  claimableAt(now: Date): boolean {
    return (
      this.claimableFrom === null ||
      this.claimableFrom.getTime() <= now.getTime()
    );
  }

  requeuedAt(now: Date): RequeueCount {
    const count = this.count + 1;

    return new RequeueCount(count, UNANSWERED.after(count, now) ?? now);
  }

  get exhausted(): boolean {
    return UNANSWERED.exhaustedAfter(this.count);
  }

  equals(other: RequeueCount): boolean {
    return (
      this.count === other.count &&
      (this.claimableFrom?.getTime() ?? null) ===
        (other.claimableFrom?.getTime() ?? null)
    );
  }
}
