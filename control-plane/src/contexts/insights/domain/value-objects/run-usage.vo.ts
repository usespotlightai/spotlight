import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';

export interface Money {
  readonly amount: number;
  readonly currency: string;
}

export interface TokenCounts {
  readonly input: number | null;
  readonly output: number | null;
  readonly cacheRead: number | null;
  readonly cacheWrite: number | null;
}

const counted = (count: number | null): boolean =>
  count === null || (Number.isSafeInteger(count) && count >= 0);

export class RunUsage {
  private constructor(
    readonly ms: number | null,
    readonly steps: number,
    readonly errors: number,
    readonly changedLines: number,
    readonly contextTokens: number | null,
    readonly contextWindow: number | null,
    readonly spend: Money | null,
    readonly tokens: TokenCounts,
  ) {}

  static of(input: {
    ms: number | null;
    steps: number;
    errors: number;
    changedLines: number;
    contextTokens: number | null;
    contextWindow: number | null;
    amount: number | null;
    currency: string | null;
    tokens: TokenCounts;
  }): RunUsage {
    const { tokens, changedLines } = input;

    if (input.steps < 0 || input.errors < 0) {
      throw new InvalidOutcomeError('steps and errors cannot be negative');
    }
    if (!Number.isSafeInteger(changedLines) || changedLines < 0) {
      throw new InvalidOutcomeError('changed lines must be a whole number');
    }
    if (input.ms !== null && input.ms < 0) {
      throw new InvalidOutcomeError('duration cannot be negative');
    }
    if (input.amount !== null && !(input.amount >= 0)) {
      throw new InvalidOutcomeError('cost cannot be negative');
    }
    if (
      ![tokens.input, tokens.output, tokens.cacheRead, tokens.cacheWrite].every(
        counted,
      )
    ) {
      throw new InvalidOutcomeError('tokens must be whole numbers');
    }

    return new RunUsage(
      input.ms,
      input.steps,
      input.errors,
      changedLines,
      input.contextTokens,
      input.contextWindow,
      input.amount !== null && input.currency
        ? { amount: input.amount, currency: input.currency }
        : null,
      tokens,
    );
  }
}
