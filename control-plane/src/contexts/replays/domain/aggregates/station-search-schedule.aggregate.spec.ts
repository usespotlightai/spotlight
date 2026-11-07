import { StationSearchSchedule } from '@replays/domain/aggregates/station-search-schedule.aggregate';
import { StationSearchSkipped } from '@replays/domain/events/station-search-skipped.event';
import { RequestLimitReachedError } from '@replays/domain/exceptions/request-limit-reached.error';
import { SearchInCooldownError } from '@replays/domain/exceptions/search-in-cooldown.error';
import {
  FINGERPRINT,
  LIVE_FINGERPRINT,
  later,
  NOW,
  STATION,
} from '@replays/domain/replays.fake-spec';
import { CandidateId } from '@replays/domain/value-objects/candidate-id.vo';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
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

let starts = 0;

const automatic = () => {
  starts += 1;

  return {
    searchId: SearchId.of(`search_${starts}`),
    request: null,
    candidates: [CandidateId.of(`live_${starts}`)],
  };
};

const SEARCH = SearchId.of('search_running');

const join = (request: string, at: Date) => ({
  searchId: SEARCH,
  request: CandidateId.of(request),
  at,
});

const joinOf = (request: string) => ({
  kind: 'join' as const,
  searchId: SEARCH,
  request: CandidateId.of(request),
});

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
        ...automatic(),
      })
      .started({
        searched: tasks('b', 'c', 'c'),
        inSet: tasks('a', 'b', 'c'),
        at: later(20),
        cooldownMilliseconds: 10,
        ...automatic(),
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
      ...automatic(),
    });

    expect(() =>
      started.started({
        searched: tasks('a'),
        inSet: tasks('a'),
        at: later(9),
        cooldownMilliseconds: 10,
        ...automatic(),
      }),
    ).toThrow(SearchInCooldownError);
  });

  it('restarts the cooldown when a config is rejected, and remembers each rejected config once', () => {
    const started = created().started({
      searched: tasks('a'),
      inSet: tasks('a'),
      at: NOW,
      cooldownMilliseconds: 10,
      ...automatic(),
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
        ...automatic(),
      }),
    ).toThrow(SearchInCooldownError);
    expect(
      rejected.started({
        searched: tasks('a'),
        inSet: tasks('a'),
        at: later(19),
        cooldownMilliseconds: 10,
        ...automatic(),
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

  it('leaves the automatic schedule as it is for a requested start, but counts its searched tasks', () => {
    const before = created()
      .started({
        searched: tasks('a'),
        inSet: tasks('a', 'b', 'c'),
        at: NOW,
        cooldownMilliseconds: 10,
        ...automatic(),
      })
      .alerted(later(1));
    const after = before.started({
      searched: tasks('b'),
      inSet: tasks('a', 'b', 'c'),
      at: later(2),
      cooldownMilliseconds: 1_000,
      searchId: SearchId.of('search_requested'),
      request: CandidateId.of('requested'),
      candidates: [CandidateId.of('live'), CandidateId.of('requested')],
    });

    expect(after.lastStartedAt).toEqual(before.lastStartedAt);
    expect(after.alertPendingSince).toEqual(before.alertPendingSince);
    expect(after.checkAfter).toEqual(before.checkAfter);
    expect(after.searchedTasks.map((each) => each.value)).toEqual(['a', 'b']);
    expect(after.requests).toEqual({
      day: later(2).toISOString().slice(0, 10),
      counted: [CandidateId.of('requested')],
    });
  });

  it('takes 3 requests a station a day, and more the next day', () => {
    const day = new Date('2026-10-29T08:00:00.000Z');
    const nextDay = new Date('2026-10-30T00:00:01.000Z');
    const full = created()
      .requested(join('a', day))
      .requested(join('b', day))
      .requested(join('c', day));

    expect(full.takesRequestOn(day)).toBe(false);
    expect(() => full.requested(join('d', day))).toThrow(
      RequestLimitReachedError,
    );
    expect(full.requested(join('e', nextDay)).requests).toEqual({
      day: '2026-10-30',
      counted: [CandidateId.of('e')],
    });
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
        requests: null,
        pendingSteps: [],
        checkAfter: NOW,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });

  it('withdraws only its own request when another request counted after it', () => {
    const day = new Date('2026-10-29T08:00:00.000Z');
    const countedA = created().requested(join('a', day));
    const countedB = countedA.requested(join('b', day));
    const withdrawnA = countedB.stepWithdrawn(joinOf('a'));

    expect(withdrawnA.requests).toEqual({
      day: '2026-10-29',
      counted: [CandidateId.of('b')],
    });
    expect(withdrawnA.pendingSteps.map((each) => each.request)).toEqual([
      CandidateId.of('b'),
    ]);
    expect(
      withdrawnA
        .requested(join('c', day))
        .requested(join('d', day))
        .takesRequestOn(day),
    ).toBe(false);
  });

  it('keeps an alert and a skip that came after a start it withdraws', () => {
    const before = created().postponed(later(1));
    const start = {
      ...automatic(),
      searched: tasks('a'),
      inSet: tasks('a', 'b'),
    };
    const started = before.started({
      ...start,
      at: later(2),
      cooldownMilliseconds: 100,
    });
    const alerted = started.alerted(later(3));
    const withdrawn = alerted.stepWithdrawn({
      kind: 'start',
      searchId: start.searchId,
      request: null,
    });

    expect(withdrawn.alertPendingSince).toEqual(later(3));
    expect(withdrawn.lastStartedAt).toBeNull();
    expect(withdrawn.searchedTasks).toEqual([]);
    expect(withdrawn.checkAfter).toEqual(later(3));
    expect(withdrawn.pendingSteps).toEqual([]);
  });

  it('restores what a start replaced while nothing else changed it', () => {
    const before = created()
      .skipped('cooldown', NOW, later(1))
      .alerted(later(1));
    const start = { ...automatic(), searched: tasks('a'), inSet: tasks('a') };
    const withdrawn = before
      .started({ ...start, at: later(2), cooldownMilliseconds: 100 })
      .stepWithdrawn({
        kind: 'start',
        searchId: start.searchId,
        request: null,
      });

    expect(withdrawn).toMatchObject({
      lastStartedAt: null,
      lastSkip: before.lastSkip,
      alertPendingSince: later(1),
      checkAfter: before.checkAfter,
      searchedTasks: [],
      pendingSteps: [],
    });
  });

  it('keeps a later start when an earlier start is withdrawn, and undoes a step once', () => {
    const first = {
      ...automatic(),
      searched: tasks('a'),
      inSet: tasks('a', 'b'),
    };
    const second = {
      ...automatic(),
      searched: tasks('b'),
      inSet: tasks('a', 'b'),
    };
    const both = created()
      .started({ ...first, at: NOW, cooldownMilliseconds: 10 })
      .stepConfirmed({ kind: 'start', searchId: first.searchId, request: null })
      .started({ ...second, at: later(20), cooldownMilliseconds: 10 });
    const firstAgain = both.stepWithdrawn({
      kind: 'start',
      searchId: first.searchId,
      request: null,
    });
    const withdrawn = both.stepWithdrawn({
      kind: 'start',
      searchId: second.searchId,
      request: null,
    });

    expect(firstAgain).toBe(both);
    expect(withdrawn.lastStartedAt).toEqual(NOW);
    expect(withdrawn.checkAfter).toEqual(later(10));
    expect(withdrawn.searchedTasks).toEqual(tasks('a'));
    expect(
      withdrawn.stepWithdrawn({
        kind: 'start',
        searchId: second.searchId,
        request: null,
      }),
    ).toBe(withdrawn);
  });

  it('keeps a task a later step also searched when an earlier step is withdrawn', () => {
    const first = { ...automatic(), searched: tasks('a'), inSet: tasks('a') };
    const second = { ...automatic(), searched: tasks('a'), inSet: tasks('a') };
    const startOf = (searchId: SearchId) => ({
      kind: 'start' as const,
      searchId,
      request: null,
    });
    const both = created()
      .started({ ...first, at: NOW, cooldownMilliseconds: 10 })
      .started({ ...second, at: later(20), cooldownMilliseconds: 10 });

    const firstGone = both.stepWithdrawn(startOf(first.searchId));
    expect(firstGone.searchedTasks).toEqual(tasks('a'));
    expect(
      firstGone.stepWithdrawn(startOf(second.searchId)).searchedTasks,
    ).toEqual([]);

    const secondConfirmed = both.stepConfirmed(startOf(second.searchId));
    expect(
      secondConfirmed.stepWithdrawn(startOf(first.searchId)).searchedTasks,
    ).toEqual(tasks('a'));
  });

  it('knows since when its oldest step is pending, and forgets a confirmed one', () => {
    const pending = created()
      .requested(join('a', later(5)))
      .requested(join('b', later(2)));

    expect(pending.stepsPendingSince).toEqual(later(2));
    expect(
      pending.stepConfirmed(joinOf('b')).stepConfirmed(joinOf('a'))
        .stepsPendingSince,
    ).toBeNull();
    expect(pending.stepConfirmed(joinOf('a')).requests?.counted).toEqual([
      CandidateId.of('a'),
      CandidateId.of('b'),
    ]);
  });
});
