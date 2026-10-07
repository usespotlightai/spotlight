import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';

export interface Spend {
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

export class RunCost {
  private constructor(
    readonly ms: number | null,
    readonly steps: number,
    readonly faults: number,
    readonly changedLines: number,
    readonly used: number | null,
    readonly size: number | null,
    readonly spend: Spend | null,
    readonly tokens: TokenCounts,
  ) {}

  static of(input: {
    ms: number | null;
    steps: number;
    faults: number;
    changedLines: number;
    used: number | null;
    size: number | null;
    amount: number | null;
    currency: string | null;
    tokens: TokenCounts;
  }): RunCost {
    const { tokens, changedLines } = input;

    if (input.steps < 0 || input.faults < 0) {
      throw new InvalidOutcomeError('steps and faults cannot be negative');
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

    return new RunCost(
      input.ms,
      input.steps,
      input.faults,
      changedLines,
      input.used,
      input.size,
      input.amount !== null && input.currency
        ? { amount: input.amount, currency: input.currency }
        : null,
      tokens,
    );
  }
}
