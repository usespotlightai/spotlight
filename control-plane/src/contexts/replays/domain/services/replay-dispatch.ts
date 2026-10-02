import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const REPLAY_RUNS_AT_ONCE = 2;

const TEAM_POOL = '';

const inTurn = (one: Replay, other: Replay): number =>
  one.startedAt.getTime() - other.startedAt.getTime() ||
  (one.id.value < other.id.value ? -1 : one.id.value > other.id.value ? 1 : 0);

const poolOf = (replay: Replay): string => replay.searchId?.value ?? TEAM_POOL;

export const roomAmong = (
  replays: readonly Replay[],
  atOnce = REPLAY_RUNS_AT_ONCE,
): number =>
  Math.max(
    0,
    atOnce - replays.reduce((taken, each) => taken + each.occupying.length, 0),
  );

export const dispatchedInTurn = (
  replays: readonly Replay[],
  runIds: () => RunId,
  concurrencyOf: (searchId: SearchId) => number,
): readonly Replay[] => {
  const room = new Map<string, number>();

  for (const replay of replays) {
    const pool = poolOf(replay);

    if (!room.has(pool)) {
      room.set(
        pool,
        roomAmong(
          replays.filter((each) => poolOf(each) === pool),
          replay.searchId
            ? concurrencyOf(replay.searchId)
            : REPLAY_RUNS_AT_ONCE,
        ),
      );
    }
  }

  const changed: Replay[] = [];

  for (const replay of [...replays].sort(inTurn)) {
    const pool = poolOf(replay);
    const left = room.get(pool) ?? 0;

    if (left === 0) {
      continue;
    }

    const reserved = replay.reserving(left, runIds);

    if (reserved !== replay) {
      room.set(
        pool,
        left - (reserved.occupying.length - replay.occupying.length),
      );
      changed.push(reserved);
    }
  }

  return changed;
};
