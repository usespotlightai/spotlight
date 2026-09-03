import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a line is called in the file that describes it. One file, one line,
 * and this is which: the file may be renamed without the line becoming a
 * different one, and the line may be renamed without its stations moving.
 */
export class LineKey {
  private readonly kind = 'line-key';

  private constructor(readonly value: string) {}

  static of(raw: string): LineKey {
    const named = raw.trim();

    if (!SHAPE.test(named) || named.length > LONGEST) {
      throw new InvalidIdentifierError(
        'line key',
        `is lowercase words joined by dashes, at most ${LONGEST} characters, as in default`,
      );
    }

    return new LineKey(named);
  }

  static from(name: string): LineKey {
    return LineKey.of(
      name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, LONGEST)
        .replace(/-+$/g, ''),
    );
  }

  equals(other: LineKey): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
