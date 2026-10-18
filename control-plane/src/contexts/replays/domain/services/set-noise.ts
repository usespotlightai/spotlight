import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import { repeatsByOriginal } from '@replays/domain/services/replay-results';
import type { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import type { ReplayId } from '@replays/domain/value-objects/replay-id.vo';
import { MAX_REPEATS } from '@replays/domain/value-objects/replay-repeats';
import type { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';

const ROUNDING = 1e-9;

const ONE_REPEAT = 1;

export interface SetNoise {
  readonly replayId: ReplayId;
  readonly fingerprint: StationFingerprint;
  readonly repeats: number;
  readonly perRepeat: readonly number[];
  readonly spread: number;
  readonly flippedTasks: readonly string[];
  readonly measuredAt: Date;
}

export interface SetNoiseReading extends SetNoise {
  readonly noisyInOneRepeat: boolean;
}

export const neededRepeatsFor = (spread: number, minGain: number): number =>
  Math.max(1, Math.ceil((spread / minGain) ** 2 - ROUNDING));

export const suggestedRepeatsFor = (spread: number, minGain: number): number =>
  Math.min(MAX_REPEATS, neededRepeatsFor(spread, minGain));

export const isNoisyAt = (
  spread: number,
  minGain: number,
  repeats: number,
): boolean => neededRepeatsFor(spread, minGain) > repeats;

export const noiseReadingOf = (
  noise: SetNoise,
  minGain: number,
): SetNoiseReading => ({
  ...noise,
  noisyInOneRepeat: isNoisyAt(noise.spread, minGain, ONE_REPEAT),
});

export interface ReplayedConfig {
  readonly id: CandidateId;
  readonly isLive: boolean;
  readonly fingerprint: StationFingerprint;
}

const newestFirst = (one: Replay, other: Replay): number =>
  (other.endedAt?.getTime() ?? 0) - (one.endedAt?.getTime() ?? 0);

const rateOfRepeat = (replay: Replay, repeat: number): number | null => {
  const judged = replay.entries.filter(
    (each) =>
      each.repeat === repeat &&
      each.hasEnded &&
      each.concludedFor(replay.scoring) &&
      each.succeeded !== null,
  );

  return judged.length === 0
    ? null
    : judged.filter((each) => each.succeeded).length / judged.length;
};

const flippedIn = (replay: Replay): readonly string[] => [
  ...new Set(
    [...repeatsByOriginal(replay.entries).values()].flatMap((repeats) => {
      const verdicts = new Set(
        repeats
          .filter(
            (each) =>
              each.hasEnded &&
              each.concludedFor(replay.scoring) &&
              each.succeeded !== null,
          )
          .map((each) => each.succeeded),
      );
      const [first] = repeats;

      return verdicts.size > 1 && first ? [first.taskId.value] : [];
    }),
  ),
];

const noiseIn = (
  replay: Replay,
  fingerprint: StationFingerprint,
): SetNoise | null => {
  const perRepeat = Array.from(
    { length: replay.repeats },
    (_, index) => index + 1,
  ).flatMap((repeat) => {
    const rate = rateOfRepeat(replay, repeat);

    return rate === null ? [] : [rate];
  });

  if (perRepeat.length < 2 || !replay.endedAt) {
    return null;
  }

  return {
    replayId: replay.id,
    fingerprint,
    repeats: replay.repeats,
    perRepeat,
    spread: Math.max(...perRepeat) - Math.min(...perRepeat),
    flippedTasks: flippedIn(replay),
    measuredAt: replay.endedAt,
  };
};

export const setNoiseOf = (
  replays: readonly Replay[],
  configs: readonly ReplayedConfig[],
  liveFingerprint: StationFingerprint,
): SetNoise | null => {
  for (const replay of [...replays].sort(newestFirst)) {
    const config = configs.find((each) => each.id.equals(replay.candidateId));

    if (
      replay.current !== 'finished' ||
      replay.repeats < 2 ||
      !config?.isLive ||
      !config.fingerprint.equals(liveFingerprint)
    ) {
      continue;
    }

    const noise = noiseIn(replay, config.fingerprint);

    if (noise) {
      return noise;
    }
  }

  return null;
};
