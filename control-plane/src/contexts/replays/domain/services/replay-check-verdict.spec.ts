import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  aSet,
  BY,
  DIGESTS,
  FINGERPRINT,
  LIVE_DIGESTS,
  LIVE_FINGERPRINT,
  NOW,
  replayedAs,
  replayFor,
} from '@replays/domain/replays.fake-spec';
import { readingOf } from '@replays/domain/services/replay-check-verdict';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { RunOutcome } from '@replays/domain/value-objects/replay-ending';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { ReplayThreshold } from '@replays/domain/value-objects/replay-threshold.vo';
import { describe, expect, it } from 'vitest';

const SET = aSet(4);

const checkOf = (maxRegressions = 0): ReplayCheck =>
  ReplayCheck.start({
    id: ReplayCheckId.of('check_1'),
    station: SET.station,
    stationKey: 'build',
    setId: SET.id,
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
      maxRegressions,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    }),
    repeats: 1,
    keptLive: [],
    createdAt: NOW,
    by: BY,
  });

const candidate = (): Replay =>
  replayFor(SET, 'replay_1', 'candidate_planned', null);

const baseline = (): Replay =>
  replayedAs(
    replayFor(SET, 'replay_base', 'candidate_live', null, true),
    () => 'completed',
  );

const failingOn =
  (...originals: string[]) =>
  (original: string): RunOutcome =>
    originals.includes(original) ? 'failed' : 'completed';

describe('readingOf', () => {
  it('runs while its replay runs', () => {
    expect(readingOf(checkOf(), candidate(), baseline(), false).verdict).toBe(
      'running',
    );
  });

  it('passes when no more tasks regressed than the threshold allows', () => {
    const replay = replayedAs(candidate(), failingOn('original_1'));
    const reading = readingOf(checkOf(1), replay, baseline(), false);

    expect(reading).toMatchObject({
      verdict: 'passed',
      because: null,
      entries: 4,
      compared: 4,
    });
    expect(reading.regressions.map((each) => each.taskId)).toEqual(['task_1']);
    expect(reading.gain).toMatchObject({
      gain: -0.25,
      minGain: 0.05,
      tasks: 4,
      verdict: 'within-noise',
    });
    expect(reading.candidate?.interval?.rate).toBe(0.75);
  });

  it('fails once more tasks regressed than the threshold allows, even before the replay ends', () => {
    const replay = replayedAs(
      candidate(),
      failingOn('original_1', 'original_2'),
    );

    expect(readingOf(checkOf(1), replay, baseline(), false).verdict).toBe(
      'failed',
    );
    expect(
      readingOf(checkOf(0), replay, baseline(), false).regressions,
    ).toHaveLength(2);
  });

  it('is undecided when its replay stopped, its baseline did not finish, or it is gone', () => {
    const stopped = candidate().stop(NOW, BY);
    const finished = replayedAs(candidate(), () => 'completed');
    const unfinished = replayFor(
      SET,
      'replay_base',
      'candidate_live',
      null,
      true,
    ).stop(NOW, BY);

    expect(readingOf(checkOf(), stopped, baseline(), false)).toMatchObject({
      verdict: 'undecided',
      because: 'stopped',
    });
    expect(readingOf(checkOf(), finished, unfinished, false)).toMatchObject({
      verdict: 'undecided',
      because: 'baseline-unfinished',
    });
    expect(readingOf(checkOf(), null, baseline(), false)).toMatchObject({
      verdict: 'undecided',
      because: 'replay-gone',
    });
  });

  it('runs while the baseline it waits for is still being started, and is undecided once none will come', () => {
    const finished = replayedAs(candidate(), () => 'completed');

    expect(readingOf(checkOf(), finished, null, true).verdict).toBe('running');
    expect(readingOf(checkOf(), finished, null, false)).toMatchObject({
      verdict: 'undecided',
      because: 'no-baseline',
    });
  });

  it('is undecided when fewer than half the tasks were scored on both sides', () => {
    const replay = replayedAs(candidate(), (original) =>
      ['original_0', 'original_1', 'original_2'].includes(original)
        ? 'exhausted'
        : 'completed',
    );

    expect(readingOf(checkOf(), replay, baseline(), false)).toMatchObject({
      verdict: 'undecided',
      because: 'too-few-scored',
      compared: 1,
    });
  });
});
