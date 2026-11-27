import type { StationHashes } from '@replays/domain/value-objects/station-hashes.vo';

export class CheckedChange {
  private readonly kind = 'checked-change';

  private constructor(readonly value: string) {}

  static of(candidate: StationHashes, live: StationHashes): CheckedChange {
    return new CheckedChange(`${candidate.behaviour}:${live.scoring}`);
  }

  equals(other: CheckedChange): boolean {
    return other instanceof CheckedChange && this.value === other.value;
  }
}
