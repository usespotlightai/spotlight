import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const REPLAY_RUNS_AT_ONCE = 2;

const inTurn = (one: Replay, other: Replay): number =>
  one.startedAt.getTime() - other.startedAt.getTime() ||
  (one.id.value < other.id.value ? -1 : one.id.value > other.id.value ? 1 : 0);

export const freeSlotsAmong = (
  replays: readonly Replay[],
  atOnce = REPLAY_RUNS_AT_ONCE,
): readonly number[] => {
  const occupying = replays.flatMap((each) => each.occupying);
  const taken = new Set(occupying.map((each) => each.slot));
  const room = Math.max(0, atOnce - occupying.length);

  return Array.from({ length: atOnce }, (_, slot) => slot)
    .filter((slot) => !taken.has(slot))
    .slice(0, room);
};

export const dispatchedInTurn = (
  replays: readonly Replay[],
  runIds: () => RunId,
  concurrencyOf: (searchId: SearchId) => number,
): readonly Replay[] => {
  const free = new Map<string, number[]>();

  for (const replay of replays) {
    const pool = replay.dispatchPool;

    if (!free.has(pool.value)) {
      free.set(pool.value, [
        ...freeSlotsAmong(
          replays.filter((each) => each.dispatchPool.equals(pool)),
          replay.searchId
            ? concurrencyOf(replay.searchId)
            : REPLAY_RUNS_AT_ONCE,
        ),
      ]);
    }
  }

  const changed: Replay[] = [];

  for (const replay of [...replays].sort(inTurn)) {
    const slots = free.get(replay.dispatchPool.value) ?? [];

    if (slots.length === 0) {
      continue;
    }

    const reserved = replay.reserving(slots, runIds);

    if (reserved !== replay) {
      const taken = reserved.occupying.length - replay.occupying.length;

      free.set(replay.dispatchPool.value, slots.slice(taken));
      changed.push(reserved);
    }
  }

  return changed;
};
