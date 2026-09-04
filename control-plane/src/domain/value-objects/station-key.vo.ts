import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** A word a person types in a file and reads in a diff, so: lowercase, dashed. */
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a station is called in the file. Matched on when configuration is read
 * again, so an edited station is the same station and its tasks stay put.
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
