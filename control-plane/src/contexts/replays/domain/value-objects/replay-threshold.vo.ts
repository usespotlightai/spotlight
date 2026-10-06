import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { Spend } from '@replays/domain/value-objects/spend.vo';

export class ReplayThreshold {
  private constructor(
    readonly mostRegressions: number,
    readonly ceiling: Spend,
    readonly minGain: number,
  ) {}

  static of(input: {
    mostRegressions: number;
    ceiling: number;
    currency: string;
    minGain: number;
  }): ReplayThreshold {
    if (!Number.isInteger(input.mostRegressions) || input.mostRegressions < 0) {
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
      input.mostRegressions,
      Spend.ceiling(input.ceiling, input.currency),
      input.minGain,
    );
  }

  equals(other: ReplayThreshold): boolean {
    return (
      this.mostRegressions === other.mostRegressions &&
      this.ceiling.equals(other.ceiling)
    );
  }

  unpricedRunIn(runs: number): Spend {
    return this.ceiling.scaled(1, Math.max(runs, 1));
  }

  allows(regressions: number): boolean {
    return regressions <= this.mostRegressions;
  }
}
