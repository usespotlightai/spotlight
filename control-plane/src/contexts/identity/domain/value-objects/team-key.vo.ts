import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
  slugify,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TeamKey {
  private readonly kind = 'team-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TeamKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'team key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in platform`,
      );
    }

    return new TeamKey(named);
  }

  static from(name: string): TeamKey {
    return TeamKey.of(slugify(name));
  }

  equals(other: TeamKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
