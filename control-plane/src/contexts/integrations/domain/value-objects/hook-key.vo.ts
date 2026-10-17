import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class HookKey {
  private constructor(readonly value: string) {}

  static of(raw: string): HookKey {
    const trimmed = raw.trim();

    if (!isSlug(trimmed)) {
      throw new InvalidIdentifierError(
        'hook',
        `is lower case words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in migrations-need-a-dba`,
      );
    }

    return new HookKey(trimmed);
  }

  equals(other: HookKey): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
