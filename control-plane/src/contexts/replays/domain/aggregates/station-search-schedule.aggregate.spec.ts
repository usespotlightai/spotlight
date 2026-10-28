import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import {
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  NOW,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { StationFingerprint } from '@replays/domain/value-objects/station-fingerprint.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const created = () =>
  StationSearchSchedule.create({
    station: STATION,
    setId: ReplaySetId.of('set_1'),
    at: NOW,
  });

const OTHER = StationFingerprint.of('c'.repeat(64));

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

  it('restarts the cooldown when a config is rejected, and remembers each rejected config once', () => {
    const started = created().started({
      searched: tasks('a'),
      inSet: tasks('a'),
      at: NOW,
      cooldownMilliseconds: 10,
    });
    const rejected = started
      .configRejected(FINGERPRINT, LIVE_FINGERPRINT, later(8))
      .configRejected(FINGERPRINT, LIVE_FINGERPRINT, later(9))
      .configRejected(OTHER, LIVE_FINGERPRINT, later(5));

    expect(rejected.rejected).toEqual([FINGERPRINT, OTHER]);
    expect(rejected.rejectedAgainst).toEqual(LIVE_FINGERPRINT);
    expect(rejected.lastRejectedAt).toEqual(later(9));
    expect(rejected.cooldownFrom).toEqual(later(9));
    expect(() =>
      rejected.started({
        searched: tasks('a'),
        inSet: tasks('a'),
        at: later(18),
        cooldownMilliseconds: 10,
      }),
    ).toThrow(SearchInCooldownError);
    expect(
      rejected.started({
        searched: tasks('a'),
        inSet: tasks('a'),
        at: later(19),
        cooldownMilliseconds: 10,
      }).lastStartedAt,
    ).toEqual(later(19));
  });

  it('forgets rejected configs once the live config of the station changes', () => {
    const rejected = created().configRejected(
      FINGERPRINT,
      LIVE_FINGERPRINT,
      later(8),
    );

    expect(rejected.liveChanged(LIVE_FINGERPRINT)).toBe(rejected);
    expect(rejected.liveChanged(OTHER)).toMatchObject({
      rejected: [],
      rejectedAgainst: null,
      lastRejectedAt: later(8),
    });
    expect(rejected.configRejected(OTHER, OTHER, later(9)).rejected).toEqual([
      OTHER,
    ]);
  });

  it('forgets a rejection when its pull request reopens, and keeps the cooldown', () => {
    const reopened = created()
      .configRejected(FINGERPRINT, LIVE_FINGERPRINT, later(8))
      .configReopened(FINGERPRINT);

    expect(reopened).toMatchObject({
      rejected: [],
      rejectedAgainst: null,
      lastRejectedAt: later(8),
    });
    expect(reopened.hasRejected(FINGERPRINT)).toBe(false);
  });

  it('keeps the latest time a merged pull request improved the station', () => {
    expect(
      created().improved(later(9)).improved(later(5)).lastImprovedAt,
    ).toEqual(later(9));
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
        rejected: [],
        rejectedAgainst: null,
        lastRejectedAt: null,
        lastImprovedAt: null,
        checkAfter: NOW,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});
