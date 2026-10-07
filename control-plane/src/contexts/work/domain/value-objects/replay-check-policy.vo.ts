import { InvalidReplayCheckPolicyError } from '@work/domain/exceptions/invalid-replay-check-policy.error';

const MOST_CEILING = 1_000;
const CURRENCY = /^[A-Z]{3}$/;

export class ReplayCheckPolicy {
  private constructor(
    readonly mostRegressions: number,
    readonly ceiling: number,
    readonly currency: string,
    readonly minGain: number,
  ) {}

  static of(input: {
    mostRegressions: number;
    ceiling: number;
    currency: string;
    minGain: number;
  }): ReplayCheckPolicy {
    const { mostRegressions, ceiling, minGain } = input;
    const currency = input.currency.trim().toUpperCase();

    if (!Number.isInteger(mostRegressions) || mostRegressions < 0) {
      throw new InvalidReplayCheckPolicyError(
        'mostRegressions',
        'must be a whole number from 0',
      );
    }
    if (!Number.isFinite(ceiling) || ceiling <= 0 || ceiling > MOST_CEILING) {
      throw new InvalidReplayCheckPolicyError(
        'ceiling',
        `must be above 0 and at most ${MOST_CEILING.toLocaleString('en-US')}`,
      );
    }
    if (!CURRENCY.test(currency)) {
      throw new InvalidReplayCheckPolicyError(
        'currency',
        'must be a three-letter currency code, as in USD',
      );
    }

    if (!Number.isFinite(minGain) || minGain <= 0 || minGain > 1) {
      throw new InvalidReplayCheckPolicyError(
        'minGain',
        'must be a share above 0 and at most 1',
      );
    }

    return new ReplayCheckPolicy(mostRegressions, ceiling, currency, minGain);
  }
}
