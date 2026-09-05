import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** A word a person types in a URL and reads in a path: lowercase, dashed. */
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a team is called in a webhook address, which is no place for a
 * generated id.
 */
export class TeamKey {
  private readonly kind = 'team-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TeamKey {
    const named = raw.trim();

    if (!SHAPE.test(named) || named.length > LONGEST) {
      throw new InvalidIdentifierError(
        'team key',
        `is lowercase words joined by dashes, at most ${LONGEST} characters, as in platform`,
      );
    }

    return new TeamKey(named);
  }

  static from(name: string): TeamKey {
    return TeamKey.of(
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, LONGEST)
        .replace(/-+$/g, ''),
    );
  }

  equals(other: TeamKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
