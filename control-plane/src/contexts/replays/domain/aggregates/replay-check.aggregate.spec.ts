import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import { ReplayCheckStarted } from '@replays/domain/events/replay-check-started.event';
import { InvalidReplayCheckError } from '@replays/domain/exceptions/invalid-replay-check.error';
import { InvalidSpendError } from '@replays/domain/exceptions/invalid-spend.error';
import {
  aSet,
  BY,
  DIGESTS,
  FINGERPRINT,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  NOW,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { describe, expect, it } from 'vitest';

const started = (
  more: Partial<Parameters<typeof ReplayCheck.started>[0]> = {},
) =>
  ReplayCheck.started({
    id: ReplayCheckId.of('check_1'),
    station: STATION,
    stationKey: 'build',
    setId: ReplaySetId.of('set_1'),
    candidateId: CandidateId.of('candidate_planned'),
    replayId: ReplayId.of('replay_1'),
    setEntries: 'entries_1',
    attempt: 1,
    reference: PlannedReference.of({ pullRequest: 42 }),
    liveFingerprint: LIVE_FINGERPRINT,
    candidateFingerprint: FINGERPRINT,
    liveDigests: LIVE_DIGESTS,
    candidateDigests: DIGESTS,
    threshold: ReplayThreshold.of({
      mostRegressions: 0,
      ceiling: 10,
      currency: 'USD',
    }),
    keptLive: ['diffs', 'check'],
    createdAt: NOW,
    by: BY,
    ...more,
  });

const SET = aSet(2);

describe('ReplayCheck', () => {
  it('records that it started, named by the change it checks, keeping what it kept live in order', () => {
    const check = started();
    const [event] = check.pullEvents();

    expect(event).toBeInstanceOf(ReplayCheckStarted);
    expect((event as ReplayCheckStarted).change).toMatchObject({
      resource: 'replay-check',
      action: 'created',
      key: 'PR #42',
    });
    expect(check.keptLive).toEqual(['check', 'diffs']);
  });

  it('checks a change to how the station runs, counting its attempts from 1', () => {
    expect(() => started({ candidateDigests: LIVE_DIGESTS })).toThrow(
      InvalidReplayCheckError,
    );
    expect(() => started({ attempt: 0 })).toThrow(InvalidReplayCheckError);
  });

  it('is reused only for its own set holding the same runs, under the same threshold, while running, passed or failed', () => {
    const check = started({ setId: SET.id, setEntries: 'entries_1' });
    const threshold = ReplayThreshold.of({
      mostRegressions: 0,
      ceiling: 10,
      currency: 'USD',
    });
    const raised = ReplayThreshold.of({
      mostRegressions: 1,
      ceiling: 10,
      currency: 'USD',
    });
    const reusable = (verdict: 'running' | 'passed' | 'failed' | 'undecided') =>
      check.reusableFor(SET, 'entries_1', threshold, verdict);

    expect(reusable('running')).toBe(true);
    expect(reusable('passed')).toBe(true);
    expect(reusable('failed')).toBe(true);
    expect(reusable('undecided')).toBe(false);
    expect(check.reusableFor(SET, 'entries_1', raised, 'passed')).toBe(false);
    expect(check.reusableFor(SET, 'entries_2', threshold, 'passed')).toBe(
      false,
    );
    expect(
      check.reusableFor(aSet(1, 'set_other'), 'entries_1', threshold, 'passed'),
    ).toBe(false);
  });

  it('charges a run without a price its share of the ceiling', () => {
    expect(
      ReplayThreshold.of({
        mostRegressions: 0,
        ceiling: 9,
        currency: 'USD',
      }).unpricedRunIn(3).amount,
    ).toBe(3);
  });

  it('awaits its baseline until it is found or cannot come, and then stays settled', () => {
    const check = started();

    expect(check.baseline).toBe('awaiting');
    expect(check.baselineFound().baseline).toBe('found');
    expect(check.baselineUnavailable().baseline).toBe('unavailable');
    expect(check.baselineFound().baselineUnavailable().baseline).toBe('found');
  });

  it('takes a threshold of whole tasks and a ceiling a replay may spend', () => {
    expect(() =>
      ReplayThreshold.of({ mostRegressions: -1, ceiling: 10, currency: 'USD' }),
    ).toThrow(InvalidReplayCheckError);
    expect(() =>
      ReplayThreshold.of({ mostRegressions: 0, ceiling: 0, currency: 'USD' }),
    ).toThrow(InvalidSpendError);
    expect(
      ReplayThreshold.of({
        mostRegressions: 2,
        ceiling: 5,
        currency: 'eur',
      }).allows(2),
    ).toBe(true);
  });
});
