import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** A word a person types in a URL and reads in a path: lowercase, dashed. */
const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a team is called where a person has to write it down: the directory
 * its configuration sits in, and the door its hosts knock at.
 *
 * A team already has an identifier nobody typed. This is the other one, and
 * it is the only one that appears in a repository or in a webhook address,
 * because neither is a place to put a generated id.
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

  /** What a team written without one would be called, from its name. */
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
