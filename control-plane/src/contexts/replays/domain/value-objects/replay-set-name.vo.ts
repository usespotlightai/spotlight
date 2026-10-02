import { InvalidReplaySetError } from '@replays/domain/exceptions/invalid-replay-set.error';

const MOST_LENGTH = 100;

export class ReplaySetName {
  private constructor(readonly value: string) {}

  static of(raw: string): ReplaySetName {
    const named = raw.trim();

    if (named.length === 0 || named.length > MOST_LENGTH) {
      throw new InvalidReplaySetError(
        `is named in 1 to ${MOST_LENGTH} characters`,
      );
    }

    return new ReplaySetName(named);
  }

  equals(other: ReplaySetName): boolean {
    return this.value === other.value;
  }
}
