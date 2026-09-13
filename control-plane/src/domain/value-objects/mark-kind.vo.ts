import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+(\.[a-z0-9][a-z0-9_-]*)+$/;

export class MarkKind {
  private readonly of = 'mark-kind';

  private constructor(readonly value: string) {}

  static of(raw: string): MarkKind {
    const named = raw.trim();

    if (!SHAPE.test(named)) {
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
