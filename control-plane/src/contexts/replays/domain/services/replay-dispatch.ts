import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const REPLAY_RUNS_AT_ONCE = 2;

const inTurn = (one: Replay, other: Replay): number =>
  one.startedAt.getTime() - other.startedAt.getTime() ||
  (one.id.value < other.id.value ? -1 : one.id.value > other.id.value ? 1 : 0);

export const roomAmong = (replays: readonly Replay[]): number =>
  Math.max(
    0,
    REPLAY_RUNS_AT_ONCE -
      replays.reduce((taken, each) => taken + each.occupying.length, 0),
  );

export const dispatchedInTurn = (
  replays: readonly Replay[],
  runIds: () => RunId,
): readonly Replay[] => {
  let room = roomAmong(replays);
  const changed: Replay[] = [];

  for (const replay of [...replays].sort(inTurn)) {
    if (room === 0) {
      break;
    }

    const reserved = replay.reserving(room, runIds);

    if (reserved !== replay) {
      room -= reserved.occupying.length - replay.occupying.length;
      changed.push(reserved);
    }
  }

  return changed;
};
