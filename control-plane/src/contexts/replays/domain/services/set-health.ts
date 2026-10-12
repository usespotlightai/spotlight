import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { RateInterval } from '@replays/domain/services/bootstrap';
import {
  FEWEST_PAIRED_TASKS,
  type GainReading,
  gainBetween,
} from '@replays/domain/services/gain-reading';
import { totalsOf } from '@replays/domain/services/replay-results';
import {
  noiseReadingOf,
  type ReplayedConfig,
  type SetNoiseReading,
  setNoiseOf,
} from '@replays/domain/services/set-noise';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ChecksState } from '@replays/domain/value-objects/change-checks.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

export const SATURATED_ABOVE = 0.95;

export const JUDGE_UNSTABLE_BELOW = 0.8;

export interface HealthConfig extends ReplayedConfig {
  readonly isOracle: boolean;
  readonly basedOn: StationFingerprint;
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

interface OracleReading {
  readonly replayId: ReplayId;
  readonly candidateId: CandidateId;
  readonly repeats: number;
  readonly state: ReplayState;
  readonly againstReplayId: ReplayId | null;
  readonly againstState: ReplayState | 'gone' | null;
  readonly answered: number;
  readonly live: number | null;
  readonly withAnswer: number | null;
  readonly gain: GainReading | null;
  readonly roomToImprove: boolean | null;
}

export interface SetHealth {
  readonly noise: SetNoiseReading | null;
  readonly saturation: SetSaturation | null;
  readonly judge: JudgeConsistency | null;
  readonly checks: CheckConsistency | null;
  readonly oracle: OracleReading | null;
}

export const UNREAD_HEALTH: SetHealth = {
  noise: null,
  saturation: null,
  judge: null,
  checks: null,
  oracle: null,
};

const newestFirst = (one: Replay, other: Replay): number =>
  (other.endedAt ?? other.startedAt).getTime() -
  (one.endedAt ?? one.startedAt).getTime();

const configOf = (
  replay: Replay,
  configs: readonly HealthConfig[],
): HealthConfig | null =>
  configs.find((each) => each.id.equals(replay.candidateId)) ?? null;

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

const PROBE_STANDING: readonly ReplayState[] = [
  'queued',
  'running',
  'finished',
];

export const checksSet = (
  set: ReplaySet,
  replays: readonly Replay[],
  configs: readonly ReplayedConfig[],
  liveFingerprint: StationFingerprint,
): boolean =>
  set.entries.length >= FEWEST_PAIRED_TASKS &&
  !replays.some(
    (each) =>
      each.probe &&
      PROBE_STANDING.includes(each.current) &&
      isWholeLive(each, configs, liveFingerprint),
  );

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

const oracleOf = (
  oracle: Replay,
  config: HealthConfig,
  replays: readonly Replay[],
  minGain: number,
): OracleReading => {
  const against = oracle.comparedWith
    ? (replays.find((each) => oracle.comparedWith?.equals(each.id)) ?? null)
    : null;
  const compared =
    against?.current === 'finished' && oracle.current === 'finished'
      ? against
      : null;
  const answered = oracle.among ?? null;
  const gain = compared && gainBetween(oracle, compared, minGain, answered);

  return {
    replayId: oracle.id,
    candidateId: config.id,
    repeats: oracle.repeats,
    state: oracle.current,
    againstReplayId: oracle.comparedWith,
    againstState: oracle.comparedWith ? (against?.current ?? 'gone') : null,
    answered:
      answered?.length ??
      new Set(oracle.entries.map((each) => each.original.value)).size,
    live: compared ? totalsOf(compared, answered).successRate : null,
    withAnswer: compared ? totalsOf(oracle, answered).successRate : null,
    gain,
    roomToImprove:
      gain && gain.tasks >= FEWEST_PAIRED_TASKS
        ? gain.verdict === 'better'
        : null,
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
  const oracle =
    newest.flatMap((each) => {
      const config = configOf(each, configs);

      return config?.isOracle && config.basedOn.equals(liveFingerprint)
        ? [{ replay: each, config }]
        : [];
    })[0] ?? null;

  const noise = setNoiseOf(replays, configs, liveFingerprint);

  return {
    noise: noise && noiseReadingOf(noise, minGain),
    saturation: saturationOf(live),
    judge: probe && judgeOf(probe),
    checks: probe && checksOf(probe),
    oracle: oracle && oracleOf(oracle.replay, oracle.config, replays, minGain),
  };
};
