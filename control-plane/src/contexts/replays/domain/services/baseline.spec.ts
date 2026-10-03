import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import {
  AT,
  aReplay,
  aSet,
  BY,
  candidateOf,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  later,
  NOW,
  runIds,
  STATION,
  settledAs,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import {
  baselineFor,
  baselineOf,
  needsBaseline,
} from '@replays/domain/services/baseline';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationDigests } from '@replays/domain/value-objects/station-digests.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const live = candidateOf('live');

const aBaseline = (id: string, at: number, count = 3, repeats = 1) =>
  aReplay({
    id,
    candidate: live,
    baseline: true,
    at: later(at),
    count,
    repeats,
  });

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

const SCORING = LIVE_DIGESTS.scoring;

const stale = Candidate.live({
  id: CandidateId.of('candidate_stale'),
  station: STATION,
  address: AT,
  block: StationBlock.of({ key: 'build', name: 'Build', kind: 'work' }),
  fingerprint: LIVE_FINGERPRINT,
  digests: StationDigests.of({
    behaviour: 'd'.repeat(64),
    scoring: 'f'.repeat(64),
  }),
  scoring: UNSCORED,
  at: NOW,
});

describe('needsBaseline', () => {
  it('wants one when the set has none', () => {
    expect(needsBaseline(aSet(2), [], SCORING, 1)).toBe(true);
  });

  it('wants none while a baseline of the live config covers every run of the set', () => {
    expect(
      needsBaseline(aSet(2), [aBaseline('replay_1', 0, 3)], SCORING, 1),
    ).toBe(false);
  });

  it('wants a new one once the set holds a run its baseline did not replay', () => {
    expect(
      needsBaseline(aSet(3), [aBaseline('replay_1', 0, 2)], SCORING, 1),
    ).toBe(true);
  });

  it('wants none while an older baseline covers the set though a newer one does not', () => {
    const covering = aBaseline('replay_covering', 0, 3, 3);
    const narrower = aBaseline('replay_narrower', 1, 2, 1);

    expect(needsBaseline(aSet(3), [covering, narrower], SCORING, 3)).toBe(
      false,
    );
  });

  it('wants a new one when the only covering baseline was stopped', () => {
    const stopped = aBaseline('replay_stopped', 0, 3).stopped(later(1), BY);

    expect(needsBaseline(aSet(2), [stopped], SCORING, 1)).toBe(true);
  });

  it('wants a new one once the live config runs or is scored differently from its baseline', () => {
    const old = aReplay({ id: 'replay_old', candidate: stale, baseline: true });

    expect(needsBaseline(aSet(2), [old], SCORING, 1)).toBe(true);
  });

  it('wants a new one when a replay copies each run more often than its baseline did', () => {
    const once = aBaseline('replay_once', 0, 2);
    const thrice = aBaseline('replay_thrice', 1, 2, 3);

    expect(needsBaseline(aSet(2), [once], SCORING, 3)).toBe(true);
    expect(needsBaseline(aSet(2), [thrice], SCORING, 3)).toBe(false);
    expect(needsBaseline(aSet(2), [thrice], SCORING, 1)).toBe(false);
    expect(baselineFor([once], SCORING, aSet(2).runs, 3)).toBeNull();
    expect(
      baselineFor([once, thrice], SCORING, aSet(2).runs, 2)?.id.value,
    ).toBe('replay_thrice');
  });
});

describe('baselineFor', () => {
  const runs = aSet(2).runs;

  it('is the newest finished baseline of the live config covering the runs, else the newest standing one, else any', () => {
    const running = aBaseline('replay_running', 2);
    const stopped = aBaseline('replay_stopped', 3).stopped(later(4), BY);
    const old = aReplay({
      id: 'replay_stale',
      candidate: stale,
      baseline: true,
      at: later(5),
    });

    expect(
      baselineFor([running, stopped, old], SCORING, runs, 1)?.id.value,
    ).toBe('replay_running');
    expect(baselineFor([stopped, old], SCORING, runs, 1)?.id.value).toBe(
      'replay_stopped',
    );
    expect(baselineFor([old], SCORING, runs, 1)).toBeNull();
    expect(
      baselineFor([aBaseline('replay_short', 0, 1)], SCORING, runs, 1),
    ).toBeNull();
  });
});
