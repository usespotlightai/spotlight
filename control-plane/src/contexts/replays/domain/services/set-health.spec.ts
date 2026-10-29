import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  aSet,
  BY,
  candidateOf,
  endOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  measuresOf,
  NOW,
  RUBRIC,
  replayedAs,
  runIds,
} from '@replays/domain/replays.fake-spec';
import {
  setHealthOf,
  wantsCalibration,
} from '@replays/domain/services/set-health';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const MIN_GAIN = 0.05;

const SET = aSet(6);

const SCORED = candidateOf('live', 'candidate_scored', RUBRIC, 'npm test');

const PLAIN = candidateOf('live', 'candidate_plain');

const checksOf = (state: 'passed' | 'failed') =>
  ChangeChecks.of([
    {
      repository: 'api',
      state,
      skip: null,
      failedAt: state === 'failed' ? ['the whole change'] : [],
      spent: ModelSpent.of([], 0),
    },
  ]);

const verdictOf = (passes: boolean) =>
  JudgeVerdict.of({
    scale: 'number',
    value: passes ? 5 : 2,
    claimResults: null,
    claims: [],
    passThreshold: 1,
    model: 'judge/model',
    referenced: false,
    reasons: [],
    guidance: null,
  });

const started = (
  id: string,
  candidate: Candidate,
  repeats: number,
  calibration = false,
  runSubset: readonly RunId[] | null = null,
  against: Replay | null = null,
) => {
  const replay = Replay.start({
    id: ReplayId.of(id),
    set: SET,
    candidate,
    baseline: false,
    ceiling: Money.ceiling(100, 'USD'),
    at: NOW,
    by: BY,
    repeats,
    calibration,
    ...(against
      ? {
          oracle: {
            answers: (runSubset ?? SET.runs).map((run) => ({
              run,
              answer: 'accepted' as const,
            })),
            against,
            live: PLAIN,
          },
        }
      : runSubset
        ? { runSubset }
        : {}),
  });

  replay.pullEvents();

  return replay.reserving(replay.entries.length, runIds());
};

const calibrated = (
  passing: (place: number) => boolean,
  checked: (place: number) => 'passed' | 'failed' = () => 'passed',
) =>
  started('replay_calibration', SCORED, 2, true).entries.reduce(
    (built, entry, place) => {
      const run = entry.run as RunId;

      return built
        .confirm(run, FINGERPRINT, NOW)
        .recordRunEnd(run, endOf('completed'))
        .measure(run, measuresOf(1), later(61_000))
        .recordReview(run, checksOf(checked(place)), null, later(62_000))
        .recordVerdict(run, verdictOf(passing(place)), null, later(63_000));
    },
    started('replay_calibration', SCORED, 2, true),
  );

const plainly = (
  id: string,
  candidate: Candidate,
  failing: readonly string[],
  runSubset: readonly RunId[] | null = null,
) =>
  replayedAs(
    started(
      id,
      candidate,
      1,
      false,
      runSubset,
      candidate.isOracle ? finishedLive() : null,
    ),
    (original) => (failing.includes(original) ? 'failed' : 'completed'),
  );

const finishedLive = (): Replay => plainly('replay_live', PLAIN, []);

const ORACLE = Candidate.oracleOf(PLAIN, {
  id: CandidateId.of('candidate_oracle'),
  at: NOW,
});

describe('setHealthOf', () => {
  it('reads a set as saturated when its newest finished live replay passes more than 95% of it', () => {
    const health = setHealthOf(
      [plainly('replay_live', PLAIN, [])],
      [PLAIN],
      FINGERPRINT,
      MIN_GAIN,
    );

    expect(health.saturation).toMatchObject({ rate: 1, saturated: true });
    expect(health.saturation?.replayId.value).toBe('replay_live');
    expect(
      setHealthOf(
        [plainly('replay_live', PLAIN, ['original_0'])],
        [PLAIN],
        FINGERPRINT,
        MIN_GAIN,
      ).saturation?.saturated,
    ).toBe(false);
  });

  it('reads saturation only off a whole-set live replay of the live config as it is now', () => {
    const partial = replayedAs(
      started('replay_part', PLAIN, 1, false, [SET.runs[0] as RunId]),
      () => 'completed',
    );

    expect(
      setHealthOf([partial], [PLAIN], FINGERPRINT, MIN_GAIN).saturation,
    ).toBeNull();
    expect(
      setHealthOf(
        [plainly('replay_live', PLAIN, [])],
        [PLAIN],
        LIVE_FINGERPRINT,
        MIN_GAIN,
      ).saturation,
    ).toBeNull();
    expect(setHealthOf([], [], FINGERPRINT, MIN_GAIN)).toEqual({
      noise: null,
      saturation: null,
      judge: null,
      checks: null,
      oracle: null,
    });
  });

  it('reads how often the judge agreed with itself on the newest calibration, and marks it unstable below 80%', () => {
    const calibration = calibrated(() => true);
    const answered = calibration.entries.reduce(
      (built, entry, place) =>
        built.recordRejudgment(entry.run as RunId, verdictOf(place >= 3), null),
      calibration,
    );
    const health = setHealthOf([answered], [SCORED], FINGERPRINT, MIN_GAIN);

    expect(health.judge).toMatchObject({
      compared: 12,
      agreed: 9,
      pending: 0,
      agreement: 0.75,
      unstable: true,
    });
    expect(
      setHealthOf([calibration], [SCORED], FINGERPRINT, MIN_GAIN).judge,
    ).toMatchObject({
      compared: 0,
      pending: 12,
      agreement: null,
      unstable: false,
    });
  });

  it('lists the runs whose check came out differently the second time', () => {
    const calibration = calibrated(() => true);
    const rechecked = calibration.entries.reduce(
      (built, entry, place) =>
        built.recheck(
          entry.run as RunId,
          checksOf(place === 1 ? 'failed' : 'passed'),
        ),
      calibration,
    );
    const checks = setHealthOf(
      [rechecked],
      [SCORED],
      FINGERPRINT,
      MIN_GAIN,
    ).checks;

    expect(checks).toMatchObject({ rechecked: 12, pending: 0 });
    expect(
      checks?.flaky.map((each) => [
        each.taskId.value,
        each.original.value,
        each.first,
        each.recheck,
      ]),
    ).toEqual([['task_1', 'original_1', 'passed', 'failed']]);
  });

  it('has no judge or check consistency without a finished calibration', () => {
    const health = setHealthOf(
      [plainly('replay_live', PLAIN, [])],
      [PLAIN],
      FINGERPRINT,
      MIN_GAIN,
    );

    expect(health.judge).toBeNull();
    expect(health.checks).toBeNull();
  });

  it('says a set has room to improve when the answer does clearly better than the live config', () => {
    const health = setHealthOf(
      [
        plainly('replay_live', PLAIN, [
          'original_0',
          'original_1',
          'original_2',
        ]),
        plainly('replay_oracle', ORACLE, []),
      ],
      [PLAIN, ORACLE],
      FINGERPRINT,
      MIN_GAIN,
    );

    expect(health.oracle).toMatchObject({
      repeats: 1,
      state: 'finished',
      answered: 6,
      live: 0.5,
      withAnswer: 1,
      roomToImprove: true,
    });
    expect(health.oracle?.referenceReplayId?.value).toBe('replay_live');
    expect(health.oracle?.gain?.significance).toBe('better');
  });

  it('compares only the runs handed an answer, and says when the answer leaves no room', () => {
    const answered = SET.entries.slice(0, 5).map((each) => each.runId);
    const oracle = setHealthOf(
      [
        plainly('replay_live', PLAIN, ['original_5']),
        plainly('replay_oracle', ORACLE, [], answered),
      ],
      [PLAIN, ORACLE],
      FINGERPRINT,
      MIN_GAIN,
    ).oracle;

    expect(oracle).toMatchObject({
      answered: 5,
      live: 1,
      withAnswer: 1,
      roomToImprove: false,
    });
    expect(oracle?.gain?.tasks).toBe(5);
  });

  it('cannot tell the room from fewer than five runs handed an answer', () => {
    const answered = SET.entries.slice(0, 3).map((each) => each.runId);
    const oracle = setHealthOf(
      [
        plainly('replay_live', PLAIN, ['original_0', 'original_1']),
        plainly('replay_oracle', ORACLE, [], answered),
      ],
      [PLAIN, ORACLE],
      FINGERPRINT,
      MIN_GAIN,
    ).oracle;

    expect(oracle?.answered).toBe(3);
    expect(oracle?.gain?.tasks).toBe(3);
    expect(oracle?.roomToImprove).toBeNull();
  });

  it('shows no reading until its replay finishes, and reads only one of the live config as it is now', () => {
    const inProgress = started(
      'replay_oracle',
      ORACLE,
      1,
      false,
      null,
      finishedLive(),
    );

    expect(
      setHealthOf(
        [plainly('replay_live', PLAIN, []), inProgress],
        [PLAIN, ORACLE],
        FINGERPRINT,
        MIN_GAIN,
      ).oracle,
    ).toMatchObject({
      state: 'running',
      live: null,
      withAnswer: null,
      gain: null,
      roomToImprove: null,
    });
    expect(
      setHealthOf(
        [plainly('replay_oracle', ORACLE, [])],
        [ORACLE],
        LIVE_FINGERPRINT,
        MIN_GAIN,
      ).oracle,
    ).toBeNull();
  });

  it('says the replay it was compared with stopped, rather than waiting on it for ever', () => {
    const stoppedLive = started('replay_live', PLAIN, 1).stop(later(1), BY);
    const oracle = setHealthOf(
      [stoppedLive, plainly('replay_oracle', ORACLE, [])],
      [PLAIN, ORACLE],
      FINGERPRINT,
      MIN_GAIN,
    ).oracle;

    expect(oracle).toMatchObject({
      referenceState: 'stopped',
      gain: null,
      roomToImprove: null,
    });
    expect(
      setHealthOf(
        [plainly('replay_oracle', ORACLE, [])],
        [ORACLE],
        FINGERPRINT,
        MIN_GAIN,
      ).oracle?.referenceState,
    ).toBe('gone');
  });
});

describe('wantsCalibration', () => {
  const FINGER = SCORED.fingerprint;

  it('wants one for a set of at least five runs with no calibration of the live config', () => {
    expect(wantsCalibration(SET, [], [SCORED], FINGER)).toBe(true);
    expect(wantsCalibration(aSet(4), [], [SCORED], FINGER)).toBe(false);
  });

  it('wants none while a calibration of these runs and this live config runs or finished', () => {
    expect(
      wantsCalibration(SET, [calibrated(() => true)], [SCORED], FINGER),
    ).toBe(false);
  });

  it('wants one again once the live config or the runs of the set changed', () => {
    const calibration = calibrated(() => true);

    expect(
      wantsCalibration(SET, [calibration], [SCORED], LIVE_FINGERPRINT),
    ).toBe(true);
    expect(wantsCalibration(aSet(7), [calibration], [SCORED], FINGER)).toBe(
      true,
    );
  });
});
