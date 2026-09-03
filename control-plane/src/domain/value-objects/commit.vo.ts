import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

/** What a host names a commit: hexadecimal, and never shorter than a prefix. */
const SHAPE = /^[0-9a-f]{7,64}$/;

/**
 * The commit a workspace's configuration was read at.
 *
 * Configuration is read at a commit rather than at a branch, so what was read
 * is a fact afterwards: the same commit read twice says the same thing, and a
 * branch that moved is a different reading rather than the same one changed.
 */
export class Commit {
  private readonly kind = 'commit';

  private constructor(readonly value: string) {}

  static of(raw: string): Commit {
    const named = raw.trim().toLowerCase();

    if (!SHAPE.test(named)) {
      throw new InvalidIdentifierError(
        'commit',
        'is the hexadecimal name a host gives one',
      );
    }

    return new Commit(named);
  }

  /** As it is shown to a person, who reads the first few and no more. */
  get short(): string {
    return this.value.slice(0, 7);
  }

  equals(other: Commit): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
