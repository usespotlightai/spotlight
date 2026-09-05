import type { Happening } from '@domain/value-objects/happening.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

/**
 * What a line does when a word comes in from outside about a task it already
 * has: which word, where the task has to be standing for it to count, and
 * where it goes.
 *
 * Held by the line rather than by a station, because where a word takes a
 * task can depend on where the task already is. A comment at code review is
 * an answer; the same comment at spec is a question to go back to.
 */
export class Reaction {
  private constructor(
    readonly happening: Happening,
    /** Where the task must stand for this to apply. Null is wherever it is. */
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

  /** True where this is a rule about a task standing at that station. */
  appliesAt(stationId: StationId): boolean {
    return this.from === null || this.from.equals(stationId);
  }

  /** Told apart from a rule that applies wherever the task stands. */
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
