import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const VALID_BASELINE_STATES = [
  'queued',
  'running',
  'finished',
] as const satisfies readonly ReplayState[];

const VALID: readonly string[] = VALID_BASELINE_STATES;

const newestFirst = (one: Replay, other: Replay): number =>
  other.startedAt.getTime() - one.startedAt.getTime();

const covers = (
  baseline: Replay,
  runs: readonly RunId[],
  repeats: number,
): boolean =>
  baseline.repeats >= repeats &&
  runs.every((run) => baseline.originals.some((each) => each.equals(run)));

export const baselineOf = (replays: readonly Replay[]): Replay | null =>
  [...replays]
    .filter((each) => each.baseline && VALID.includes(each.current))
    .sort(newestFirst)[0] ?? null;

export const comparedAgainst = (
  replay: Replay,
  setReplays: readonly Replay[],
): Replay | null => {
  const counterpart = replay.counterpart;
  const against = counterpart
    ? (setReplays.find((each) => each.id.equals(counterpart)) ?? null)
    : baselineOf(setReplays);

  return against && !against.id.equals(replay.id) ? against : null;
};

export const baselineFor = (
  replays: readonly Replay[],
  liveScoring: string,
  runs: readonly RunId[],
  repeats: number,
): Replay | null => {
  const matching = [...replays]
    .filter(
      (each) =>
        each.baseline &&
        each.scoringDigest === liveScoring &&
        covers(each, runs, repeats),
    )
    .sort(newestFirst);

  return (
    matching.find((each) => each.current === 'finished') ??
    matching.find((each) => VALID.includes(each.current)) ??
    matching[0] ??
    null
  );
};

export const currentBaselineFor = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: string,
  repeats: number,
): Replay | null =>
  baselineFor(
    replays.filter((each) => VALID.includes(each.current)),
    liveScoring,
    set.runs,
    repeats,
  );

export const needsBaseline = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: string,
  repeats: number,
): boolean => !currentBaselineFor(set, replays, liveScoring, repeats);
