import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  slugify,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class TeamKey {
  private readonly kind = 'team-key';

  private constructor(readonly value: string) {}

  static of(raw: string): TeamKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw InvalidIdentifierError.notSlug('team key', 'platform-team');
    }

    return new TeamKey(named);
  }

  static from(name: string): TeamKey {
    return TeamKey.of(slugify(name));
  }

  equals(other: TeamKey): boolean {
    return other instanceof TeamKey && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
