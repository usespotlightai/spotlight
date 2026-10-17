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

const started = (more: Partial<Parameters<typeof ReplayCheck.start>[0]> = {}) =>
  ReplayCheck.start({
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
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    }),
    repeats: 1,
    scoringPinnedToLive: ['diffs', 'check'],
    createdAt: NOW,
    by: BY,
    ...more,
  });

const SET = aSet(2);

describe('ReplayCheck', () => {
  it('records that it started, named by the change it checks, recording what it pinned to live in order', () => {
    const check = started();
    const [event] = check.pullEvents();

    expect(event).toBeInstanceOf(ReplayCheckStarted);
    expect((event as ReplayCheckStarted).change).toMatchObject({
      resource: 'replay-check',
      action: 'created',
      key: 'PR #42',
    });
    expect(check.scoringPinnedToLive).toEqual(['check', 'diffs']);
  });

  it('checks a change to how the station runs, counting its attempts from 1', () => {
    expect(() => started({ candidateDigests: LIVE_DIGESTS })).toThrow(
      InvalidReplayCheckError,
    );
    expect(() => started({ attempt: 0 })).toThrow(InvalidReplayCheckError);
  });

  it('is reused only for its own set with the same runs, under the same threshold, while running, passed or failed', () => {
    const check = started({ setId: SET.id, setEntries: 'entries_1' });
    const threshold = ReplayThreshold.of({
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    });
    const raised = ReplayThreshold.of({
      maxRegressions: 1,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    });
    const reusable = (verdict: 'running' | 'passed' | 'failed' | 'undecided') =>
      check.reusableFor(SET, 'entries_1', threshold, 1, verdict);

    expect(reusable('running')).toBe(true);
    expect(reusable('passed')).toBe(true);
    expect(reusable('failed')).toBe(true);
    expect(reusable('undecided')).toBe(false);
    expect(check.reusableFor(SET, 'entries_1', raised, 1, 'passed')).toBe(
      false,
    );
    expect(check.reusableFor(SET, 'entries_2', threshold, 1, 'passed')).toBe(
      false,
    );
    expect(
      check.reusableFor(
        aSet(1, 'set_other'),
        'entries_1',
        threshold,
        1,
        'passed',
      ),
    ).toBe(false);
  });

  it('is reused only when it replays each run as many times as requested, and replays each from 1 to 5 times', () => {
    const check = started({
      setId: SET.id,
      setEntries: 'entries_1',
      repeats: 3,
    });
    const threshold = ReplayThreshold.of({
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    });

    expect(check.reusableFor(SET, 'entries_1', threshold, 3, 'passed')).toBe(
      true,
    );
    expect(check.reusableFor(SET, 'entries_1', threshold, 1, 'passed')).toBe(
      false,
    );
    expect(() => started({ repeats: 0 })).toThrow(InvalidReplayCheckError);
    expect(() => started({ repeats: 6 })).toThrow(InvalidReplayCheckError);
  });

  it('is reused under another min gain, which only reads the gain and is a share above 0 and at most 1', () => {
    const check = started({ setId: SET.id, setEntries: 'entries_1' });
    const wider = ReplayThreshold.of({
      maxRegressions: 0,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.1,
    });

    expect(check.reusableFor(SET, 'entries_1', wider, 1, 'passed')).toBe(true);
    for (const minGain of [0, -0.1, 1.5, Number.NaN]) {
      expect(() =>
        ReplayThreshold.of({
          maxRegressions: 0,
          ceiling: 10,
          currency: 'USD',
          minGain,
        }),
      ).toThrow(InvalidReplayCheckError);
    }
  });

  it('charges a run without a price its share of the ceiling', () => {
    expect(
      ReplayThreshold.of({
        maxRegressions: 0,
        ceiling: 9,
        currency: 'USD',
        minGain: 0.05,
      }).unpricedRunIn(3).amount,
    ).toBe(3);
  });

  it('awaits its baseline until it is found or cannot come, and then records that baseline status', () => {
    const check = started();

    expect(check.baseline).toBe('awaiting');
    expect(check.recordBaseline().baseline).toBe('found');
    expect(check.markBaselineUnavailable().baseline).toBe('unavailable');
    expect(check.recordBaseline().markBaselineUnavailable().baseline).toBe(
      'found',
    );
  });

  it('takes a threshold of whole tasks and a ceiling a replay may spend', () => {
    expect(() =>
      ReplayThreshold.of({
        maxRegressions: -1,
        ceiling: 10,
        currency: 'USD',
        minGain: 0.05,
      }),
    ).toThrow(InvalidReplayCheckError);
    expect(() =>
      ReplayThreshold.of({
        maxRegressions: 0,
        ceiling: 0,
        currency: 'USD',
        minGain: 0.05,
      }),
    ).toThrow(InvalidSpendError);
    expect(
      ReplayThreshold.of({
        maxRegressions: 2,
        ceiling: 5,
        currency: 'eur',
        minGain: 0.05,
      }).allows(2),
    ).toBe(true);
  });
});
