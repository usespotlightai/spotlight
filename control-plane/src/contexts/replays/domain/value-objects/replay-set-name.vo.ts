import { InvalidReplaySetError } from '@replays/domain/exceptions/invalid-replay-set.error';

const MAX_LENGTH = 100;

export class ReplaySetName {
  private constructor(readonly value: string) {}

  static of(raw: string): ReplaySetName {
    const named = raw.trim();

    if (named.length === 0 || named.length > MAX_LENGTH) {
      throw new InvalidReplaySetError(
        `name must be 1 to ${MAX_LENGTH} characters`,
      );
    }

    return new ReplaySetName(named);
  }

  equals(other: ReplaySetName): boolean {
    return this.value === other.value;
  }
}
