import {
  aReplay,
  BY,
  FINGERPRINT,
  later,
  runIds,
} from '@replays/domain/replays.fake-spec';
import {
  dispatchedInTurn,
  REPLAY_RUNS_AT_ONCE,
  roomAmong,
} from '@replays/domain/services/replay-dispatch';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

describe('dispatchedInTurn', () => {
  it(`runs at most ${REPLAY_RUNS_AT_ONCE} of a team’s replay runs at once, the oldest replay first`, () => {
    const older = aReplay({ id: 'replay_a', count: 1 });
    const newer = aReplay({ id: 'replay_b', count: 3, at: later(1) });

    const changed = dispatchedInTurn([newer, older], runIds());

    expect(changed.map((each) => each.id.value)).toEqual([
      'replay_a',
      'replay_b',
    ]);
    expect(changed.flatMap((each) => each.occupying)).toHaveLength(
      REPLAY_RUNS_AT_ONCE,
    );
    expect(roomAmong(changed)).toBe(0);
  });

  it('counts runs still in flight against the room, though their replay stopped, until Work says one never was queued', () => {
    const waiting = aReplay({ id: 'replay_b', count: 3, at: later(2) });
    const neverQueued = aReplay({ id: 'replay_a', count: 1 })
      .reserving(1, runIds())
      .stopped(later(1), BY);
    const stillRunning = aReplay({ id: 'replay_c', count: 1 })
      .reserving(1, runIds())
      .confirmed(RunId.of('replay_run_0'), FINGERPRINT, later(1))
      .stopped(later(2), BY);

    expect(roomAmong([neverQueued, waiting])).toBe(REPLAY_RUNS_AT_ONCE - 1);
    expect(
      roomAmong([
        neverQueued.forgone(RunId.of('replay_run_0'), later(2)),
        waiting,
      ]),
    ).toBe(REPLAY_RUNS_AT_ONCE);
    expect(roomAmong([stillRunning, waiting])).toBe(REPLAY_RUNS_AT_ONCE - 1);
    expect(
      dispatchedInTurn([stillRunning, waiting], runIds()).flatMap(
        (each) => each.occupying,
      ),
    ).toHaveLength(REPLAY_RUNS_AT_ONCE - 1);
  });

  it('gives out nothing when the team’s runners are taken', () => {
    const full = aReplay({ count: 5 }).reserving(REPLAY_RUNS_AT_ONCE, runIds());

    expect(
      dispatchedInTurn([full, aReplay({ id: 'replay_b' })], runIds()),
    ).toEqual([]);
  });
});
