import { NoFreshHeldOutError } from '@replays/domain/exceptions/no-fresh-held-out.error';
import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import { NOW, SEARCH_ID, sha256 } from '@replays/domain/replays.fake-spec';
import {
  FEWEST_SEARCH_TASKS,
  HeldOutSplit,
} from '@replays/domain/value-objects/held-out-split.vo';
import { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { describe, expect, it } from 'vitest';

const entries = (tasks: readonly string[]): ReplaySetEntry[] =>
  tasks.map((task, at) =>
    ReplaySetEntry.of({
      runId: RunId.of(`run_${at}`),
      taskId: TaskId.of(task),
      endedAt: NOW,
      addedAt: NOW,
    }),
  );

const tasksOf = (count: number): string[] =>
  Array.from({ length: count }, (_, at) => `task_${at}`);

const drawn = (entries: readonly ReplaySetEntry[], searchId = SEARCH_ID) =>
  HeldOutSplit.drawn({ searchId, entries: entries, hash: sha256 });

const heldOutTasks = (split: HeldOutSplit): string[] =>
  [...new Set(split.heldOut.map((each) => each.taskId.value))].sort();

describe('HeldOutSplit', () => {
  it('holds out the same tasks every time for the same search', () => {
    const set = entries(tasksOf(12));

    expect(heldOutTasks(drawn(set))).toEqual(heldOutTasks(drawn(set)));
    expect(heldOutTasks(drawn([...set].reverse()))).toEqual(
      heldOutTasks(drawn(set)),
    );
  });

  it('ranks tasks by the sha-256 of the search and task, holding out the lowest', () => {
    const tasks = tasksOf(10);
    const expected = [...tasks]
      .sort((one, other) =>
        sha256(`${SEARCH_ID.value}:${one}`) <
        sha256(`${SEARCH_ID.value}:${other}`)
          ? -1
          : 1,
      )
      .slice(0, 3)
      .sort();

    expect(heldOutTasks(drawn(entries(tasks)))).toEqual(expected);
  });

  it('holds out other tasks for another search', () => {
    const set = entries(tasksOf(30));
    const splits = ['search_a', 'search_b', 'search_c'].map((id) =>
      heldOutTasks(drawn(set, SearchId.of(id))).join(),
    );

    expect(new Set(splits).size).toBeGreaterThan(1);
  });

  it.each([5, 6, 7, 9, 10, 11, 17, 33, 50])(
    'holds out exactly ceil(0.3 × %i) tasks',
    (count) => {
      const split = drawn(entries(tasksOf(count)));

      expect(split.heldOutTasks).toBe(Math.ceil(0.3 * count));
      expect(split.searchedTasks).toBe(count - Math.ceil(0.3 * count));
      expect(split.runs).toBe(count);
    },
  );

  it('holds out every run of a held-out task, and searches every run of the rest', () => {
    const tasks = tasksOf(6).flatMap((task) => [task, task, task]);
    const split = drawn(entries(tasks));
    const heldOut = new Set(heldOutTasks(split));

    expect(split.heldOut).toHaveLength(heldOut.size * 3);
    expect(
      split.searched.every((each) => !heldOut.has(each.taskId.value)),
    ).toBe(true);
    expect(split.searchedTasks + split.heldOutTasks).toBe(6);
  });

  it('counts tasks, not runs, when it decides how many to hold out', () => {
    const split = drawn(
      entries(['a', 'a', 'a', 'a', 'b', 'c', 'd', 'e', 'e', 'e']),
    );

    expect(split.heldOutTasks).toBe(2);
    expect(split.searchedTasks).toBe(3);
  });

  it.each([
    [1, 1],
    [3, 1],
    [4, 2],
  ])(
    'rejects a set of %i tasks, which would hold out fewer than 2 or search fewer than 3',
    (count, heldOutCount) => {
      try {
        drawn(entries(tasksOf(count)));
        expect.unreachable();
      } catch (error) {
        expect(error).toBeInstanceOf(SearchSetTooSmallError);
        expect(error).toMatchObject({ tasks: count, heldOut: heldOutCount });
      }
    },
  );

  it('holds out only tasks no earlier search searched on, and searches the rest', () => {
    const set = entries(tasksOf(10));
    const excluding = tasksOf(7).map((each) => TaskId.of(each));
    const split = HeldOutSplit.drawn({
      searchId: SEARCH_ID,
      entries: set,
      hash: sha256,
      excluding,
    });

    expect(heldOutTasks(split)).toEqual(['task_7', 'task_8', 'task_9']);
    expect(split.searchedTasks).toBe(7);
  });

  it('rejects a draw with too few fresh tasks to hold out', () => {
    expect(() =>
      HeldOutSplit.drawn({
        searchId: SEARCH_ID,
        entries: entries(tasksOf(10)),
        hash: sha256,
        excluding: tasksOf(8).map((each) => TaskId.of(each)),
      }),
    ).toThrow(NoFreshHeldOutError);
  });

  it('rejects many runs of too few tasks', () => {
    expect(() =>
      drawn(entries(['a', 'a', 'b', 'b', 'c', 'c', 'd', 'd'])),
    ).toThrow(SearchSetTooSmallError);
  });

  it('covers exactly the runs it split', () => {
    const set = entries(tasksOf(6));
    const split = drawn(set);

    expect(split.covers(set.map((each) => each.runId))).toBe(true);
    expect(split.covers(set.slice(1).map((each) => each.runId))).toBe(false);
    expect(
      split.covers([
        ...set.slice(1).map((each) => each.runId),
        RunId.of('run_elsewhere'),
      ]),
    ).toBe(false);
  });

  it('rejects a stored split that both searches and holds out a task', () => {
    const [one, two] = entries(['a', 'a']) as [ReplaySetEntry, ReplaySetEntry];

    expect(() =>
      HeldOutSplit.rehydrate({ searched: [one], heldOut: [two] }),
    ).toThrow(InconsistentStateError);
  });

  it('needs at least five tasks to search', () => {
    expect(FEWEST_SEARCH_TASKS).toBe(5);
  });
});
