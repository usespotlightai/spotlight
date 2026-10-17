import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class Opening {
  private constructor(
    readonly onto: string,
    readonly at: string | null,
  ) {}

  static of(input: { onto: string; at?: string | null }): Opening {
    const onto = input.onto.trim();
    const at = input.at?.trim() || null;

    if (!isSlug(onto)) {
      throw new InvalidIdentifierError(
        'line role',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in delivery`,
      );
    }

    if (at !== null && !isSlug(at)) {
      throw new InvalidIdentifierError(
        'station key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in code-review`,
      );
    }

    return new Opening(onto, at);
  }
}
