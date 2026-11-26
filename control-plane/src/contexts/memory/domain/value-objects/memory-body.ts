import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MAX_BODY = 1_000;

const COMMON_WORDS = new Set([
  'and',
  'are',
  'because',
  'but',
  'for',
  'from',
  'has',
  'have',
  'into',
  'its',
  'not',
  'that',
  'the',
  'then',
  'this',
  'use',
  'was',
  'when',
  'with',
]);

const wordsOf = (text: string): ReadonlySet<string> =>
  new Set(
    text
      .toLowerCase()
      .split(/[^\p{L}\p{N}]+/u)
      .filter((each) => each.length > 2 && !COMMON_WORDS.has(each)),
  );

export class MemoryBody {
  private readonly kind = 'memory-body';

  private constructor(readonly value: string) {}

  static of(raw: string): MemoryBody {
    const body = raw.trim();

    if (!body || body.length > MAX_BODY) {
      throw new InvalidMemoryError(`must be at most ${MAX_BODY} characters`);
    }

    return new MemoryBody(body);
  }

  get length(): number {
    return this.value.length;
  }

  similarity(other: MemoryBody): number {
    const mine = wordsOf(this.value);
    const theirs = wordsOf(other.value);

    if (mine.size === 0 || theirs.size === 0) {
      return 0;
    }

    const shared = [...mine].filter((each) => theirs.has(each)).length;

    return (2 * shared) / (mine.size + theirs.size);
  }

  equals(other: MemoryBody): boolean {
    return this.kind === other.kind && this.value === other.value;
  }

  toString(): string {
    return this.value;
  }
}
