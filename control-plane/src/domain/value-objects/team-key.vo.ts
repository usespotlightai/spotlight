import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
  wordsFrom,
} from '@domain/value-objects/identifier-shapes';

export class TeamKey {
  private readonly kind = 'team-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TeamKey {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'team key',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in platform`,
      );
    }

    return new TeamKey(named);
  }

  static from(name: string): TeamKey {
    return TeamKey.of(wordsFrom(name));
  }

  equals(other: TeamKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
