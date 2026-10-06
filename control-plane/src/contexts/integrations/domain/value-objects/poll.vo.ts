import { InvalidIntegrationPartError } from '@integrations/domain/exceptions/invalid-integration-part.error';
import type { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';

export class Poll {
  private constructor(
    readonly every: number,
    readonly declares: readonly DeclaredHappening[],
  ) {}

  static of(input: {
    every: number;
    declares: readonly DeclaredHappening[];
  }): Poll {
    if (!Number.isInteger(input.every) || input.every < 0) {
      throw new InvalidIntegrationPartError(
        'poll interval',
        'must be a whole number of seconds, as in 60s',
      );
    }

    if (input.declares.length === 0) {
      throw new InvalidIntegrationPartError('poll', 'raises no events');
    }

    return new Poll(input.every, input.declares);
  }

  isDue(lastRan: Date | null, now: Date): boolean {
    return (
      lastRan === null || now.getTime() - lastRan.getTime() >= this.every * 1000
    );
  }
}
