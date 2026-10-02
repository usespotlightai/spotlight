import { MOST_SET_ENTRIES } from '@replays/domain/aggregates/replay-set.aggregate';
import { ReplaySetDeleted } from '@replays/domain/events/replay-set-deleted.event';
import { ReplaySetEntriesChanged } from '@replays/domain/events/replay-set-entries-changed.event';
import { ReplaySetStationGone } from '@replays/domain/events/replay-set-station-gone.event';
import { ReplaySetEntryElsewhereError } from '@replays/domain/exceptions/replay-set-entry-elsewhere.error';
import { ReplaySetEntryTakenError } from '@replays/domain/exceptions/replay-set-entry-taken.error';
import { ReplaySetFullError } from '@replays/domain/exceptions/replay-set-full.error';
import { ReplaySetStationGoneError } from '@replays/domain/exceptions/replay-set-station-gone.error';
import { ReplaySetUnderwayError } from '@replays/domain/exceptions/replay-set-underway.error';
import { UnknownReplaySetEntryError } from '@replays/domain/exceptions/unknown-replay-set-entry.error';
import { UnreplayableEntryError } from '@replays/domain/exceptions/unreplayable-entry.error';
import { aSet, NOW, STATION } from '@replays/domain/replays.fake-spec';
import { ReplaySetName } from '@replays/domain/value-objects/replay-set-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const replayable = (run: string, stationId = STATION.stationId) => ({
  runId: RunId.of(run),
  taskId: TaskId.of(`task_of_${run}`),
  stationId,
  refusal: null,
  reason: null,
});

describe('ReplaySet', () => {
  it('takes a replayable run of its station, saying its runs changed', () => {
    const set = aSet().withEntry(replayable('run_1'), NOW);

    expect(set.runs.map((each) => each.value)).toEqual(['run_1']);
    expect(set.entries[0]?.taskId.value).toBe('task_of_run_1');
    expect(set.pullEvents()).toEqual([
      new ReplaySetEntriesChanged(set.id, set.workspaceId),
    ]);
  });

  it('refuses a run it holds already', () => {
    const set = aSet().withEntry(replayable('run_1'), NOW);

    expect(() => set.withEntry(replayable('run_1'), NOW)).toThrow(
      ReplaySetEntryTakenError,
    );
  });

  it(`holds at most ${MOST_SET_ENTRIES} runs`, () => {
    const full = aSet(MOST_SET_ENTRIES);

    expect(full.entries).toHaveLength(MOST_SET_ENTRIES);
    expect(() => full.withEntry(replayable('one_more'), NOW)).toThrow(
      ReplaySetFullError,
    );
  });

  it('refuses a run of another station', () => {
    expect(() =>
      aSet().withEntry(replayable('run_1', 'station_ship'), NOW),
    ).toThrow(ReplaySetEntryElsewhereError);
  });

  it('refuses a run that cannot be replayed, with the reason Work gave', () => {
    try {
      aSet().withEntry(
        {
          ...replayable('run_1'),
          refusal: 'no-starting-point',
          reason: 'it never said where it started',
        },
        NOW,
      );
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(UnreplayableEntryError);
      expect((error as UnreplayableEntryError).refusal).toBe(
        'no-starting-point',
      );
    }
  });

  it('refuses a run that worked no task', () => {
    expect(() =>
      aSet().withEntry({ ...replayable('run_1'), taskId: null }, NOW),
    ).toThrow(UnreplayableEntryError);
  });

  it('lets a run go, and refuses to let go of one it never held', () => {
    const set = aSet(2);
    set.pullEvents();

    const without = set.withoutEntry(RunId.of('original_0'));

    expect(without.runs.map((each) => each.value)).toEqual(['original_1']);
    expect(without.pullEvents()).toHaveLength(1);
    expect(() => without.withoutEntry(RunId.of('original_0'))).toThrow(
      UnknownReplaySetEntryError,
    );
  });

  it('is renamed, and stays as it is when given the same name', () => {
    const set = aSet();

    expect(set.renamed(ReplaySetName.of('Queue fixes'))).toBe(set);
    expect(set.renamed(ReplaySetName.of('Hard ones')).name.value).toBe(
      'Hard ones',
    );
  });

  it('is not deleted while a replay of it is underway', () => {
    expect(() => aSet(1).deleted(true)).toThrow(ReplaySetUnderwayError);
  });

  it('is deleted once nothing of it is underway, saying so', () => {
    const set = aSet(1);
    set.pullEvents();

    const deleted = set.deleted(false);

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
    expect(() => left.withEntry(replayable('run_9'), NOW)).toThrow(
      ReplaySetStationGoneError,
    );
    expect(left.deleted(false).isDeleted).toBe(true);
  });

  it('names itself as the holder of the archives its runs started from', () => {
    expect(aSet().holder).toBe('replay-set:set_1');
  });

  it('is named in 1 to 100 characters', () => {
    expect(() => ReplaySetName.of('  ')).toThrow();
    expect(() => ReplaySetName.of('x'.repeat(101))).toThrow();
  });
});
