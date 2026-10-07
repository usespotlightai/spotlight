import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import type { Spend } from '@replays/domain/value-objects/spend.vo';

type Count = number | null;

export interface TokenCounts {
  readonly input: Count;
  readonly output: Count;
  readonly cacheRead: Count;
  readonly cacheWrite: Count;
}

const counted = (count: Count): boolean =>
  count === null || (Number.isSafeInteger(count) && count >= 0);

export class EntryMeasures {
  private constructor(
    readonly ms: number | null,
    readonly steps: number,
    readonly changedLines: number | null,
    readonly cost: Spend | null,
    readonly tokens: TokenCounts,
  ) {}

  static of(input: {
    ms: number | null;
    steps: number;
    changedLines: number | null;
    cost: Spend | null;
    tokens: TokenCounts;
  }): EntryMeasures {
    if (input.ms !== null && !(Number.isFinite(input.ms) && input.ms >= 0)) {
      throw new InvalidReplayError('run duration cannot be negative');
    }
    if (!Number.isSafeInteger(input.steps) || input.steps < 0) {
      throw new InvalidReplayError('run steps must be a whole number');
    }
    if (input.changedLines !== null && !counted(input.changedLines)) {
      throw new InvalidReplayError('run changed lines must be a whole number');
    }
    if (
      ![
        input.tokens.input,
        input.tokens.output,
        input.tokens.cacheRead,
        input.tokens.cacheWrite,
      ].every(counted)
    ) {
      throw new InvalidReplayError('run tokens must be whole numbers');
    }

    return new EntryMeasures(
      input.ms,
      input.steps,
      input.changedLines,
      input.cost,
      input.tokens,
    );
  }

  equals(other: EntryMeasures): boolean {
    return (
      this.ms === other.ms &&
      this.steps === other.steps &&
      this.changedLines === other.changedLines &&
      (this.cost === null
        ? other.cost === null
        : other.cost !== null && this.cost.equals(other.cost)) &&
      this.tokens.input === other.tokens.input &&
      this.tokens.output === other.tokens.output &&
      this.tokens.cacheRead === other.tokens.cacheRead &&
      this.tokens.cacheWrite === other.tokens.cacheWrite
    );
  }
}
