import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MOST_WORDS = 500;

export class RecallWords {
  private readonly kind = 'recall-words';

  private constructor(readonly value: string) {}

  static of(raw: string): RecallWords {
    const words = raw.trim();

    if (!words || words.length > MOST_WORDS) {
      throw new InvalidMemoryError(
        `is recalled by at most ${MOST_WORDS} characters of words it holds, or by its handle, like M-12`,
      );
    }

    return new RecallWords(words);
  }

  equals(other: RecallWords): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
