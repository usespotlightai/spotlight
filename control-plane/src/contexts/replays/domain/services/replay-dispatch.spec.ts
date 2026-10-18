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
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const NO_SEARCHES = () => 0;

const SEARCH = SearchId.of('search_1');

describe('dispatchedInTurn', () => {
  it(`runs at most ${REPLAY_RUNS_AT_ONCE} of a team’s replay runs at once, the oldest replay first`, () => {
    const older = aReplay({ id: 'replay_a', count: 1 });
    const newer = aReplay({ id: 'replay_b', count: 3, at: later(1) });

    const changed = dispatchedInTurn([newer, older], runIds(), NO_SEARCHES);

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
      .stop(later(1), BY);
    const stillRunning = aReplay({ id: 'replay_c', count: 1 })
      .reserving(1, runIds())
      .confirm(RunId.of('replay_run_0'), FINGERPRINT, later(1))
      .stop(later(2), BY);

    expect(roomAmong([neverQueued, waiting])).toBe(REPLAY_RUNS_AT_ONCE - 1);
    expect(
      roomAmong([
        neverQueued.cancel(RunId.of('replay_run_0'), later(2)),
        waiting,
      ]),
    ).toBe(REPLAY_RUNS_AT_ONCE);
    expect(roomAmong([stillRunning, waiting])).toBe(REPLAY_RUNS_AT_ONCE - 1);
    expect(
      dispatchedInTurn([stillRunning, waiting], runIds(), NO_SEARCHES).flatMap(
        (each) => each.occupying,
      ),
    ).toHaveLength(REPLAY_RUNS_AT_ONCE - 1);
  });

  it('hands out nothing when the team’s runners are taken', () => {
    const full = aReplay({ count: 5 }).reserving(REPLAY_RUNS_AT_ONCE, runIds());

    expect(
      dispatchedInTurn(
        [full, aReplay({ id: 'replay_b' })],
        runIds(),
        NO_SEARCHES,
      ),
    ).toEqual([]);
  });

  it('runs a search’s replays at its own concurrency, beside the team’s replays', () => {
    const team = aReplay({ id: 'replay_team', count: 5 });
    const searched = aReplay({
      id: 'replay_search',
      count: 6,
      searchId: SEARCH,
      at: later(1),
    });

    const changed = dispatchedInTurn([searched, team], runIds(), (id) =>
      id.equals(SEARCH) ? 4 : 0,
    );
    const occupied = (id: string) =>
      changed.find((each) => each.id.value === id)?.occupying.length;

    expect(occupied('replay_team')).toBe(REPLAY_RUNS_AT_ONCE);
    expect(occupied('replay_search')).toBe(4);
  });

  it('counts a search’s runs in flight against its own concurrency only', () => {
    const searching = aReplay({
      id: 'replay_search',
      count: 6,
      searchId: SEARCH,
    }).reserving(3, runIds());
    const team = aReplay({ id: 'replay_team', count: 5, at: later(1) });

    const changed = dispatchedInTurn([searching, team], runIds(), () => 4);

    expect(
      changed.find((each) => each.id.value === 'replay_search')?.occupying,
    ).toHaveLength(4);
    expect(
      changed.find((each) => each.id.value === 'replay_team')?.occupying,
    ).toHaveLength(REPLAY_RUNS_AT_ONCE);
  });

  it('hands a search no runs once it has no room, as when it has ended', () => {
    const searched = aReplay({ count: 3, searchId: SEARCH });

    expect(dispatchedInTurn([searched], runIds(), NO_SEARCHES)).toEqual([]);
  });
});
