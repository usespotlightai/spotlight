import { InvalidSearchIterationError } from '@work/domain/exceptions/invalid-search-iteration.error';

export class SearchIteration {
  private constructor(readonly value: number) {}

  static of(value: number): SearchIteration {
    if (!Number.isInteger(value) || value < 1) {
      throw new InvalidSearchIterationError(value);
    }

    return new SearchIteration(value);
  }

  equals(other: SearchIteration): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
