import { InvalidReplayCheckPolicyError } from '@lines/domain/exceptions/invalid-replay-check-policy.error';
import { InvalidSpendCeilingError } from '@lines/domain/exceptions/invalid-spend-ceiling.error';
import { SpendCeiling } from '@lines/domain/value-objects/spend-ceiling.vo';

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

interface ReplayCheckSettings {
  readonly maxRegressions: number;
  readonly ceiling: number;
  readonly currency: string;
  readonly minGain: number;
}

const BY_DEFAULT: ReplayCheckSettings = {
  maxRegressions: 0,
  ceiling: 10,
  currency: 'USD',
  minGain: 0.05,
};

export class ReplayCheckPolicy {
  private constructor(
    readonly maxRegressions: number,
    readonly spend: SpendCeiling,
    readonly minGain: number,
  ) {}

  static withDefaults(
    written: Partial<ReplayCheckSettings>,
  ): ReplayCheckPolicy {
    return ReplayCheckPolicy.of({
      maxRegressions: written.maxRegressions ?? BY_DEFAULT.maxRegressions,
      ceiling: written.ceiling ?? BY_DEFAULT.ceiling,
      currency: written.currency ?? BY_DEFAULT.currency,
      minGain: written.minGain ?? BY_DEFAULT.minGain,
    });
  }

  static of(input: ReplayCheckSettings): ReplayCheckPolicy {
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
