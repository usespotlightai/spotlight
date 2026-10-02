import { InvalidReplayCheckPolicyError } from '@work/domain/exceptions/invalid-replay-check-policy.error';

const MOST_CEILING = 1_000;
const CURRENCY = /^[A-Z]{3}$/;

export class ReplayCheckPolicy {
  private constructor(
    readonly mostRegressions: number,
    readonly ceiling: number,
    readonly currency: string,
  ) {}

  static of(input: {
    mostRegressions: number;
    ceiling: number;
    currency: string;
  }): ReplayCheckPolicy {
    const { mostRegressions, ceiling } = input;
    const currency = input.currency.trim().toUpperCase();

    if (!Number.isInteger(mostRegressions) || mostRegressions < 0) {
      throw new InvalidReplayCheckPolicyError(
        'mostRegressions',
        'is how many tasks a planned change may regress on and still pass, a whole number from 0',
      );
    }
    if (!Number.isFinite(ceiling) || ceiling <= 0 || ceiling > MOST_CEILING) {
      throw new InvalidReplayCheckPolicyError(
        'ceiling',
        `is the most one check’s replay may spend, above 0 and at most ${MOST_CEILING.toLocaleString('en-US')}`,
      );
    }
    if (!CURRENCY.test(currency)) {
      throw new InvalidReplayCheckPolicyError(
        'currency',
        'is the three-letter currency the ceiling is counted in, as in USD',
      );
    }

    return new ReplayCheckPolicy(mostRegressions, ceiling, currency);
  }
}
