import {
  MAX_SET_ENTRIES,
  ReplaySet,
} from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetGateChanged } from '@replays/domain/events/replay-set-gate-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ChangesGatedElsewhereError } from '@replays/domain/exceptions/changes-gated-elsewhere.error';
import { ReplaySetEntryElsewhereError } from '@replays/domain/exceptions/replay-set-entry-elsewhere.error';
import { ReplaySetEntryTakenError } from '@replays/domain/exceptions/replay-set-entry-taken.error';
import { ReplaySetFullError } from '@replays/domain/exceptions/replay-set-full.error';
import { ReplaySetInUseError } from '@replays/domain/exceptions/replay-set-in-use.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { UnknownReplaySetEntryError } from '@replays/domain/exceptions/unknown-replay-set-entry.error';
import { UnreplayableEntryError } from '@replays/domain/exceptions/unreplayable-entry.error';
import { aSet, BY, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { ReplaySetId } from '@replays/domain/value-objects/replay-set-id.vo';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const replayable = (run: string, stationId = STATION.stationId) => ({
  runId: RunId.of(run),
  taskId: TaskId.of(`task_of_${run}`),
  stationId,
  unreplayableReason: null,
  reason: null,
});

describe('ReplaySet', () => {
  it('takes a replayable run of its station, saying its runs changed', () => {
    const set = aSet().withEntry(replayable('run_1'), NOW, false);

    expect(set.runs.map((each) => each.value)).toEqual(['run_1']);
    expect(set.entries[0]?.taskId.value).toBe('task_of_run_1');
    expect(set.pullEvents()).toEqual([
      new ReplaySetEntriesChanged(set.id, set.workspaceId),
    ]);
  });

  it('rejects a run it contains already', () => {
    const set = aSet().withEntry(replayable('run_1'), NOW, false);

    expect(() => set.withEntry(replayable('run_1'), NOW, false)).toThrow(
      ReplaySetEntryTakenError,
    );
  });

  it(`contains at most ${MAX_SET_ENTRIES} runs`, () => {
    const full = aSet(MAX_SET_ENTRIES);

    expect(full.entries).toHaveLength(MAX_SET_ENTRIES);
    expect(() => full.withEntry(replayable('one_more'), NOW, false)).toThrow(
      ReplaySetFullError,
    );
  });

  it('rejects a run of another station', () => {
    expect(() =>
      aSet().withEntry(replayable('run_1', 'station_ship'), NOW, false),
    ).toThrow(ReplaySetEntryElsewhereError);
  });

  it('rejects a run that cannot be replayed, with the reason Work returned', () => {
    try {
      aSet().withEntry(
        {
          ...replayable('run_1'),
          unreplayableReason: 'no-starting-point',
          reason: 'It never reported a starting point.',
        },
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
      aSet().withEntry({ ...replayable('run_1'), taskId: null }, NOW, false),
    ).toThrow(UnreplayableEntryError);
  });

  it('removes a run, and rejects removing one it never contained', () => {
    const set = aSet(2);
    set.pullEvents();

    const without = set.withoutEntry(RunId.of('original_0'), false);

    expect(without.runs.map((each) => each.value)).toEqual(['original_1']);
    expect(without.pullEvents()).toHaveLength(1);
    expect(() => without.withoutEntry(RunId.of('original_0'), false)).toThrow(
      UnknownReplaySetEntryError,
    );
  });

  it('is renamed, and stays as it is when it gets the same name', () => {
    const set = aSet();

    expect(set.rename(ReplaySetName.of('Queue fixes'))).toBe(set);
    expect(set.rename(ReplaySetName.of('Hard ones')).name.value).toBe(
      'Hard ones',
    );
  });

  it('is not deleted while a replay of it is in progress', () => {
    expect(() => aSet(1).delete(true)).toThrow(ReplaySetInUseError);
  });

  it('is deleted once nothing of it is in progress, saying so', () => {
    const set = aSet(1);
    set.pullEvents();

    const deleted = set.delete(false);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.pullEvents()).toEqual([
      new ReplaySetDeleted(set.id, set.workspaceId),
    ]);
  });

  it('notes once that its station is gone, and takes no more runs', () => {
    const set = aSet(1);
    set.pullEvents();

    const left = set.stationLeft(NOW);

    expect(left.isAtGoneStation).toBe(true);
    expect(left.stationLeft(NOW)).toBe(left);
    expect(left.pullEvents()).toEqual([
      new ReplaySetStationGone(set.id, set.workspaceId),
    ]);
    expect(() => left.withEntry(replayable('run_9'), NOW, false)).toThrow(
      ReplaySetStationGoneError,
    );
    expect(left.delete(false).isDeleted).toBe(true);
  });

  it('names itself as the holder of the archives its runs started from', () => {
    expect(aSet().holder).toBe('replay-set:set_1');
  });

  it('is named in 1 to 100 characters', () => {
    expect(() => ReplaySetName.of('  ')).toThrow();
    expect(() => ReplaySetName.of('x'.repeat(101))).toThrow();
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

  describe('while a search is in progress', () => {
    it('takes no run, lets none go and is not deleted', () => {
      const set = aSet(2);

      expect(() => set.withEntry(replayable('run_9'), NOW, true)).toThrow(
        ReplaySetInUseError,
      );
      expect(() => set.withoutEntry(RunId.of('original_0'), true)).toThrow(
        ReplaySetInUseError,
      );
      expect(() => set.delete(true)).toThrow(ReplaySetInUseError);
    });
  });

  describe('checking changes', () => {
    const atStation = (id: string) =>
      ReplaySet.create({
        id: ReplaySetId.of(id),
        station: STATION,
        name: ReplaySetName.of(id),
        at: NOW,
      });

    it('checks its station’s changes when no other set there does', () => {
      const set = atStation('set_a');
      const checking = set.gatingChanges([set, atStation('set_b')], BY);

      expect(set.gatesChanges).toBe(false);
      expect(checking.gatesChanges).toBe(true);
      expect(checking.gatingChanges([checking], BY)).toBe(checking);
      expect(checking.notGatingChanges(BY).gatesChanges).toBe(false);
      expect(set.notGatingChanges(BY)).toBe(set);
    });

    it('rejects while another set at its station checks them', () => {
      const other = atStation('set_b').gatingChanges([], BY);
      const elsewhere = ReplaySet.create({
        id: ReplaySetId.of('set_c'),
        station: { ...STATION, stationId: 'station_ship' },
        name: ReplaySetName.of('Ship'),
        at: NOW,
      }).gatingChanges([], BY);

      expect(() => atStation('set_a').gatingChanges([other], BY)).toThrow(
        new ChangesGatedElsewhereError(STATION.stationId),
      );
      expect(
        atStation('set_a').gatingChanges([elsewhere], BY).gatesChanges,
      ).toBe(true);
    });

    it('records who changed whether it gates its station’s changes', () => {
      const checking = atStation('set_a').gatingChanges([], BY);
      const [gated] = checking.pullEvents();
      const [ungated] = checking.notGatingChanges(BY).pullEvents();

      expect(gated).toBeInstanceOf(ReplaySetGateChanged);
      expect((gated as ReplaySetGateChanged).change).toMatchObject({
        resource: 'replay-set',
        action: 'updated',
        key: 'set_a',
      });
      expect((gated as ReplaySetGateChanged).change.recordedDetail).toEqual({
        gatesChanges: true,
      });
      expect((ungated as ReplaySetGateChanged).change.recordedDetail).toEqual({
        gatesChanges: false,
      });
      expect(checking.gatingChanges([checking], BY).pullEvents()).toEqual([]);
    });

    it('checks nothing at a station that is gone', () => {
      expect(() =>
        atStation('set_a').stationLeft(NOW).gatingChanges([], BY),
      ).toThrow(ReplaySetStationGoneError);
    });
  });
});
