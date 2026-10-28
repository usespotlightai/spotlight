import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import { later, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const created = () =>
  StationSearchSchedule.create({
    station: STATION,
    setId: ReplaySetId.of('set_1'),
    at: NOW,
  });

const tasks = (...names: string[]) => names.map((each) => TaskId.of(each));

describe('StationSearchSchedule', () => {
  it('is due at once when created, with nothing searched yet', () => {
    const schedule = created();

    expect(schedule.isDue(NOW)).toBe(true);
    expect(schedule.lastStartedAt).toBeNull();
    expect(schedule.searchedTasks).toEqual([]);
  });

  it('records a skip reason once per change of reason, keeping when it first skipped', () => {
    const once = created().skipped('set-too-small', NOW, later(10));
    const twice = once.skipped('set-too-small', later(10), later(20));
    const changed = twice.skipped('no-scoring', later(20), later(30));
    const events = changed.pullEvents();

    expect(twice.lastSkip).toEqual({ reason: 'set-too-small', at: NOW });
    expect(twice.checkAfter).toEqual(later(20));
    expect(events).toEqual([
      new StationSearchSkipped(
        STATION.workspaceId,
        STATION.teamId,
        STATION.lineId,
        STATION.stationId,
        'set-too-small',
        NOW,
      ),
      new StationSearchSkipped(
        STATION.workspaceId,
        STATION.teamId,
        STATION.lineId,
        STATION.stationId,
        'no-scoring',
        later(20),
      ),
    ]);
  });

  it('keeps the first alert and looks at once when one fires', () => {
    const waiting = created().postponed(later(100));
    const alerted = waiting.alerted(later(5)).alerted(later(6));

    expect(alerted.alertPendingSince).toEqual(later(5));
    expect(alerted.checkAfter).toEqual(later(5));
  });

  it('on start, clears the skip and the alert, and keeps each searched task once while it is in the set', () => {
    const started = created()
      .skipped('cooldown', NOW, later(1))
      .alerted(later(1))
      .started({
        searched: tasks('a', 'b', 'gone'),
        inSet: tasks('a', 'b', 'c', 'gone'),
        at: later(2),
        cooldownMilliseconds: 10,
      })
      .started({
        searched: tasks('b', 'c', 'c'),
        inSet: tasks('a', 'b', 'c'),
        at: later(20),
        cooldownMilliseconds: 10,
      });

    expect(started.lastSkip).toBeNull();
    expect(started.alertPendingSince).toBeNull();
    expect(started.lastStartedAt).toEqual(later(20));
    expect(started.checkAfter).toEqual(later(30));
    expect(started.searchedTasks).toEqual(tasks('a', 'b', 'c'));
  });

  it('refuses a start inside the cooldown of the last one', () => {
    const started = created().started({
      searched: tasks('a'),
      inSet: tasks('a'),
      at: NOW,
      cooldownMilliseconds: 10,
    });

    expect(() =>
      started.started({
        searched: tasks('a'),
        inSet: tasks('a'),
        at: later(9),
        cooldownMilliseconds: 10,
      }),
    ).toThrow(SearchInCooldownError);
  });

  it('rejects a stored schedule that records a searched task twice', () => {
    expect(() =>
      StationSearchSchedule.rehydrate({
        station: STATION,
        setId: ReplaySetId.of('set_1'),
        lastStartedAt: null,
        lastSkip: null,
        searchedTasks: tasks('a', 'a'),
        alertPendingSince: null,
        checkAfter: NOW,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});
