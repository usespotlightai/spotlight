import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  isSlug,
  MAX_SLUG_LENGTH,
} from '@shared-kernel/domain/value-objects/identifier-shapes';
import { DONE, REVIEW } from '@work/domain/value-objects/handover-word';

const RESERVED: ReadonlyMap<string, string> = new Map([
  [REVIEW, 'hand its task over to a person'],
  [DONE, 'finish its task'],
]);

export class StationKey {
  private readonly kind = 'station-key';

  private constructor(readonly value: string) {}

  static of(raw: string): StationKey {
    const named = raw.trim();

    if (!isSlug(named)) {
      throw new InvalidIdentifierError(
        'station key',
        `must be lowercase words joined by dashes, at most ${MAX_SLUG_LENGTH} characters, as in code-review`,
      );
    }

    const reserved = RESERVED.get(named);

    if (reserved) {
      throw new InvalidIdentifierError(
        'station key',
        `cannot be ${named}. A run names ${named} in its handover to ${reserved}`,
      );
    }

    return new StationKey(named);
  }

  static parsed(raw: string): StationKey | null {
    try {
      return StationKey.of(raw);
    } catch (error) {
      if (error instanceof InvalidIdentifierError) {
        return null;
      }
      throw error;
    }
  }

  equals(other: StationKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
