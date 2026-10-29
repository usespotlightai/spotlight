import { InvalidReplayCheckPolicyError } from '@work/domain/exceptions/invalid-replay-check-policy.error';
import { InvalidSpendCeilingError } from '@work/domain/exceptions/invalid-spend-ceiling.error';
import { SpendCeiling } from '@work/domain/value-objects/spend-ceiling.vo';

const spendOf = (ceiling: number, currency: string): SpendCeiling => {
  try {
    return SpendCeiling.of(ceiling, currency);
  } catch (error) {
    if (error instanceof InvalidSpendCeilingError) {
      throw new InvalidReplayCheckPolicyError(
        error.field === 'amount' ? 'ceiling' : 'currency',
        error.because,
      );
    }
    throw error;
  }
};

export class ReplayCheckPolicy {
  private constructor(
    readonly maxRegressions: number,
    readonly spend: SpendCeiling,
    readonly minGain: number,
  ) {}

  static of(input: {
    maxRegressions: number;
    ceiling: number;
    currency: string;
    minGain: number;
  }): ReplayCheckPolicy {
    const { maxRegressions, minGain } = input;

    if (!Number.isInteger(maxRegressions) || maxRegressions < 0) {
      throw new InvalidReplayCheckPolicyError(
        'maxRegressions',
        'must be a whole number from 0',
      );
    }

    const spend = spendOf(input.ceiling, input.currency);

    if (!Number.isFinite(minGain) || minGain <= 0 || minGain > 1) {
      throw new InvalidReplayCheckPolicyError(
        'minGain',
        'must be a share above 0 and at most 1',
      );
    }

    return new ReplayCheckPolicy(maxRegressions, spend, minGain);
  }

  get ceiling(): number {
    return this.spend.amount;
  }

  get currency(): string {
    return this.spend.currency;
  }
}
