import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aSet,
  HASHES,
  LIVE_HASHES,
  replayedAs,
  replayFor,
  SEARCH_ID,
} from '@replays/domain/replays.fake-spec';
import { reusedOf } from '@replays/domain/services/reused-replays';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(3);
const [FIRST, SECOND, THIRD] = SET.runs as [RunId, RunId, RunId];

const seed = (id = 'replay_seed', repeats = 3) =>
  replayedAs(
    replayFor(SET, id, 'candidate_live', null, true, repeats),
    () => 'completed',
  );

const CONFIGS = new Map([
  ['candidate_live', LIVE_HASHES],
  ['candidate_searched', HASHES],
]);

const of = (replays: readonly Replay[], repeats = 1) =>
  reusedOf({
    runs: SET.runs,
    repeats,
    candidate: HASHES,
    live: LIVE_HASHES,
    replays,
    configs: CONFIGS,
  });

const searchedOn = (
  id: string,
  runs: readonly RunId[],
  against = 'replay_seed',
  repeats = 1,
) =>
  replayedAs(
    replayFor(
      SET,
      id,
      'candidate_searched',
      runs,
      false,
      repeats,
      SEARCH_ID,
      against,
    ),
    () => 'completed',
  );

const runsOf = (reused: ReturnType<typeof reusedOf>) =>
  reused?.parts.map((each) => [
    each.replayId.value,
    each.runs.map((run) => run.value),
  ]);

describe('reusedOf', () => {
  it('takes each run from a finished replay compared against a whole-set seed', () => {
    const reused = of([
      searchedOn('replay_searched', [FIRST, SECOND]),
      searchedOn('replay_held_out', [THIRD]),
      seed(),
    ]);

    expect(reused?.seed.value).toBe('replay_seed');
    expect(runsOf(reused)).toEqual([
      ['replay_searched', [FIRST.value, SECOND.value]],
      ['replay_held_out', [THIRD.value]],
    ]);
  });

  it('reuses nothing replayed at other repeats, still running, or against no seed it knows', () => {
    const running = replayFor(
      SET,
      'replay_running',
      'candidate_searched',
      [FIRST],
      false,
      1,
      SEARCH_ID,
      'replay_seed',
    );

    expect(
      of([
        running,
        searchedOn('replay_twice', [SECOND], 'replay_seed', 2),
        searchedOn('replay_elsewhere', [THIRD], 'replay_other'),
        seed(),
      ]),
    ).toBeNull();
  });

  it('keeps to the seed whose replays cover the most runs', () => {
    const reused = of([
      searchedOn('replay_a', [FIRST], 'replay_seed_a'),
      searchedOn('replay_b', [SECOND, THIRD], 'replay_seed_b'),
      seed('replay_seed_a'),
      seed('replay_seed_b'),
    ]);

    expect(reused?.seed.value).toBe('replay_seed_b');
    expect(runsOf(reused)).toEqual([['replay_b', [SECOND.value, THIRD.value]]]);
  });

  it('reuses nothing against a seed of fewer attempts than a check baseline needs', () => {
    expect(
      of([searchedOn('replay_searched', SET.runs), seed('replay_seed', 1)]),
    ).toBeNull();
  });

  it('reuses nothing replayed outside a search or of another config', () => {
    const outside = replayedAs(
      replayFor(
        SET,
        'replay_outside',
        'candidate_searched',
        SET.runs,
        false,
        1,
        null,
        'replay_seed',
      ),
      () => 'completed',
    );
    const other = replayedAs(
      replayFor(
        SET,
        'replay_other',
        'candidate_other',
        SET.runs,
        false,
        1,
        SEARCH_ID,
        'replay_seed',
      ),
      () => 'completed',
    );

    expect(of([outside, other, seed()])).toBeNull();
  });
});
