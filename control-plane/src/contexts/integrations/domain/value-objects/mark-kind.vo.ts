import { InvalidIdentifierError } from '@shared-kernel/domain/exceptions/invalid-identifier.error';
import { isDottedName } from '@shared-kernel/domain/value-objects/identifier-shapes';

export class MarkKind {
  private readonly of = 'mark-kind';

  private constructor(readonly value: string) {}

  static of(raw: string): MarkKind {
    const named = raw.trim();

    if (!isDottedName(named)) {
      throw new InvalidIdentifierError(
        'mark',
        'is its source and its name, as in git.pull-request',
      );
    }

    return new MarkKind(named);
  }

  equals(other: MarkKind): boolean {
    return this.of === other.of && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
