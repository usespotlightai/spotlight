import { Candidate } from '@replays/domain/aggregates/candidate.aggregate';
import { Replay } from '@replays/domain/aggregates/replay.aggregate';
import {
  AT,
  aSet,
  BY,
  candidateOf,
  DIGESTS,
  endOf,
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  measuresOf,
  NOW,
  RUBRIC,
  replayedAs,
  runIds,
  STATION,
  UNSCORED,
} from '@replays/domain/replays.fake-spec';
import { setHealthOf } from '@replays/domain/services/set-health';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ChangeChecks } from '@replays/domain/value-objects/change-checks.vo';
import { JudgeVerdict } from '@replays/domain/value-objects/judge-verdict.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import { StationChanges } from '@replays/domain/value-objects/station-changes.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
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
    model: 'judge/model',
    referenced: false,
    reasons: [],
  });

const started = (
  id: string,
  candidate: Candidate,
  repeats: number,
  probe = false,
  among: readonly RunId[] | null = null,
  comparedWith: string | null = null,
) => {
  const replay = Replay.started({
    id: ReplayId.of(id),
    set: SET,
    candidate,
    baseline: false,
    ceiling: Spend.ceiling(100, 'USD'),
    at: NOW,
    by: BY,
    repeats,
    probe,
    ...(among ? { among } : {}),
    ...(comparedWith ? { comparedWith: ReplayId.of(comparedWith) } : {}),
  });

  replay.pullEvents();

  return replay.reserving(replay.entries.length, runIds());
};

const probed = (
  passing: (place: number) => boolean,
  checked: (place: number) => 'passed' | 'failed' = () => 'passed',
) =>
  started('replay_probe', SCORED, 2, true).entries.reduce(
    (held, entry, place) => {
      const run = entry.run as RunId;

      return held
        .confirmed(run, FINGERPRINT, NOW)
        .ended(run, endOf('completed'))
        .measured(run, measuresOf(1), later(61_000))
        .reviewed(run, checksOf(checked(place)), null, later(62_000))
        .judged(run, verdictOf(passing(place)), null, later(63_000));
    },
    started('replay_probe', SCORED, 2, true),
  );

const plainly = (
  id: string,
  candidate: Candidate,
  failing: readonly string[],
) =>
  replayedAs(
    started(
      id,
      candidate,
      1,
      false,
      null,
      candidate.isSanity ? 'replay_live' : null,
    ),
    (original) => (failing.includes(original) ? 'failed' : 'completed'),
  );

const strongerOf = (model: string) =>
  Candidate.sanity({
    id: CandidateId.of('candidate_stronger'),
    station: STATION,
    address: AT,
    block: StationBlock.of({
      key: 'build',
      name: 'Build',
      kind: 'work',
      model,
    }),
    fingerprint: StationFingerprint.of('c'.repeat(64)),
    digests: DIGESTS,
    scoring: UNSCORED,
    changedFrom: StationChanges.of(FINGERPRINT, [
      { part: 'model', name: null, kind: 'changed', was: 'sonnet', now: model },
    ]),
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
      sanity: null,
    });
  });

  it('reads how often the judge agreed with itself on the newest probe, and marks it unstable below 80%', () => {
    const probe = probed(() => true);
    const answered = probe.entries.reduce(
      (held, entry, place) =>
        held.rejudged(entry.run as RunId, verdictOf(place >= 3), null),
      probe,
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
      setHealthOf([probe], [SCORED], FINGERPRINT, MIN_GAIN).judge,
    ).toMatchObject({
      compared: 0,
      pending: 12,
      agreement: null,
      unstable: false,
    });
  });

  it('lists the runs whose check came out differently the second time', () => {
    const probe = probed(() => true);
    const rechecked = probe.entries.reduce(
      (held, entry, place) =>
        held.rechecked(
          entry.run as RunId,
          checksOf(place === 1 ? 'failed' : 'passed'),
        ),
      probe,
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

  it('has no judge or check consistency without a finished probe', () => {
    const health = setHealthOf(
      [plainly('replay_live', PLAIN, [])],
      [PLAIN],
      FINGERPRINT,
      MIN_GAIN,
    );

    expect(health.judge).toBeNull();
    expect(health.checks).toBeNull();
  });

  it('says a set rewards a stronger model when the stronger replay is clearly better than the live one', () => {
    const stronger = strongerOf('opus');
    const health = setHealthOf(
      [
        plainly('replay_live', PLAIN, [
          'original_0',
          'original_1',
          'original_2',
        ]),
        plainly('replay_stronger', stronger, []),
      ],
      [PLAIN, stronger],
      FINGERPRINT,
      MIN_GAIN,
    );

    expect(health.sanity).toMatchObject({
      model: 'opus',
      effort: null,
      repeats: 1,
      state: 'finished',
      rewardsStrongerModel: true,
      worse: [],
    });
    expect(health.sanity?.againstReplayId?.value).toBe('replay_live');
    expect(health.sanity?.gain?.verdict).toBe('better');
  });

  it('says a set does not reward a stronger model when it does no better, and names the tasks it did worse on', () => {
    const stronger = strongerOf('opus');
    const sanity = setHealthOf(
      [
        plainly('replay_live', PLAIN, ['original_0']),
        plainly('replay_stronger', stronger, ['original_3', 'original_4']),
      ],
      [PLAIN, stronger],
      FINGERPRINT,
      MIN_GAIN,
    ).sanity;

    expect(sanity?.rewardsStrongerModel).toBe(false);
    expect(
      sanity?.worse.map((each) => [
        each.taskId.value,
        each.live,
        each.stronger,
      ]),
    ).toEqual([
      ['task_3', 1, 0],
      ['task_4', 1, 0],
    ]);
  });

  it('holds back its verdict on a stronger model until its replay finishes, and reads only one based on the live config as it is now', () => {
    const stronger = strongerOf('opus');
    const underway = started(
      'replay_stronger',
      stronger,
      1,
      false,
      null,
      'replay_live',
    );

    expect(
      setHealthOf(
        [plainly('replay_live', PLAIN, []), underway],
        [PLAIN, stronger],
        FINGERPRINT,
        MIN_GAIN,
      ).sanity,
    ).toMatchObject({
      state: 'running',
      gain: null,
      rewardsStrongerModel: null,
    });
    expect(
      setHealthOf(
        [plainly('replay_stronger', stronger, [])],
        [stronger],
        LIVE_FINGERPRINT,
        MIN_GAIN,
      ).sanity,
    ).toBeNull();
  });

  it('says the replay a stronger model was compared with stopped, rather than waiting on it for ever', () => {
    const stronger = strongerOf('opus');
    const stoppedLive = started('replay_live', PLAIN, 1).stopped(later(1), BY);
    const sanity = setHealthOf(
      [stoppedLive, plainly('replay_stronger', stronger, [])],
      [PLAIN, stronger],
      FINGERPRINT,
      MIN_GAIN,
    ).sanity;

    expect(sanity).toMatchObject({
      againstState: 'stopped',
      gain: null,
      rewardsStrongerModel: null,
    });
    expect(
      setHealthOf(
        [plainly('replay_stronger', stronger, [])],
        [stronger],
        FINGERPRINT,
        MIN_GAIN,
      ).sanity?.againstState,
    ).toBe('gone');
  });
});
