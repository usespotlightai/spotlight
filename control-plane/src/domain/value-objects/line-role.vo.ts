import { InvalidIdentifierError } from '@domain/exceptions/invalid-identifier.error';

const SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const LONGEST = 64;

/**
 * What a line is for, beyond the work it happens to hold. Most lines need none:
 * a role is how the factory finds the one line a job belongs to, such as the
 * line an analysis of a trace is opened on.
 */
export class LineRole {
  private readonly kind = 'line-role';

  private constructor(readonly value: string) {}

  /** The line a team delivers its product on, where outside work is opened. */
  static readonly DELIVERY = new LineRole('delivery');

  /** The line that improves the factory itself, where a trace is analysed. */
  static readonly IMPROVEMENT = new LineRole('improvement');

  static of(raw: string): LineRole {
    const named = raw.trim();

    if (!SHAPE.test(named) || named.length > LONGEST) {
      throw new InvalidIdentifierError(
        'line role',
        `is lowercase words joined by dashes, at most ${LONGEST} characters, as in improvement`,
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
