import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const MOST_HAND_BACKS = 6;

const FIRST_BACKOFF_MS = 5_000;

const LONGEST_BACKOFF_MS = 120_000;

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
    const backoff = Math.min(
      FIRST_BACKOFF_MS * 2 ** (count - 1),
      LONGEST_BACKOFF_MS,
    );

    return new HandBacks(count, new Date(now.getTime() + backoff));
  }

  get exhausted(): boolean {
    return this.count >= MOST_HAND_BACKS;
  }

  equals(other: HandBacks): boolean {
    return (
      this.count === other.count &&
      (this.claimableFrom?.getTime() ?? null) ===
        (other.claimableFrom?.getTime() ?? null)
    );
  }
}
