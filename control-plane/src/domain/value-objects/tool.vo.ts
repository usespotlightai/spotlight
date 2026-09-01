import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * Something a run may reach for beyond the words that end it. A station says
 * which of these it has, and a run is told about those and no others: an
 * agent reaches for what it was told about, and nothing else answers.
 */
export class Tool {
  private constructor(readonly value: string) {}

  static of(raw: string): Tool {
    const trimmed = raw.trim();

    if (!SHAPE.test(trimmed)) {
      throw new InvalidIdentifierError(
        'tool',
        'is lower case words joined by dashes, as in pull-request',
      );
    }

    return new Tool(trimmed);
  }

  equals(other: Tool): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
