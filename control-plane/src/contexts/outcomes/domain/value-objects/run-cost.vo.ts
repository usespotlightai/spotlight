import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';

export interface Spend {
  readonly amount: number;
  readonly currency: string;
}

export class RunCost {
  private constructor(
    readonly ms: number | null,
    readonly steps: number,
    readonly faults: number,
    readonly used: number | null,
    readonly spend: Spend | null,
  ) {}

  static of(input: {
    ms: number | null;
    steps: number;
    faults: number;
    used: number | null;
    amount: number | null;
    currency: string | null;
  }): RunCost {
    if (input.steps < 0 || input.faults < 0) {
      throw new InvalidOutcomeError('counts no fewer than no steps or faults');
    }
    if (input.ms !== null && input.ms < 0) {
      throw new InvalidOutcomeError('takes no less than no time');
    }

    return new RunCost(
      input.ms,
      input.steps,
      input.faults,
      input.used,
      input.amount !== null && input.currency
        ? { amount: input.amount, currency: input.currency }
        : null,
    );
  }
}
