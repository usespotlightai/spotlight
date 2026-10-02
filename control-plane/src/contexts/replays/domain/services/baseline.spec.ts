import {
  aReplay,
  aSet,
  BY,
  candidateOf,
  later,
  runIds,
  settledAs,
} from '@replays/domain/replays.fake-spec';
import { baselineOf, needsBaseline } from '@replays/domain/services/baseline';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const live = candidateOf('live');

const aBaseline = (id: string, at: number, count = 3) =>
  aReplay({ id, candidate: live, baseline: true, at: later(at), count });

describe('baselineOf', () => {
  it('is the newest baseline replay that was not stopped or cut short', () => {
    const old = aBaseline('replay_old', 0);
    const fresh = aBaseline('replay_fresh', 1);
    const stopped = aBaseline('replay_stopped', 2).stopped(later(3), BY);
    const proposed = aReplay({ id: 'replay_proposed', at: later(4) });

    expect(baselineOf([old, fresh, stopped, proposed])?.id.value).toBe(
      'replay_fresh',
    );
  });

  it('is no replay of the live config that was not started as a baseline', () => {
    expect(
      baselineOf([aReplay({ candidate: live, baseline: false })]),
    ).toBeNull();
  });

  it('passes over a baseline that went over its budget', () => {
    const over = settledAs(
      aBaseline('replay_over', 0, 2).reserving(1, runIds()),
      RunId.of('replay_run_0'),
      'completed',
      100,
    );

    expect(over.current).toBe('over-budget');
    expect(baselineOf([over])).toBeNull();
  });
});

describe('needsBaseline', () => {
  it('wants one when the set has none', () => {
    expect(needsBaseline(aSet(2), [])).toBe(true);
  });

  it('wants none while a baseline covers every run of the set', () => {
    expect(needsBaseline(aSet(2), [aBaseline('replay_1', 0, 3)])).toBe(false);
  });

  it('wants a new one once the set holds a run its baseline did not replay', () => {
    expect(needsBaseline(aSet(3), [aBaseline('replay_1', 0, 2)])).toBe(true);
  });
});
