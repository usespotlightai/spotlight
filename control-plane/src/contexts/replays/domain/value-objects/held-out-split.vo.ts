import { SearchSetTooSmallError } from '@replays/domain/exceptions/search-set-too-small.error';
import type { ReplaySetEntry } from '@replays/domain/value-objects/replay-set-entry.vo';
import type { SearchId } from '@replays/domain/value-objects/search-id.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

const HELD_OUT_SHARE = 0.3;

const FEWEST_HELD_OUT = 2;

const FEWEST_SEARCHED = 3;

interface SplitEntry {
  readonly runId: RunId;
  readonly taskId: TaskId;
}

const textOrder = (one: string, other: string): number =>
  one < other ? -1 : one > other ? 1 : 0;

const tasksOf = (entries: readonly SplitEntry[]): readonly string[] => [
  ...new Set(entries.map((each) => each.taskId.value)),
];

export class HeldOutSplit {
  private constructor(
    readonly searched: readonly SplitEntry[],
    readonly heldOut: readonly SplitEntry[],
  ) {}

  static drawn(input: {
    searchId: SearchId;
    entries: readonly ReplaySetEntry[];
    digest: (text: string) => string;
  }): HeldOutSplit {
    const ranked = tasksOf(input.entries)
      .map((task) => ({
        task,
        rank: input.digest(`${input.searchId.value}:${task}`),
      }))
      .sort(
        (one, other) =>
          textOrder(one.rank, other.rank) || textOrder(one.task, other.task),
      );

    return HeldOutSplit.holding(
      input.entries,
      ranked.map((each) => each.task),
    );
  }

  private static holding(
    given: readonly ReplaySetEntry[],
    ranked: readonly string[],
  ): HeldOutSplit {
    const holding = Math.ceil(HELD_OUT_SHARE * ranked.length);

    if (
      holding < FEWEST_HELD_OUT ||
      ranked.length - holding < FEWEST_SEARCHED
    ) {
      throw new SearchSetTooSmallError(ranked.length, holding);
    }

    const held = new Set(ranked.slice(0, holding));
    const entries = given.map((each) => ({
      runId: each.runId,
      taskId: each.taskId,
    }));

    return new HeldOutSplit(
      entries.filter((each) => !held.has(each.taskId.value)),
      entries.filter((each) => held.has(each.taskId.value)),
    );
  }

  static costliest(
    entries: readonly ReplaySetEntry[],
    units: (searchedRuns: number, heldOutRuns: number) => number,
  ): HeldOutSplit {
    const tasks = [...tasksOf(entries)].sort(textOrder);
    const holding = Math.ceil(HELD_OUT_SHARE * tasks.length);
    const runsOf = (task: string) =>
      entries.filter((each) => each.taskId.value === task).length;
    const reach: Map<number, readonly string[]>[] = Array.from(
      { length: holding + 1 },
      () => new Map(),
    );

    reach[0]?.set(0, []);

    for (const task of tasks) {
      const runs = runsOf(task);

      for (let count = holding; count >= 1; count -= 1) {
        for (const [held, chosen] of reach[count - 1] ?? []) {
          const into = reach[count];

          if (into && !into.has(held + runs)) {
            into.set(held + runs, [...chosen, task]);
          }
        }
      }
    }

    const [costliest] = [...(reach[holding] ?? [])].sort(
      ([one], [other]) =>
        units(entries.length - other, other) -
          units(entries.length - one, one) || one - other,
    );
    const held = costliest?.[1] ?? [];

    return HeldOutSplit.holding(entries, [
      ...held,
      ...tasks.filter((each) => !held.includes(each)),
    ]);
  }

  static rehydrate(input: {
    searched: readonly SplitEntry[];
    heldOut: readonly SplitEntry[];
  }): HeldOutSplit {
    const searchedTasks = new Set(tasksOf(input.searched));

    if (tasksOf(input.heldOut).some((each) => searchedTasks.has(each))) {
      throw new InconsistentStateError(
        'held-out split',
        'both searches and holds out a task',
      );
    }

    return new HeldOutSplit([...input.searched], [...input.heldOut]);
  }

  get searchedRuns(): readonly RunId[] {
    return this.searched.map((each) => each.runId);
  }

  get heldOutRuns(): readonly RunId[] {
    return this.heldOut.map((each) => each.runId);
  }

  get runs(): number {
    return this.searched.length + this.heldOut.length;
  }

  get searchedTasks(): number {
    return tasksOf(this.searched).length;
  }

  get heldOutTasks(): number {
    return tasksOf(this.heldOut).length;
  }

  covers(runs: readonly RunId[]): boolean {
    const held = [...this.searched, ...this.heldOut];

    return (
      runs.length === held.length &&
      runs.every((run) => held.some((each) => each.runId.equals(run)))
    );
  }

  equals(other: HeldOutSplit): boolean {
    const same = (one: readonly SplitEntry[], two: readonly SplitEntry[]) =>
      one.length === two.length &&
      one.every(
        (each, at) =>
          each.runId.equals((two[at] as SplitEntry).runId) &&
          each.taskId.equals((two[at] as SplitEntry).taskId),
      );

    return (
      same(this.searched, other.searched) && same(this.heldOut, other.heldOut)
    );
  }
}
