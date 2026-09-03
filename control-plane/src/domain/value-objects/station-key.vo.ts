import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** A word a person types in a file and reads in a diff, so: lowercase, dashed. */
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a station is called in the file that describes it, and what it stays
 * called however it is renamed or moved.
 *
 * Every task stands at a station by an identifier nobody writes down. This is
 * the other end of that: the name in the file, matched on when configuration
 * is read again, so a station that was edited is the same station and the
 * tasks standing at it are not stranded.
 */
export class StationKey {
  private readonly kind = 'station-key';

  private constructor(readonly value: string) {}

  static of(raw: string): StationKey {
    const named = raw.trim();

    if (!SHAPE.test(named) || named.length > LONGEST) {
      throw new InvalidIdentifierError(
        'station key',
        `is lowercase words joined by dashes, at most ${LONGEST} characters, as in code-review`,
      );
    }

    return new StationKey(named);
  }

  /** What a station written without one would be called, from its name. */
  static from(name: string): StationKey {
    const slugged = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, LONGEST)
      .replace(/-+$/g, '');

    return StationKey.of(slugged);
  }

  equals(other: StationKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
