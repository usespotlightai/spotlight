import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import {
  type GainReading,
  gainBetween,
} from '@replays/domain/services/gain-reading';
import {
  taskSuccessesOf,
  totalsOf,
} from '@replays/domain/services/replay-results';
import {
  type ReplayedConfig,
  type SetNoise,
  setNoiseOf,
} from '@replays/domain/services/set-noise';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { StationBlock } from '@replays/domain/value-objects/station-block.vo';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const SATURATED_ABOVE = 0.95;

export const JUDGE_UNSTABLE_BELOW = 0.8;

export interface HealthConfig extends ReplayedConfig {
  readonly isSanity: boolean;
  readonly basedOn: StationFingerprint;
  readonly block: StationBlock;
}

interface SetSaturation {
  readonly replayId: ReplayId;
  readonly rate: number;
  readonly interval: RateInterval | null;
  readonly saturated: boolean;
  readonly measuredAt: Date;
}

interface JudgeConsistency {
  readonly replayId: ReplayId;
  readonly compared: number;
  readonly agreed: number;
  readonly pending: number;
  readonly agreement: number | null;
  readonly unstable: boolean;
}

interface FlakyCheck {
  readonly taskId: TaskId;
  readonly original: RunId;
  readonly run: RunId;
  readonly first: ChecksState;
  readonly recheck: ChecksState;
}

interface CheckConsistency {
  readonly replayId: ReplayId;
  readonly rechecked: number;
  readonly pending: number;
  readonly flaky: readonly FlakyCheck[];
}

interface WorseTask {
  readonly taskId: TaskId;
  readonly original: RunId;
  readonly live: number;
  readonly stronger: number;
}

interface SanityReading {
  readonly replayId: ReplayId;
  readonly candidateId: CandidateId;
  readonly model: string | null;
  readonly effort: string | null;
  readonly repeats: number;
  readonly state: ReplayState;
  readonly againstReplayId: ReplayId | null;
  readonly againstState: ReplayState | 'gone' | null;
  readonly gain: GainReading | null;
  readonly rewardsStrongerModel: boolean | null;
  readonly worse: readonly WorseTask[];
}

export interface SetHealth {
  readonly noise: SetNoise | null;
  readonly saturation: SetSaturation | null;
  readonly judge: JudgeConsistency | null;
  readonly checks: CheckConsistency | null;
  readonly sanity: SanityReading | null;
}

export const UNREAD_HEALTH: SetHealth = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  sanity: null,
};

const newestFirst = (one: Replay, other: Replay): number =>
  (other.endedAt ?? other.startedAt).getTime() -
  (one.endedAt ?? one.startedAt).getTime();

const configOf = (
  replay: Replay,
  configs: readonly HealthConfig[],
): HealthConfig | null =>
  configs.find((each) => each.id.equals(replay.candidateId)) ?? null;

const textOf = (held: unknown): string | null =>
  typeof held === 'string' ? held : null;

const STANDING: readonly ReplayState[] = ['queued', 'running', 'finished'];

const isWholeLive = (
  replay: Replay,
  configs: readonly ReplayedConfig[],
  liveFingerprint: StationFingerprint,
): boolean => {
  const config = configs.find((each) => each.id.equals(replay.candidateId));

  return (
    replay.among === null &&
    replay.searchId === null &&
    config?.isLive === true &&
    config.fingerprint.equals(liveFingerprint)
  );
};

export const comparableLiveOf = (
  replays: readonly Replay[],
  configs: readonly ReplayedConfig[],
  liveFingerprint: StationFingerprint,
  repeats: number,
): Replay | null =>
  [...replays]
    .sort(newestFirst)
    .find(
      (each) =>
        STANDING.includes(each.current) &&
        each.repeats >= repeats &&
        isWholeLive(each, configs, liveFingerprint),
    ) ?? null;

const saturationOf = (live: readonly Replay[]): SetSaturation | null => {
  for (const replay of live) {
    const totals = totalsOf(replay);

    if (totals.successRate !== null && replay.endedAt) {
      return {
        replayId: replay.id,
        rate: totals.successRate,
        interval: totals.interval,
        saturated: totals.successRate > SATURATED_ABOVE,
        measuredAt: replay.endedAt,
      };
    }
  }

  return null;
};

const judgeOf = (probe: Replay): JudgeConsistency | null => {
  const asked = probe.entries.filter((each) => each.secondJudging !== null);

  if (asked.length === 0) {
    return null;
  }

  const compared = asked.filter((each) => each.judgeAgreed !== null);
  const agreed = compared.filter((each) => each.judgeAgreed).length;
  const agreement = compared.length > 0 ? agreed / compared.length : null;

  return {
    replayId: probe.id,
    compared: compared.length,
    agreed,
    pending: asked.filter((each) => each.secondJudging?.pending).length,
    agreement,
    unstable: agreement !== null && agreement < JUDGE_UNSTABLE_BELOW,
  };
};

const checksOf = (probe: Replay): CheckConsistency | null => {
  const asked = probe.entries.filter((each) => each.recheck !== null);

  if (asked.length === 0) {
    return null;
  }

  return {
    replayId: probe.id,
    rechecked: asked.filter((each) => each.checksFlipped !== null).length,
    pending: asked.filter((each) => each.recheck?.pending).length,
    flaky: asked.flatMap((each) =>
      each.checksFlipped && each.run && each.checks && each.recheck
        ? [
            {
              taskId: each.taskId,
              original: each.original,
              run: each.run,
              first: each.checks.state,
              recheck: each.recheck.state,
            },
          ]
        : [],
    ),
  };
};

const worseTasksOf = (stronger: Replay, live: Replay): readonly WorseTask[] => {
  const theirs = taskSuccessesOf(live);

  return [...taskSuccessesOf(stronger)].flatMap(([original, success]) => {
    const against = theirs.get(original);
    const entry = stronger.entries.find(
      (each) => each.original.value === original,
    );

    return against !== undefined && success < against && entry
      ? [
          {
            taskId: entry.taskId,
            original: entry.original,
            live: against,
            stronger: success,
          },
        ]
      : [];
  });
};

const sanityOf = (
  sanity: Replay,
  config: HealthConfig,
  replays: readonly Replay[],
  minGain: number,
): SanityReading => {
  const against = sanity.comparedWith
    ? (replays.find((each) => sanity.comparedWith?.equals(each.id)) ?? null)
    : null;
  const compared =
    against?.current === 'finished' && sanity.current === 'finished'
      ? against
      : null;
  const gain = compared && gainBetween(sanity, compared, minGain);

  return {
    replayId: sanity.id,
    candidateId: config.id,
    model: textOf(config.block.value.model),
    effort: textOf(config.block.value.effort),
    repeats: sanity.repeats,
    state: sanity.current,
    againstReplayId: sanity.comparedWith,
    againstState: sanity.comparedWith ? (against?.current ?? 'gone') : null,
    gain,
    rewardsStrongerModel: gain ? gain.verdict === 'better' : null,
    worse: compared ? worseTasksOf(sanity, compared) : [],
  };
};

export const setHealthOf = (
  replays: readonly Replay[],
  configs: readonly HealthConfig[],
  liveFingerprint: StationFingerprint,
  minGain: number,
): SetHealth => {
  const newest = [...replays].sort(newestFirst);
  const live = newest.filter(
    (each) =>
      each.current === 'finished' &&
      isWholeLive(each, configs, liveFingerprint),
  );
  const probe = live.find((each) => each.probe) ?? null;
  const sanity =
    newest.flatMap((each) => {
      const config = configOf(each, configs);

      return config?.isSanity && config.basedOn.equals(liveFingerprint)
        ? [{ replay: each, config }]
        : [];
    })[0] ?? null;

  return {
    noise: setNoiseOf(replays, configs, liveFingerprint),
    saturation: saturationOf(live),
    judge: probe && judgeOf(probe),
    checks: probe && checksOf(probe),
    sanity: sanity && sanityOf(sanity.replay, sanity.config, replays, minGain),
  };
};
