import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { ReplayState } from '@replays/domain/value-objects/replay-state';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const STANDING_BASELINE_STATES = [
  'queued',
  'running',
  'finished',
] as const satisfies readonly ReplayState[];

const STANDS: readonly string[] = STANDING_BASELINE_STATES;

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
    .filter((each) => each.baseline && STANDS.includes(each.current))
    .sort(newestFirst)[0] ?? null;

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
    matching.find((each) => STANDS.includes(each.current)) ??
    matching[0] ??
    null
  );
};

export const needsBaseline = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: string,
  repeats: number,
): boolean =>
  !baselineFor(
    replays.filter((each) => STANDS.includes(each.current)),
    liveScoring,
    set.runs,
    repeats,
  );
