import type { Happening } from '@domain/value-objects/happening.vo';
import type { StationId } from '@domain/value-objects/station-id.vo';

/**
 * A word that opens a task at a station, for work nobody here has one for
 * yet. Held beside the reactions that move standing tasks, not among them, so
 * the same word can open a task and later move it.
 */
export class Opener {
  private constructor(
    readonly happening: Happening,
    readonly to: StationId,
  ) {}

  static of(input: { happening: Happening; to: StationId }): Opener {
    return new Opener(input.happening, input.to);
  }

  equals(other: Opener): boolean {
    return this.happening.equals(other.happening) && this.to.equals(other.to);
  }
}
