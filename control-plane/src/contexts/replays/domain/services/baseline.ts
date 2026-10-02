import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const STANDS: readonly string[] = ['queued', 'running', 'finished'];

const newestFirst = (one: Replay, other: Replay): number =>
  other.startedAt.getTime() - one.startedAt.getTime();

const covers = (baseline: Replay, runs: readonly RunId[]): boolean =>
  runs.every((run) => baseline.originals.some((each) => each.equals(run)));

export const baselineOf = (replays: readonly Replay[]): Replay | null =>
  [...replays]
    .filter((each) => each.baseline && STANDS.includes(each.current))
    .sort(newestFirst)[0] ?? null;

export const needsBaseline = (
  set: ReplaySet,
  replays: readonly Replay[],
  liveScoring: string,
): boolean => {
  const baseline = baselineOf(
    replays.filter((each) => each.scoringDigest === liveScoring),
  );

  return !baseline || !covers(baseline, set.runs);
};

export const baselineFor = (
  replays: readonly Replay[],
  liveScoring: string,
  runs: readonly RunId[],
): Replay | null => {
  const matching = [...replays]
    .filter(
      (each) =>
        each.baseline &&
        each.scoringDigest === liveScoring &&
        covers(each, runs),
    )
    .sort(newestFirst);

  return (
    matching.find((each) => each.current === 'finished') ??
    matching.find((each) => STANDS.includes(each.current)) ??
    matching[0] ??
    null
  );
};
