import { InvalidRemarkError } from '@work/domain/exceptions/invalid-remark.error';

export class Remark {
  private constructor(readonly value: string) {}

  static of(value: string): Remark {
    const named = value.trim();

    if (!named) {
      throw new InvalidRemarkError('must name where it was said');
    }

    return new Remark(named);
  }

  equals(other: Remark): boolean {
    return this.value === other.value;
  }
}
