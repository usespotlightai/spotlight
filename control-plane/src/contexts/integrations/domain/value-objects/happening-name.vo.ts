import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isDottedName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class HappeningName {
  private constructor(readonly value: string) {}

  static of(raw: string): HappeningName {
    const trimmed = raw.trim();

    if (!isDottedName(trimmed)) {
      throw new InvalidIdentifierError(
        'happening',
        'is its source and its name, as in github.pull_request.merged',
      );
    }

    return new HappeningName(trimmed);
  }

  get source(): string {
    return this.value.slice(0, this.value.indexOf('.'));
  }

  equals(other: HappeningName): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
