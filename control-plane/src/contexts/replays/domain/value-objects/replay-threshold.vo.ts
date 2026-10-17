import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { Spend } from '@replays/domain/value-objects/spend.vo';

export class ReplayThreshold {
  private constructor(
    readonly maxRegressions: number,
    readonly ceiling: Spend,
    readonly minGain: number,
  ) {}

  static of(input: {
    maxRegressions: number;
    ceiling: number;
    currency: string;
    minGain: number;
  }): ReplayThreshold {
    if (!Number.isInteger(input.maxRegressions) || input.maxRegressions < 0) {
      throw new InvalidReplayCheckError(
        'allowed regressions must be a whole number from 0',
      );
    }
    if (
      !Number.isFinite(input.minGain) ||
      input.minGain <= 0 ||
      input.minGain > 1
    ) {
      throw new InvalidReplayCheckError(
        'success gain must be above 0 and at most 1',
      );
    }

    return new ReplayThreshold(
      input.maxRegressions,
      Spend.ceiling(input.ceiling, input.currency),
      input.minGain,
    );
  }

  equals(other: ReplayThreshold): boolean {
    return (
      this.maxRegressions === other.maxRegressions &&
      this.ceiling.equals(other.ceiling)
    );
  }

  unpricedRunIn(runs: number): Spend {
    return this.ceiling.scaled(1, Math.max(runs, 1));
  }

  allows(regressions: number): boolean {
    return regressions <= this.maxRegressions;
  }
}
