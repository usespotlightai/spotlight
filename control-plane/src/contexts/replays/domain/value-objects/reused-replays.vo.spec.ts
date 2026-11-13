import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReusedReplays } from '@replays/domain/value-objects/reused-replays.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SEED = ReplayId.of('replay_seed');
const FIRST = RunId.of('run_1');
const SECOND = RunId.of('run_2');

const part = (id: string, ...runs: RunId[]) => ({
  replayId: ReplayId.of(id),
  runs,
});

describe('ReusedReplays', () => {
  it('names each reused replay once, for its own runs, apart from the seed', () => {
    expect(() => ReusedReplays.of({ seed: SEED, parts: [] })).toThrow(
      InvalidReplayCheckError,
    );
    expect(() =>
      ReusedReplays.of({ seed: SEED, parts: [part('replay_a')] }),
    ).toThrow(InvalidReplayCheckError);
    expect(() =>
      ReusedReplays.of({
        seed: SEED,
        parts: [part('replay_a', FIRST), part('replay_a', SECOND)],
      }),
    ).toThrow(InvalidReplayCheckError);
    expect(() =>
      ReusedReplays.of({ seed: SEED, parts: [part('replay_seed', FIRST)] }),
    ).toThrow(InvalidReplayCheckError);
    expect(() =>
      ReusedReplays.of({
        seed: SEED,
        parts: [part('replay_a', FIRST), part('replay_b', FIRST)],
      }),
    ).toThrow(InvalidReplayCheckError);
  });

  it('equals the same seed and parts in any order', () => {
    const one = ReusedReplays.of({
      seed: SEED,
      parts: [part('replay_a', FIRST), part('replay_b', SECOND)],
    });
    const other = ReusedReplays.of({
      seed: SEED,
      parts: [part('replay_b', SECOND), part('replay_a', FIRST)],
    });

    expect(one.equals(other)).toBe(true);
    expect(one.coversAll([FIRST, SECOND])).toBe(true);
    expect(
      one.equals(
        ReusedReplays.of({ seed: SEED, parts: [part('replay_a', FIRST)] }),
      ),
    ).toBe(false);
  });
});
