import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class Opening {
  private constructor(
    readonly lineRole: string,
    readonly station: string | null,
  ) {}

  static of(input: { lineRole: string; station?: string | null }): Opening {
    const lineRole = input.lineRole.trim();
    const station = input.station?.trim() || null;

    if (!isSlug(lineRole)) {
      throw new InvalidIdentifierError(
        'line role',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in delivery`,
      );
    }

    if (station !== null && !isSlug(station)) {
      throw new InvalidIdentifierError(
        'station key',
        `is lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in code-review`,
      );
    }

    return new Opening(lineRole, station);
  }
}
