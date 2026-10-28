import {
  KEPT_SET_SIZE,
  type Replayable,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplaySetEntryElsewhereError } from '@replays/domain/exceptions/replay-set-entry-elsewhere.error';
import { ReplaySetEntryTakenError } from '@replays/domain/exceptions/replay-set-entry-taken.error';
import { ReplaySetFullError } from '@replays/domain/exceptions/replay-set-full.error';
import { ReplaySetInUseError } from '@replays/domain/exceptions/replay-set-in-use.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { ReplaySetTaskRemovedError } from '@replays/domain/exceptions/replay-set-task-removed.error';
import { UnknownReplaySetEntryError } from '@replays/domain/exceptions/unknown-replay-set-entry.error';
import { UnreplayableEntryError } from '@replays/domain/exceptions/unreplayable-entry.error';
import { aSet, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const LATER = new Date(NOW.getTime() + 60_000);

const replayable = (
  run: string,
  stationId = STATION.stationId,
): Replayable => ({
  runId: RunId.of(run),
  taskId: TaskId.of(`task_of_${run}`),
  stationId,
  unreplayableReason: null,
  reason: null,
  endedAt: NOW,
});

const adding = (...runs: Replayable[]) => ({
  add: runs,
  remove: [],
});

describe('ReplaySet', () => {
  it('is kept empty at its station until its first refresh', () => {
    const set = ReplaySet.create({
      id: ReplaySetId.of('set_1'),
      station: STATION,
      at: NOW,
    });

    expect(set.entries).toEqual([]);
    expect(set.removedTasks).toEqual([]);
    expect(set.refreshedAt).toBeNull();
    expect(set.lastRefresh).toBeNull();
    expect(set.pullEvents()).toEqual([]);
  });

  describe('refreshed', () => {
    it('adds and removes runs, records the refresh and says its runs changed', () => {
      const set = aSet(2);
      set.pullEvents();

      const refreshed = set.refresh(
        { add: [replayable('run_1')], remove: [RunId.of('original_0')] },
        LATER,
        false,
      );

      expect(refreshed.runs.map((each) => each.value)).toEqual([
        'original_1',
        'run_1',
      ]);
      expect(refreshed.entries[1]?.addedAt).toEqual(LATER);
      expect(refreshed.refreshedAt).toEqual(LATER);
      expect(refreshed.lastRefresh?.at).toEqual(LATER);
      expect(refreshed.lastRefresh?.added.map((each) => each.value)).toEqual([
        'run_1',
      ]);
      expect(refreshed.lastRefresh?.removed.map((each) => each.value)).toEqual([
        'original_0',
      ]);
      expect(refreshed.pullEvents()).toEqual([
        new ReplaySetEntriesChanged(set.id, set.workspaceId),
      ]);
    });

    it('notes the time of a refresh that changes nothing, but keeps the last change', () => {
      const set = aSet(1);
      set.pullEvents();
      const before = set.lastRefresh;

      const refreshed = set.refresh(adding(), LATER, false);

      expect(refreshed.refreshedAt).toEqual(LATER);
      expect(refreshed.lastRefresh).toBe(before);
      expect(refreshed.runs).toEqual(set.runs);
      expect(refreshed.pullEvents()).toEqual([]);
    });

    it('is refused while a search, a replay or a check uses it', () => {
      expect(() =>
        aSet(1).refresh(adding(replayable('run_1')), LATER, true),
      ).toThrow(ReplaySetInUseError);
    });

    it('is refused once its station is gone', () => {
      expect(() =>
        aSet(1).stationLeft(NOW).refresh(adding(), LATER, false),
      ).toThrow(ReplaySetStationGoneError);
    });

    it('rejects a run or a task it contains already', () => {
      const set = aSet().refresh(adding(replayable('run_1')), NOW, false);

      expect(() =>
        set.refresh(adding(replayable('run_1')), LATER, false),
      ).toThrow(ReplaySetEntryTakenError);
      expect(() =>
        set.refresh(
          adding({
            ...replayable('run_2'),
            taskId: TaskId.of('task_of_run_1'),
          }),
          LATER,
          false,
        ),
      ).toThrow(ReplaySetEntryTakenError);
      expect(() =>
        aSet().refresh(
          adding(replayable('run_1'), replayable('run_1')),
          LATER,
          false,
        ),
      ).toThrow(ReplaySetEntryTakenError);
    });

    it('takes a newer run of a task whose older run it lets go in the same refresh', () => {
      const set = aSet().refresh(adding(replayable('run_1')), NOW, false);

      const refreshed = set.refresh(
        {
          add: [{ ...replayable('run_2'), taskId: TaskId.of('task_of_run_1') }],
          remove: [RunId.of('run_1')],
        },
        LATER,
        false,
      );

      expect(refreshed.runs.map((each) => each.value)).toEqual(['run_2']);
    });

    it(`contains at most ${KEPT_SET_SIZE} runs`, () => {
      const full = aSet(KEPT_SET_SIZE);

      expect(full.entries).toHaveLength(KEPT_SET_SIZE);
      expect(() =>
        full.refresh(adding(replayable('one_more')), LATER, false),
      ).toThrow(ReplaySetFullError);
    });

    it('rejects a run of another station', () => {
      expect(() =>
        aSet().refresh(adding(replayable('run_1', 'station_ship')), NOW, false),
      ).toThrow(ReplaySetEntryElsewhereError);
    });

    it('rejects a run that cannot be replayed, with the reason Work returned', () => {
      try {
        aSet().refresh(
          adding({
            ...replayable('run_1'),
            unreplayableReason: 'no-starting-point',
            reason: 'It never reported a starting point.',
          }),
          NOW,
          false,
        );
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(UnreplayableEntryError);
        expect((error as UnreplayableEntryError).unreplayableReason).toBe(
          'no-starting-point',
        );
      }
    });

    it('rejects a run that worked no task', () => {
      expect(() =>
        aSet().refresh(
          adding({ ...replayable('run_1'), taskId: null }),
          NOW,
          false,
        ),
      ).toThrow(UnreplayableEntryError);
    });

    it('rejects removing a run it never contained', () => {
      expect(() =>
        aSet(1).refresh({ add: [], remove: [RunId.of('run_9')] }, LATER, false),
      ).toThrow(UnknownReplaySetEntryError);
    });
  });

  describe('removeEntry', () => {
    it('removes a run, and rejects removing one it never contained', () => {
      const set = aSet(2);
      set.pullEvents();

      const without = set.removeEntry(RunId.of('original_0'), false);

      expect(without.runs.map((each) => each.value)).toEqual(['original_1']);
      expect(without.pullEvents()).toEqual([
        new ReplaySetEntriesChanged(set.id, set.workspaceId),
      ]);
      expect(() => without.removeEntry(RunId.of('original_0'), false)).toThrow(
        UnknownReplaySetEntryError,
      );
    });

    it('never takes a run of a task a person removed again', () => {
      const without = aSet(2).removeEntry(RunId.of('original_0'), false);

      expect(without.removedTasks.map((each) => each.value)).toEqual([
        'task_0',
      ]);
      expect(without.wasRemoved(TaskId.of('task_0'))).toBe(true);
      expect(() =>
        without.refresh(
          adding({ ...replayable('run_9'), taskId: TaskId.of('task_0') }),
          LATER,
          false,
        ),
      ).toThrow(ReplaySetTaskRemovedError);
    });

    it('is refused while a search, a replay or a check uses the set', () => {
      expect(() => aSet(2).removeEntry(RunId.of('original_0'), true)).toThrow(
        ReplaySetInUseError,
      );
    });
  });

  it('is deleted, saying so', () => {
    const set = aSet(1);
    set.pullEvents();

    const deleted = set.delete();

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new ReplaySetDeleted(set.id, set.workspaceId),
    ]);
  });

  it('notes once that its station is gone', () => {
    const set = aSet(1);
    set.pullEvents();

    const left = set.stationLeft(NOW);

    expect(left.isAtGoneStation).toBe(true);
    expect(left.stationLeft(NOW)).toBe(left);
    expect(left.pullEvents()).toEqual([
      new ReplaySetStationGone(set.id, set.workspaceId),
    ]);
    expect(left.delete().isDeleted).toBe(true);
  });

  it('names itself as the holder of the archives its runs started from', () => {
    expect(aSet().holder).toBe('replay-set:set_1');
  });

  it('is marked as searched, so a writer with an older copy moves on', () => {
    const set = aSet(2);
    set.pullEvents();
    const searched = set.recordSearch();

    expect(searched).not.toBe(set);
    expect(searched.runs).toEqual(set.runs);
    expect(searched.pullEvents()).toEqual([]);
    expect(() => set.stationLeft(NOW).recordSearch()).toThrow(
      ReplaySetStationGoneError,
    );
  });
});
