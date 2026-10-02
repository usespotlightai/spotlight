import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { Spend } from '@replays/domain/value-objects/spend.vo';

export class ReplayThreshold {
  private constructor(
    readonly mostRegressions: number,
    readonly ceiling: Spend,
  ) {}

  static of(input: {
    mostRegressions: number;
    ceiling: number;
    currency: string;
  }): ReplayThreshold {
    if (!Number.isInteger(input.mostRegressions) || input.mostRegressions < 0) {
      throw new InvalidReplayCheckError(
        'lets a planned change regress on a whole number of tasks, from 0',
      );
    }

    return new ReplayThreshold(
      input.mostRegressions,
      Spend.ceiling(input.ceiling, input.currency),
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
