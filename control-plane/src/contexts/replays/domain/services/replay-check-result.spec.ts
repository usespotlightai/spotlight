import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { ReplayCheck } from '@replays/domain/aggregates/replay-check.aggregate';
import {
  aSet,
  BY,
  FINGERPRINT,
  HASHES,
  LIVE_FINGERPRINT,
  LIVE_HASHES,
  NOW,
  replayedAs,
  replayFor,
} from '@replays/domain/replays.fake-spec';
import { evaluationOf } from '@replays/domain/services/replay-check-result';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { PlannedReference } from '@replays/domain/value-objects/planned-reference.vo';
import { ReplayCheckId } from '@replays/domain/value-objects/replay-check-id.vo';
import type { RunResult } from '@replays/domain/value-objects/replay-ending';
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
    liveHashes: LIVE_HASHES,
    candidateHashes: HASHES,
    threshold: ReplayThreshold.of({
      maxRegressions,
      ceiling: 10,
      currency: 'USD',
      minGain: 0.05,
    }),
    repeats: 1,
    scoringPinnedToLive: [],
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
  (original: string): RunResult =>
    originals.includes(original) ? 'failed' : 'completed';

describe('evaluationOf', () => {
  it('runs while its replay runs', () => {
    expect(evaluationOf(checkOf(), candidate(), baseline(), false).result).toBe(
      'running',
    );
  });

  it('passes when no more tasks regressed than the threshold allows', () => {
    const replay = replayedAs(candidate(), failingOn('original_1'));
    const evaluation = evaluationOf(checkOf(1), replay, baseline(), false);

    expect(evaluation).toMatchObject({
      result: 'passed',
      because: null,
      entries: 4,
      compared: 4,
    });
    expect(
      evaluation.tasks
        .filter((each) => each.regressed)
        .map((each) => each.taskId),
    ).toEqual(['task_1']);
    expect(evaluation.gain).toMatchObject({
      gain: -0.25,
      minGain: 0.05,
      tasks: 4,
      significance: 'within-noise',
    });
    expect(evaluation.candidate?.interval?.rate).toBe(0.75);
  });

  it('fails once more tasks regressed than the threshold allows, even before the replay ends', () => {
    const replay = replayedAs(
      candidate(),
      failingOn('original_1', 'original_2'),
    );

    expect(evaluationOf(checkOf(1), replay, baseline(), false).result).toBe(
      'failed',
    );
    expect(
      evaluationOf(checkOf(0), replay, baseline(), false).tasks.filter(
        (each) => each.regressed,
      ),
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

    expect(evaluationOf(checkOf(), stopped, baseline(), false)).toMatchObject({
      result: 'undecided',
      because: 'stopped',
    });
    expect(evaluationOf(checkOf(), finished, unfinished, false)).toMatchObject({
      result: 'undecided',
      because: 'baseline-unfinished',
    });
    expect(evaluationOf(checkOf(), null, baseline(), false)).toMatchObject({
      result: 'undecided',
      because: 'replay-gone',
    });
  });

  it('runs while the baseline it waits for is still being started, and is undecided once none will come', () => {
    const finished = replayedAs(candidate(), () => 'completed');

    expect(evaluationOf(checkOf(), finished, null, true).result).toBe(
      'running',
    );
    expect(evaluationOf(checkOf(), finished, null, false)).toMatchObject({
      result: 'undecided',
      because: 'no-baseline',
    });
  });

  it('is undecided when fewer than half the tasks were scored on both sides', () => {
    const replay = replayedAs(candidate(), (original) =>
      ['original_0', 'original_1', 'original_2'].includes(original)
        ? 'exhausted'
        : 'completed',
    );

    expect(evaluationOf(checkOf(), replay, baseline(), false)).toMatchObject({
      result: 'undecided',
      because: 'too-few-scored',
      compared: 1,
    });
  });
});
