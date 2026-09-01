import { InvalidRemarkError } from '@domain/exceptions/invalid-remark.error';

/**
 * What the host calls something said on a pull request. Opaque here: it is
 * handed back to the host to answer, never read.
 */
export class Remark {
  private constructor(readonly value: string) {}

  static of(value: string): Remark {
    const named = value.trim();

    if (!named) {
      throw new InvalidRemarkError('was said somewhere with no name');
    }

    return new Remark(named);
  }

  equals(other: Remark): boolean {
    return this.value === other.value;
  }
}
