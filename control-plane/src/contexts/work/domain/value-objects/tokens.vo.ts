import { InvalidTokensError } from '@work/domain/exceptions/invalid-tokens.error';

type Count = number | null;

interface Counts {
  readonly input?: Count;
  readonly output?: Count;
  readonly cacheRead?: Count;
  readonly cacheWrite?: Count;
}

const counted = (count: Count = null): Count => {
  if (count !== null && !(Number.isSafeInteger(count) && count >= 0)) {
    throw new InvalidTokensError(count);
  }

  return count;
};

const together = (one: Count, other: Count): Count =>
  one === null ? other : other === null ? one : one + other;

export class Tokens {
  private constructor(
    readonly input: Count,
    readonly output: Count,
    readonly cacheRead: Count,
    readonly cacheWrite: Count,
  ) {}

  static readonly UNREPORTED = new Tokens(null, null, null, null);

  static of(counts: Counts): Tokens {
    return new Tokens(
      counted(counts.input),
      counted(counts.output),
      counted(counts.cacheRead),
      counted(counts.cacheWrite),
    );
  }

  plus(other: Tokens): Tokens {
    return new Tokens(
      together(this.input, other.input),
      together(this.output, other.output),
      together(this.cacheRead, other.cacheRead),
      together(this.cacheWrite, other.cacheWrite),
    );
  }

  equals(other: Tokens): boolean {
    return (
      this.input === other.input &&
      this.output === other.output &&
      this.cacheRead === other.cacheRead &&
      this.cacheWrite === other.cacheWrite
    );
  }
}
