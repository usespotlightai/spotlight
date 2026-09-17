import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import {
  areWords,
  LONGEST_WORDS,
} from '@shared-kernel/domain/value-objects/identifier-shapes';

export class LineRole {
  private readonly kind = 'line-role';

  private constructor(readonly value: string) {}

  static readonly DELIVERY = new LineRole('delivery');

  static readonly IMPROVEMENT = new LineRole('improvement');

  static of(raw: string): LineRole {
    const named = raw.trim();

    if (!areWords(named)) {
      throw new InvalidIdentifierError(
        'line role',
        `is lowercase words joined by dashes, at most ${LONGEST_WORDS} characters, as in improvement`,
      );
    }

    return new LineRole(named);
  }

  equals(other: LineRole): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
