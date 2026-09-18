import type { Happening } from '@work/domain/value-objects/happening.vo';
import type { StationId } from '@work/domain/value-objects/station-id.vo';

export class Reaction {
  private constructor(
    readonly happening: Happening,
    readonly from: StationId | null,
    readonly to: StationId,
  ) {}

  static of(input: {
    happening: Happening;
    from?: StationId | null;
    to: StationId;
  }): Reaction {
    return new Reaction(input.happening, input.from ?? null, input.to);
  }

  appliesAt(stationId: StationId): boolean {
    return this.from === null || this.from.equals(stationId);
  }

  get isEverywhere(): boolean {
    return this.from === null;
  }

  equals(other: Reaction): boolean {
    return (
      this.happening.equals(other.happening) &&
      this.to.equals(other.to) &&
      (this.from === null
        ? other.from === null
        : other.from !== null && this.from.equals(other.from))
    );
  }
}
