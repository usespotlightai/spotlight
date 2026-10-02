import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { ReplaySet } from '@replays/domain/aggregates/replay-set.aggregate';

const STANDS: readonly string[] = ['queued', 'running', 'finished'];

export const baselineOf = (replays: readonly Replay[]): Replay | null =>
  [...replays]
    .filter((each) => each.baseline && STANDS.includes(each.current))
    .sort(
      (one, other) => other.startedAt.getTime() - one.startedAt.getTime(),
    )[0] ?? null;

export const needsBaseline = (
  set: ReplaySet,
  replays: readonly Replay[],
): boolean => {
  const baseline = baselineOf(replays);

  return (
    !baseline ||
    !set.runs.every((run) =>
      baseline.originals.some((each) => each.equals(run)),
    )
  );
};
