import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export interface ReusedPart {
  readonly replayId: ReplayId;
  readonly runs: readonly RunId[];
}

export class ReusedReplays {
  private constructor(
    readonly seed: ReplayId,
    readonly parts: readonly ReusedPart[],
  ) {}

  static of(input: {
    seed: ReplayId;
    parts: readonly ReusedPart[];
  }): ReusedReplays {
    const replays = input.parts.map((each) => each.replayId.value);
    const runs = input.parts.flatMap((each) =>
      each.runs.map((run) => run.value),
    );

    if (input.parts.length === 0) {
      throw new InvalidReplayCheckError('must reuse at least one replay');
    }
    if (input.parts.some((each) => each.runs.length === 0)) {
      throw new InvalidReplayCheckError('must reuse each replay for a run');
    }
    if (new Set(replays).size !== replays.length) {
      throw new InvalidReplayCheckError('must name each reused replay once');
    }
    if (replays.includes(input.seed.value)) {
      throw new InvalidReplayCheckError(
        'must not reuse the seed as a replay of the change',
      );
    }
    if (new Set(runs).size !== runs.length) {
      throw new InvalidReplayCheckError('reuses each run from one replay only');
    }

    return new ReusedReplays(
      input.seed,
      input.parts.map((each) => ({
        replayId: each.replayId,
        runs: [...each.runs],
      })),
    );
  }

  get runs(): readonly RunId[] {
    return this.parts.flatMap((each) => each.runs);
  }

  covers(run: RunId): boolean {
    return this.runs.some((each) => each.equals(run));
  }

  coversAll(runs: readonly RunId[]): boolean {
    return runs.every((run) => this.covers(run));
  }

  within(runs: readonly RunId[]): boolean {
    return this.runs.every((run) => runs.some((each) => each.equals(run)));
  }

  equals(other: ReusedReplays): boolean {
    const key = (reused: ReusedReplays): string =>
      JSON.stringify([
        reused.seed.value,
        ...reused.parts
          .map((each) => [
            each.replayId.value,
            ...each.runs.map((run) => run.value).sort(),
          ])
          .sort((one, two) => (one[0] ?? '').localeCompare(two[0] ?? '')),
      ]);

    return key(this) === key(other);
  }
}
